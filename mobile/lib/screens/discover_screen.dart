import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final _query = TextEditingController();
  List<dynamic> _results = [];
  Map<String, dynamic>? _stats;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _loadStats() async {
    try {
      final stats = await context.read<ApiClient>().progressStats();
      if (mounted) setState(() => _stats = stats);
    } catch (_) {}
  }

  Future<void> _search() async {
    final q = _query.text.trim();
    if (q.isEmpty) return;
    setState(() => _searching = true);
    try {
      final results = await context.read<ApiClient>().searchSongs(q);
      setState(() => _results = results);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final cefr = auth.user?['cefr_level'] ?? '—';
    final streak = _stats?['streak_days'] ?? 0;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Discover', style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: HarmonixColors.of(context).textPrimary)),
        const SizedBox(height: 12),
        Row(
          children: [
            Chip(
              label: Text('$streak DAYS ACTIVE'),
              backgroundColor: HarmonixColors.of(context).accent.withValues(alpha: 0.1),
              labelStyle: TextStyle(color: HarmonixColors.of(context).accent, fontWeight: FontWeight.w700, fontSize: 11),
            ),
            const SizedBox(width: 8),
            Chip(
              label: Text('$cefr'),
              backgroundColor: HarmonixColors.of(context).border,
              labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
            ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _query,
          decoration: InputDecoration(
            hintText: 'Search songs, artists…',
            suffixIcon: IconButton(
              onPressed: _searching ? null : _search,
              icon: _searching
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.search),
            ),
          ),
          onSubmitted: (_) => _search(),
        ),
        const SizedBox(height: 16),
        ..._results.map((raw) {
          final item = raw as Map<String, dynamic>;
          final title = item['title']?.toString() ?? 'Track';
          final artist = item['artist'] is Map
              ? (item['artist'] as Map)['name']?.toString()
              : item['artist']?.toString();
          final id = item['id']?.toString();
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.music_note, color: HarmonixColors.brand),
            title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(artist ?? ''),
            trailing: id == null ? null : const Icon(Icons.open_in_new, size: 18),
            onTap: id == null
                ? null
                : () async {
                    final uri = Uri.parse(context.read<ApiClient>().playerUrlForSongId(id));
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    }
                  },
          );
        }),
      ],
    );
  }
}
