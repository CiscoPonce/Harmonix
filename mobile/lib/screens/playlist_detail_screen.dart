import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../spotify/spotify_contracts.dart';
import '../theme/harmonix_theme.dart';

class PlaylistDetailScreen extends StatefulWidget {
  const PlaylistDetailScreen({
    super.key,
    required this.provider,
    required this.providerId,
    this.playlistName = '',
    this.previewDetail,
    this.onOpenInSpotify,
  });

  /// `harmonix` or `spotify` — required so equal raw IDs never collide.
  final String provider;
  final String providerId;
  final String playlistName;

  /// Test/preview injection — skips network fetch when non-null (Spotify only).
  final SpotifyPlaylistDetail? previewDetail;
  final VoidCallback? onOpenInSpotify;

  @override
  State<PlaylistDetailScreen> createState() => _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends State<PlaylistDetailScreen> {
  Map<String, dynamic>? _localPlaylist;
  SpotifyPlaylistDetail? _spotifyDetail;
  bool _loading = true;
  String? _error;
  String? _errorKind;

  bool get _isSpotify => widget.provider == 'spotify';

  @override
  void initState() {
    super.initState();
    if (widget.previewDetail != null) {
      _spotifyDetail = widget.previewDetail;
      _loading = false;
    } else {
      _load();
    }
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
        if (!mounted) return;
        setState(() => _localPlaylist = data);
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
