import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../theme/harmonix_theme.dart';

/// Mirrors web `AddToPlaylistModal` — list Harmonix playlists, create, add track.
class AddToPlaylistSheet extends StatefulWidget {
  const AddToPlaylistSheet({
    super.key,
    required this.songId,
    required this.title,
    required this.artist,
    this.preview,
    this.duration,
    this.cover,
  });

  final String songId;
  final String title;
  final String artist;
  final String? preview;
  final num? duration;
  final String? cover;

  static Future<void> show(
    BuildContext context, {
    required String songId,
    required String title,
    required String artist,
    String? preview,
    num? duration,
    String? cover,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: HarmonixColors.of(context).surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => AddToPlaylistSheet(
        songId: songId,
        title: title,
        artist: artist,
        preview: preview,
        duration: duration,
        cover: cover,
      ),
    );
  }

  @override
  State<AddToPlaylistSheet> createState() => _AddToPlaylistSheetState();
}

class _AddToPlaylistSheetState extends State<AddToPlaylistSheet> {
  final _nameCtrl = TextEditingController();
  List<Map<String, dynamic>> _playlists = [];
  bool _loading = true;
  bool _creating = false;
  String? _addingId;
  final Set<String> _added = {};
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await context.read<ApiClient>().playlists();
      if (!mounted) return;
      setState(() {
        _playlists = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not load playlists');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> get _trackBody => {
        'id': widget.songId,
        'title': widget.title,
        'artist': widget.artist,
        'preview': widget.preview ?? '',
        'duration': widget.duration ?? 0,
        'cover': widget.cover,
      };

  Future<void> _addTo(String playlistId) async {
    if (_addingId != null) return;
    setState(() {
      _addingId = playlistId;
      _error = null;
      _success = null;
    });
    final api = context.read<ApiClient>();
    try {
      await api.addSongToPlaylist(playlistId, songId: widget.songId, track: _trackBody);
      if (!mounted) return;
      setState(() {
        _added.add(playlistId);
        _success = 'Added to playlist';
      });
      await Future<void>.delayed(const Duration(milliseconds: 700));
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.status == 409) {
        setState(() {
          _added.add(playlistId);
          _success = 'Already in playlist';
        });
        await Future<void>.delayed(const Duration(milliseconds: 700));
        if (mounted) Navigator.of(context).pop();
      } else {
        setState(() => _error = e.message);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _addingId = null);
    }
  }

  Future<void> _createAndAdd() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty || _creating) return;
    setState(() {
      _creating = true;
      _error = null;
    });
    final api = context.read<ApiClient>();
    try {
      final created = await api.createPlaylist(name);
      final playlist = created['playlist'] is Map
          ? Map<String, dynamic>.from(created['playlist'] as Map)
          : created;
      final id = playlist['id']?.toString();
      if (id == null || id.isEmpty) throw ApiException('Could not create playlist');
      setState(() {
        _playlists = [
          {...playlist, 'song_count': playlist['song_count'] ?? 0},
          ..._playlists,
        ];
        _nameCtrl.clear();
      });
      await _addTo(id);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Add to playlist',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: colors.textPrimary,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            '${widget.title} — ${widget.artist}',
            style: TextStyle(color: colors.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(
                    hintText: 'New playlist name',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  onSubmitted: (_) => _createAndAdd(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _creating ? null : _createAndAdd,
                child: Text(_creating ? '…' : 'Create'),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
          ],
          if (_success != null) ...[
            const SizedBox(height: 8),
            Text(
              _success!,
              style: TextStyle(color: colors.accent, fontWeight: FontWeight.w700),
            ),
          ],
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_playlists.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'No playlists yet — create one above.',
                style: TextStyle(color: colors.textMuted),
              ),
            )
          else
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _playlists.length,
                separatorBuilder: (_, __) => Divider(color: colors.border, height: 1),
                itemBuilder: (context, i) {
                  final p = _playlists[i];
                  final id = p['id']?.toString() ?? '';
                  final name = p['name']?.toString() ?? 'Playlist';
                  final count = p['song_count'] ?? 0;
                  final added = _added.contains(id);
                  final busy = _addingId == id;
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(name, style: TextStyle(fontWeight: FontWeight.w700, color: colors.textPrimary)),
                    subtitle: Text('$count songs', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                    trailing: TextButton(
                      onPressed: added || busy || id.isEmpty ? null : () => _addTo(id),
                      child: Text(
                        added ? 'Added' : (busy ? '…' : 'Add'),
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: added ? colors.accent : colors.textPrimary,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
