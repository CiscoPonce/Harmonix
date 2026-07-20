import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../spotify/spotify_contracts.dart';
import '../state/home_navigation_controller.dart';
import '../theme/harmonix_theme.dart';
import '../widgets/spotify_library_list.dart';
import 'playlist_detail_screen.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<ProviderPlaylist> _harmonix = [];
  List<ProviderPlaylist> _spotify = [];
  List<Map<String, dynamic>> _recent = [];
  String? _spotifyError;
  String? _onwardUrl;
  bool _harmonixLoading = true;
  bool _spotifyLoading = true;
  bool _recentLoading = true;
  int? _rateLimitUntilMs;
  bool _refreshBlocked = false;

  bool get _loading => _harmonixLoading && _spotifyLoading && _recentLoading;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_refreshBlocked) return;
    if (_rateLimitUntilMs != null) {
      final remaining = _rateLimitUntilMs! - DateTime.now().millisecondsSinceEpoch;
      if (remaining > 0) {
        return;
      }
      _rateLimitUntilMs = null;
    }

    final api = context.read<ApiClient>();
    setState(() {
      _harmonixLoading = true;
      _spotifyLoading = true;
      _recentLoading = true;
    });

    // Independent settlement — Spotify failures never clear Harmonix content.
    final harmonixFuture = () async {
      try {
        final playlists = await api.playlists();
        if (!mounted) return;
        setState(() {
          _harmonix = playlists.map((raw) {
            final p = raw as Map<String, dynamic>;
            return ProviderPlaylist(
              provider: 'harmonix',
              providerId: p['id']?.toString() ?? '',
              name: p['name']?.toString() ?? 'Playlist',
              songCount: (p['song_count'] as num?)?.toInt(),
            );
          }).where((p) => p.providerId.isNotEmpty).toList();
        });
      } catch (_) {
        if (!mounted) return;
        // Keep prior Harmonix rows on failure.
      } finally {
        if (mounted) setState(() => _harmonixLoading = false);
      }
    }();

    final recentFuture = () async {
      try {
        final recentRes = await api.recentDailyWords();
        final recent = recentRes['recent'] as List? ?? [];
        if (!mounted) return;
        setState(() {
          _recent = recent
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        });
      } catch (_) {
        /* Recent Discoveries remain optional. */
      } finally {
        if (mounted) setState(() => _recentLoading = false);
      }
    }();

    final spotifyFuture = () async {
      try {
        final status = await api.spotifyStatus();
        if (!mounted) return;
        if (status.state == 'connect' || status.state == 'disconnected') {
          setState(() {
            _spotify = [];
            _onwardUrl = null;
            _spotifyError =
                'Connect Spotify from Settings to see your playlists.';
          });
          return;
        }
        if (status.state == 'reconnect') {
          setState(() {
            _spotify = [];
            _onwardUrl = null;
            _spotifyError =
                'Your Spotify connection expired. Reconnect to continue.';
          });
          return;
        }

        final list = await api.spotifyPlaylists();
        if (!mounted) return;
        setState(() {
          _spotify = list.playlists
              .map(
                (p) => ProviderPlaylist(
                  provider: p.provider,
                  providerId: p.providerId,
                  name: p.name,
                  externalUrl: p.externalUrl,
                  artworkUrl: p.artworkUrl,
                  trackCount: p.trackCount,
                ),
              )
              .toList();
          _onwardUrl = list.onwardUrl;
          _spotifyError = null;
        });
      } on ApiException catch (e) {
        if (!mounted) return;
        final view = mapSpotifyListError(
          status: e.status,
          body: {
            'error': e.reason,
            'retry_after': e.retryAfterSec,
          },
        );
        setState(() {
          _spotifyError = view.message;
          if (view.kind == 'rate_limited' && view.retryAfterSeconds != null) {
            _rateLimitUntilMs = DateTime.now().millisecondsSinceEpoch +
                (view.retryAfterSeconds! * 1000);
            _refreshBlocked = true;
            Future<void>.delayed(
              Duration(seconds: view.retryAfterSeconds!),
              () {
                if (mounted) {
                  setState(() => _refreshBlocked = false);
                }
              },
            );
          }
          // Preserve previously loaded Spotify cards on transient failure.
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _spotifyError = mapSpotifyListError(offline: true).message;
        });
      } finally {
        if (mounted) setState(() => _spotifyLoading = false);
      }
    }();

    await Future.wait([harmonixFuture, recentFuture, spotifyFuture]);
  }

  Future<void> _createPlaylist() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New playlist'),
        content: TextField(controller: controller, decoration: const InputDecoration(hintText: 'Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            style: FilledButton.styleFrom(backgroundColor: HarmonixColors.brand),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty || !mounted) return;
    final api = context.read<ApiClient>();
    try {
      await api.createPlaylist(name);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  void _openPlaylist(ProviderPlaylist playlist) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PlaylistDetailScreen(
          provider: playlist.provider,
          providerId: playlist.providerId,
          playlistName: playlist.name,
        ),
      ),
    );
  }

  void _openSettings() {
    context.read<HomeNavigationController>().selectTab(
          HomeNavigationController.settingsIndex,
        );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _harmonix.isEmpty && _spotify.isEmpty && _recent.isEmpty) {
      return Center(
        child: CircularProgressIndicator(color: HarmonixColors.of(context).accent),
      );
    }

    return SpotifyLibraryList(
      harmonixPlaylists: _harmonix,
      spotifyPlaylists: _spotify,
      recentDiscoveries: _recent,
      spotifyError: _spotifyError,
      spotifyLoading: _spotifyLoading,
      harmonixLoading: _harmonixLoading,
      onwardUrl: _onwardUrl,
      onRefresh: _refreshBlocked ? null : _load,
      onOpenPlaylist: _openPlaylist,
      onOpenSettings: _openSettings,
      onCreatePlaylist: _createPlaylist,
    );
  }
}
