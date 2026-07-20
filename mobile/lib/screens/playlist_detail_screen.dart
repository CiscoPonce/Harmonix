import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../spotify/spotify_contracts.dart';
import '../theme/harmonix_theme.dart';
import '../widgets/spotify_export_sheet.dart';
import '../widgets/spotify_match_report.dart';

class PlaylistDetailScreen extends StatefulWidget {
  const PlaylistDetailScreen({
    super.key,
    required this.provider,
    required this.providerId,
    this.playlistName = '',
    this.previewDetail,
    this.onOpenInSpotify,
    this.previewConnectionState,
    this.previewExportJob,
    this.previewLocalPlaylist,
    this.skipExportRestore = false,
  });

  /// `harmonix` or `spotify` — required so equal raw IDs never collide.
  final String provider;
  final String providerId;
  final String playlistName;

  /// Test/preview injection — skips network fetch when non-null (Spotify only).
  final SpotifyPlaylistDetail? previewDetail;
  final VoidCallback? onOpenInSpotify;

  /// Test injection for Harmonix export eligibility.
  final String? previewConnectionState;

  /// Test injection — seed a restored export job without network.
  final SpotifyExportJob? previewExportJob;

  /// Test injection — Harmonix playlist payload without network.
  final Map<String, dynamic>? previewLocalPlaylist;

  /// When true, skip latest/by-id network restore (tests use [previewExportJob]).
  final bool skipExportRestore;

  @override
  State<PlaylistDetailScreen> createState() => _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends State<PlaylistDetailScreen> {
  Map<String, dynamic>? _localPlaylist;
  SpotifyPlaylistDetail? _spotifyDetail;
  bool _loading = true;
  String? _error;
  String? _errorKind;

  String _connectionState = 'connect';
  SpotifyExportJob? _exportJob;
  bool _exportBusy = false;
  String? _exportError;
  Timer? _pollTimer;
  bool _sheetOpen = false;

  bool get _isSpotify => widget.provider == 'spotify';

  @override
  void initState() {
    super.initState();
    if (widget.previewConnectionState != null) {
      _connectionState = widget.previewConnectionState!;
    }
    if (widget.previewExportJob != null) {
      _exportJob = widget.previewExportJob;
      if (_exportJob!.isActive) {
        _exportBusy = true;
      }
    }
    if (widget.previewDetail != null) {
      _spotifyDetail = widget.previewDetail;
      _loading = false;
    } else if (widget.previewLocalPlaylist != null) {
      _localPlaylist = widget.previewLocalPlaylist;
      _loading = false;
      if (!widget.skipExportRestore && widget.previewExportJob == null) {
        WidgetsBinding.instance.addPostFrameCallback((_) async {
          if (!mounted) return;
          await _restoreExportJob(context.read<ApiClient>());
        });
      }
    } else {
      _load();
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _errorKind = null;
    });
    try {
      final api = context.read<ApiClient>();
      if (_isSpotify) {
        final detail = await api.spotifyPlaylistDetail(widget.providerId);
        if (!mounted) return;
        setState(() => _spotifyDetail = detail);
      } else {
        final data = await api.getPlaylist(widget.providerId);
        SpotifyConnectionStatus status =
            const SpotifyConnectionStatus(state: 'connect');
        try {
          status = await api.spotifyStatus();
        } catch (_) {
          // Detail remains usable without connection status.
        }
        if (!mounted) return;
        setState(() {
          _localPlaylist = data;
          if (widget.previewConnectionState == null) {
            _connectionState = status.state;
          }
        });
        if (!widget.skipExportRestore) {
          await _restoreExportJob(api);
        }
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      final mapped = _isSpotify
          ? mapSpotifyDetailError(status: e.status, body: {
              if (e.message.isNotEmpty) 'error': e.reason ?? e.message,
            })
          : null;
      setState(() {
        _error = mapped?.message ?? e.message;
        _errorKind = mapped?.kind;
      });
    } catch (e) {
      if (!mounted) return;
      final offline = e.toString().contains('SocketException') ||
          e.toString().contains('Failed host lookup');
      if (_isSpotify && offline) {
        final mapped = mapSpotifyDetailError(offline: true);
        setState(() {
          _error = mapped.message;
          _errorKind = mapped.kind;
        });
      } else {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Backend job identity is durable — restore via latest then by-id.
  Future<void> _restoreExportJob(ApiClient api) async {
    try {
      final latest = await api.latestSpotifyExport(widget.providerId);
      if (!mounted || latest == null) return;
      final fresh = await api.spotifyExportStatus(latest.id);
      if (!mounted) return;
      setState(() {
        _exportJob = fresh;
        if (fresh.isActive) {
          _exportBusy = true;
        }
      });
      if (fresh.isActive) {
        _startPolling(fresh.id);
      }
    } catch (_) {
      // Non-blocking — detail remains usable without export restore.
    }
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  void _startPolling(String jobId) {
    _stopPolling();
    var ticks = 0;
    _pollTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) async {
      ticks += 1;
      if (ticks > 120) {
        _stopPolling();
        if (mounted) {
          setState(() {
            _exportBusy = false;
            _exportError = 'Could not refresh export status. Try again.';
          });
        }
        return;
      }
      if (!mounted) return;
      try {
        final api = context.read<ApiClient>();
        final next = await api.spotifyExportStatus(jobId);
        if (!mounted) return;
        setState(() => _exportJob = next);
        if (!next.isActive) {
          _stopPolling();
          setState(() {
            _exportBusy = false;
            _sheetOpen = false;
          });
          if (Navigator.of(context).canPop() && _sheetOpen) {
            // Sheet host pops itself on confirm completion; ensure closed.
          }
        }
      } on ApiException catch (e) {
        _stopPolling();
        if (!mounted) return;
        setState(() {
          _exportBusy = false;
          _exportError = mapExportErrorMessage(
            status: e.status,
            reason: e.reason,
            retryAfterSec: e.retryAfterSec,
          );
        });
      } catch (e) {
        final offline = e.toString().contains('SocketException') ||
            e.toString().contains('Failed host lookup');
        _stopPolling();
        if (!mounted) return;
        setState(() {
          _exportBusy = false;
          _exportError = mapExportErrorMessage(offline: offline);
        });
      }
    });
  }

  Map<String, dynamic> _trackFromSong(Map<String, dynamic> song) {
    final raw = song['track_data'];
    if (raw is String && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) return decoded;
      } catch (_) {}
    }
    if (raw is Map<String, dynamic>) return raw;
    return {};
  }

  Future<void> _openSpotify(String? url) async {
    final safe = safeSpotifyUrl(url);
    if (safe == null) return;
    if (widget.onOpenInSpotify != null) {
      widget.onOpenInSpotify!();
      return;
    }
    final uri = Uri.parse(safe);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _formatDuration(int? ms) {
    if (ms == null || ms < 0) return '';
    final totalSec = ms ~/ 1000;
    final m = totalSec ~/ 60;
    final s = totalSec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  int get _songCount {
    final songs = (_localPlaylist?['songs'] as List?) ?? const [];
    return songs.length;
  }

  bool get _canShowExportChrome => !_isSpotify;

  bool get _exportEligible {
    if (_isSpotify) return false;
    if (_songCount <= 0) return false;
    if (_connectionState != 'connected') return false;
    if (_exportBusy) return false;
    return true;
  }

  Future<void> _openExportSheet() async {
    if (!_exportEligible && !_exportBusy) {
      if (_connectionState == 'reconnect' ||
          _connectionState == 'provider_error') {
        setState(() {
          _exportError = 'Reconnect Spotify in Settings to export.';
        });
      } else if (_connectionState != 'connected') {
        setState(() {
          _exportError = 'Connect Spotify in Settings to export.';
        });
      }
      return;
    }
    setState(() {
      _exportError = null;
      _sheetOpen = true;
    });

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setLocal) {
            return SpotifyExportSheet(
              playlistName: widget.playlistName.isNotEmpty
                  ? widget.playlistName
                  : (_localPlaylist?['name']?.toString() ?? 'Playlist'),
              songCount: _songCount,
              job: _exportJob != null && _exportJob!.isActive
                  ? _exportJob
                  : null,
              busy: _exportBusy,
              errorMessage: _exportError,
              onCancel: () {
                if (_exportBusy) return;
                Navigator.of(ctx).pop();
              },
              onConfirm: () async {
                await _startExport(onProgress: () {
                  if (ctx.mounted) setLocal(() {});
                  if (mounted) setState(() {});
                });
                if (ctx.mounted &&
                    (_exportJob == null || !_exportJob!.isActive)) {
                  Navigator.of(ctx).pop();
                }
              },
            );
          },
        );
      },
    );

    if (mounted) {
      setState(() => _sheetOpen = false);
    }
  }

  Future<void> _startExport({VoidCallback? onProgress}) async {
    if (_exportBusy) return;
    setState(() {
      _exportBusy = true;
      _exportError = null;
    });
    onProgress?.call();
    try {
      final api = context.read<ApiClient>();
      final started = await api.startSpotifyExport(
        widget.providerId,
        idempotencyKey:
            'android-${widget.providerId}-${DateTime.now().millisecondsSinceEpoch}',
      );
      if (!mounted) return;
      setState(() => _exportJob = started);
      onProgress?.call();
      if (started.isActive) {
        _startPolling(started.id);
      } else {
        setState(() => _exportBusy = false);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _exportBusy = false;
        _exportError = mapExportErrorMessage(
          status: e.status,
          reason: e.reason,
          retryAfterSec: e.retryAfterSec,
        );
      });
      onProgress?.call();
      rethrow;
    } catch (e) {
      final offline = e.toString().contains('SocketException') ||
          e.toString().contains('Failed host lookup');
      if (!mounted) return;
      setState(() {
        _exportBusy = false;
        _exportError = mapExportErrorMessage(offline: offline);
      });
      onProgress?.call();
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final title = _isSpotify
        ? (_spotifyDetail?.name.isNotEmpty == true
            ? _spotifyDetail!.name
            : widget.playlistName)
        : (widget.playlistName.isNotEmpty
            ? widget.playlistName
            : (_localPlaylist?['name']?.toString() ?? 'Playlist'));

    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        foregroundColor: colors.textPrimary,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: HarmonixColors.brand))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        if (_errorKind == 'reconnect')
                          FilledButton(
                            onPressed: () => Navigator.of(context).pop(),
                            style: FilledButton.styleFrom(
                              backgroundColor: HarmonixColors.brand,
                              minimumSize: const Size(44, 44),
                            ),
                            child: const Text('Back'),
                          )
                        else if (_errorKind != 'removed')
                          FilledButton(
                            onPressed: _load,
                            style: FilledButton.styleFrom(
                              backgroundColor: HarmonixColors.brand,
                              minimumSize: const Size(44, 44),
                            ),
                            child: const Text('Retry'),
                          ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Back to Library'),
                        ),
                      ],
                    ),
                  ),
                )
              : _isSpotify
                  ? _buildSpotifyBody(context, colors)
                  : _buildHarmonixBody(context, colors),
    );
  }

  Widget _buildSpotifyBody(BuildContext context, HarmonixColors colors) {
    final detail = _spotifyDetail;
    if (detail == null) {
      return const SizedBox.shrink();
    }
    final openUrl = safeSpotifyUrl(detail.externalUrl);
    final items = detail.items;
    final countLabel = detail.trackCount == null
        ? 'Track count unavailable'
        : '${detail.trackCount} track${detail.trackCount == 1 ? '' : 's'}';

    return RefreshIndicator(
      color: HarmonixColors.brand,
      onRefresh: widget.previewDetail != null ? () async {} : _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (detail.artworkUrl != null && detail.artworkUrl!.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    detail.artworkUrl!,
                    width: 120,
                    height: 120,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        _artworkPlaceholder(colors),
                  ),
                )
              else
                _artworkPlaceholder(colors),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _spotifyBadge(),
                    const SizedBox(height: 8),
                    Text(
                      detail.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      countLabel,
                      style: TextStyle(color: colors.textMuted, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (openUrl != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => _openSpotify(openUrl),
                style: TextButton.styleFrom(
                  foregroundColor: HarmonixColors.brand,
                  minimumSize: const Size(44, 44),
                  padding: EdgeInsets.zero,
                ),
                child: Text(
                  'Open “${detail.name}” in Spotify',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
            ),
          if (detail.restricted) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Spotify limits track details for this followed playlist.',
                    style: TextStyle(fontSize: 16),
                  ),
                  if (openUrl != null) ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => _openSpotify(openUrl),
                      style: TextButton.styleFrom(
                        foregroundColor: HarmonixColors.brand,
                        minimumSize: const Size(44, 44),
                        padding: EdgeInsets.zero,
                      ),
                      child: const Text(
                        'Open in Spotify',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ] else if (items.isEmpty) ...[
            const SizedBox(height: 40),
            Text(
              'No tracks in this playlist',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add tracks in Spotify, then refresh this page.',
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textMuted),
            ),
          ] else ...[
            const SizedBox(height: 8),
            ...items.map((item) {
              final unavailable = !item.isAvailable;
              final duration = _formatDuration(item.durationMs);
              return ListTile(
                contentPadding: EdgeInsets.zero,
                enabled: !unavailable,
                leading: Text(
                  '${item.position + 1}',
                  style: TextStyle(color: colors.textMuted),
                ),
                title: Text(
                  unavailable && item.title.isEmpty
                      ? 'Unavailable on Spotify'
                      : (item.title.isEmpty ? 'Track' : item.title),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: unavailable ? colors.textMuted : colors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  unavailable && item.title.isNotEmpty
                      ? 'Unavailable on Spotify'
                      : item.artists,
                  style: TextStyle(color: colors.textMuted),
                ),
                trailing: duration.isEmpty
                    ? null
                    : Text(duration, style: TextStyle(color: colors.textMuted)),
              );
            }),
            if (openUrl != null) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => _openSpotify(openUrl),
                style: TextButton.styleFrom(
                  foregroundColor: HarmonixColors.brand,
                  minimumSize: const Size(44, 44),
                ),
                child: const Text(
                  'Open in Spotify',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _artworkPlaceholder(HarmonixColors colors) {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border),
        color: colors.surface,
      ),
      child: Icon(Icons.music_note, color: colors.textMuted, size: 36),
    );
  }

  Widget _spotifyBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: HarmonixColors.of(context).border),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset('assets/spotify-logo.svg', width: 14, height: 14),
          const SizedBox(width: 4),
          const Text(
            'Spotify',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _buildExportChrome(HarmonixColors colors) {
    if (!_canShowExportChrome) return const SizedBox.shrink();

    final needsReconnect =
        _connectionState == 'reconnect' || _connectionState == 'provider_error';
    final connected = _connectionState == 'connected';
    final empty = _songCount == 0;

    Widget action;
    if (empty) {
      action = Text(
        'Add songs before exporting to Spotify.',
        style: TextStyle(color: colors.textMuted, fontSize: 13),
      );
    } else if (needsReconnect) {
      action = FilledButton(
        onPressed: () => Navigator.of(context).pop(),
        style: FilledButton.styleFrom(
          backgroundColor: HarmonixColors.brand,
          minimumSize: const Size(44, 44),
        ),
        child: const Text('Reconnect Spotify'),
      );
    } else if (!connected) {
      action = OutlinedButton(
        onPressed: () => Navigator.of(context).pop(),
        style: OutlinedButton.styleFrom(minimumSize: const Size(44, 44)),
        child: const Text('Connect Spotify'),
      );
    } else {
      action = FilledButton(
        onPressed: _exportEligible ? _openExportSheet : null,
        style: FilledButton.styleFrom(
          backgroundColor: HarmonixColors.brand,
          minimumSize: const Size(44, 44),
        ),
        child: const Text('Export to Spotify'),
      );
    }

    final showReport =
        _exportJob != null && !_exportJob!.isActive;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(alignment: Alignment.centerLeft, child: action),
        if (_exportError != null) ...[
          const SizedBox(height: 8),
          Text(
            _exportError!,
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
              fontSize: 13,
            ),
          ),
        ],
        if (_exportBusy && _exportJob != null && _exportJob!.isActive) ...[
          const SizedBox(height: 12),
          Text(
            exportProgressLabel(_exportJob!),
            style: const TextStyle(
              color: HarmonixColors.brand,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(
            value: _exportJob!.totalCount <= 0
                ? null
                : ((_exportJob!.stage == 'adding'
                            ? _exportJob!.exportedCount
                            : _exportJob!.currentCount) /
                        _exportJob!.totalCount)
                    .clamp(0.0, 1.0),
            color: HarmonixColors.brand,
            backgroundColor: colors.border,
            minHeight: 8,
          ),
        ],
        if (showReport) ...[
          const SizedBox(height: 16),
          SpotifyMatchReport(
            job: _exportJob!,
            onFinish: () => setState(() => _exportJob = null),
            onOpenInSpotify: widget.onOpenInSpotify,
          ),
        ],
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildHarmonixBody(BuildContext context, HarmonixColors colors) {
    final songs = (_localPlaylist?['songs'] as List?) ?? const [];

    return RefreshIndicator(
      color: HarmonixColors.brand,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            '${songs.length} song${songs.length == 1 ? '' : 's'}',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 12),
          _buildExportChrome(colors),
          if (songs.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Text(
                'No songs in this playlist yet.',
                textAlign: TextAlign.center,
                style: TextStyle(color: colors.textMuted),
              ),
            ),
          ...songs.map((raw) {
            final song = raw as Map<String, dynamic>;
            final track = _trackFromSong(song);
            final title = track['title']?.toString() ??
                song['song_id']?.toString() ??
                'Track';
            final artist = track['artist'] is Map
                ? (track['artist'] as Map)['name']?.toString()
                : track['artist']?.toString();
            final id = (track['id'] ?? song['song_id'])?.toString();
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.music_note, color: HarmonixColors.brand),
              title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(artist ?? ''),
              trailing: id == null ? null : const Icon(Icons.open_in_new, size: 18),
              onTap: id == null
                  ? null
                  : () async {
                      final uri = Uri.parse(
                        context.read<ApiClient>().playerUrlForSongId(id),
                      );
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                    },
            );
          }),
        ],
      ),
    );
  }
}
