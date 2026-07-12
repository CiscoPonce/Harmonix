import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../theme/harmonix_theme.dart';
import 'playlist_detail_screen.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<dynamic> _playlists = [];
  List<dynamic> _recent = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    setState(() => _loading = true);
    try {
      final playlists = await api.playlists();
      final recentRes = await api.recentDailyWords();
      final recent = recentRes['recent'] as List? ?? [];
      setState(() {
        _playlists = playlists;
        _recent = recent;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: HarmonixColors.brand));
    }
    return RefreshIndicator(
      color: HarmonixColors.brand,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            children: [
              Text('Library', style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: HarmonixColors.of(context).textPrimary)),
              const Spacer(),
              IconButton(
                onPressed: _createPlaylist,
                icon: Icon(Icons.add_circle, color: HarmonixColors.of(context).accent),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('PLAYLISTS', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_playlists.isEmpty)
            Text('No playlists yet', style: TextStyle(color: HarmonixColors.of(context).textMuted)),
          ..._playlists.map((raw) {
            final p = raw as Map<String, dynamic>;
            final id = p['id']?.toString();
            final name = p['name']?.toString() ?? 'Playlist';
            return Card(
              child: ListTile(
                title: Text(name),
                subtitle: Text('${p['song_count'] ?? 0} songs'),
                trailing: const Icon(Icons.chevron_right),
                onTap: id == null
                    ? null
                    : () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => PlaylistDetailScreen(
                              playlistId: id,
                              playlistName: name,
                            ),
                          ),
                        );
                      },
              ),
            );
          }),
          const SizedBox(height: 24),
          Text('RECENT DISCOVERIES', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_recent.isEmpty)
            Text('No recent words', style: TextStyle(color: HarmonixColors.of(context).textMuted)),
          ..._recent.map((raw) {
            final item = raw as Map<String, dynamic>;
            final word = item['word'] as Map<String, dynamic>? ?? {};
            final song = item['song'] as Map<String, dynamic>?;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(word['text']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text(
                [
                  word['translation'],
                  if (song != null) '${song['artist']} — ${song['title']}',
                ].whereType<String>().join(' · '),
              ),
            );
          }),
        ],
      ),
    );
  }
}
