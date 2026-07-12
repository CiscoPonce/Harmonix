import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../theme/harmonix_theme.dart';

class PlaylistDetailScreen extends StatefulWidget {
  const PlaylistDetailScreen({
    super.key,
    required this.playlistId,
    required this.playlistName,
  });

  final String playlistId;
  final String playlistName;

  @override
  State<PlaylistDetailScreen> createState() => _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends State<PlaylistDetailScreen> {
  Map<String, dynamic>? _playlist;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<ApiClient>().getPlaylist(widget.playlistId);
      if (!mounted) return;
      setState(() => _playlist = data);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
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

  @override
  Widget build(BuildContext context) {
    final songs = (_playlist?['songs'] as List?) ?? const [];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.playlistName),
        foregroundColor: HarmonixColors.of(context).textPrimary,
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
                        FilledButton(
                          onPressed: _load,
                          style: FilledButton.styleFrom(backgroundColor: HarmonixColors.brand),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
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
                            style: TextStyle(color: HarmonixColors.of(context).textMuted),
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
                ),
    );
  }
}
