import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../theme/harmonix_theme.dart';

class LearnScreen extends StatefulWidget {
  const LearnScreen({super.key, this.onOpenSearch});

  final VoidCallback? onOpenSearch;

  @override
  State<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends State<LearnScreen> {
  final _player = AudioPlayer();
  final _tts = FlutterTts();
  Map<String, dynamic>? _word;
  Map<String, dynamic>? _queue;
  bool _loading = true;
  bool _nexting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _load({bool next = false}) async {
    final api = context.read<ApiClient>();
    setState(() {
      if (next) {
        _nexting = true;
      } else {
        _loading = true;
      }
      _error = null;
    });
    try {
      final payload = next ? await api.nextDailyWord() : await api.getDailyWord();
      Map<String, dynamic>? queue;
      try {
        queue = await api.queueStatus();
      } catch (_) {}
      setState(() {
        _word = payload;
        _queue = queue ?? payload['queue'] as Map<String, dynamic>?;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _nexting = false;
        });
      }
    }
  }

  Future<void> _speakWord(String text) async {
    await _tts.setLanguage('en-US');
    await _tts.speak(text);
  }

  Future<void> _playPreview() async {
    final api = context.read<ApiClient>();
    final audio = _word?['audio'] as Map<String, dynamic>?;
    final lyric = _word?['lyric'] as Map<String, dynamic>?;
    final url = audio?['preview_url'] as String?;
    if (url == null) return;
    final resolved = api.resolveMediaUrl(url);
    try {
      await _player.setUrl(resolved);
      final offset = (audio?['preview_offset'] as num?)?.toDouble() ?? 0;
      final tsMs = (lyric?['timestamp_ms'] as num?)?.toDouble() ?? 0;
      final start = (offset + tsMs / 1000 - 2).clamp(0, 25);
      await _player.seek(Duration(milliseconds: (start * 1000).round()));
      await _player.play();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Preview unavailable: $e')),
        );
      }
    }
  }

  Future<void> _openPlayer() async {
    final song = _word?['song'] as Map<String, dynamic>?;
    final id = song?['id']?.toString();
    if (id == null) return;
    final root = kApiBase.replaceAll(RegExp(r'/api/?$'), '');
    final uri = Uri.parse('$root/player/$id');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _share() async {
    final w = _word?['word'] as Map<String, dynamic>?;
    final lyric = _word?['lyric'] as Map<String, dynamic>?;
    final song = _word?['song'] as Map<String, dynamic>?;
    final text = [
      w?['text'],
      w?['translation'],
      '"${lyric?['snippet']}"',
      '${song?['artist']} — ${song?['title']}',
      '— Harmonix',
    ].whereType<String>().join('\n');
    await Share.share(text);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: HarmonixColors.accent));
    }
    if (_error != null && _word == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => _load(),
                style: FilledButton.styleFrom(backgroundColor: HarmonixColors.accent),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final word = _word?['word'] as Map<String, dynamic>? ?? {};
    final lyric = _word?['lyric'] as Map<String, dynamic>? ?? {};
    final song = _word?['song'] as Map<String, dynamic>? ?? {};
    final ready = _queue?['ready'];

    return RefreshIndicator(
      color: HarmonixColors.accent,
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Row(
            children: [
              const CircleAvatar(
                radius: 16,
                backgroundColor: HarmonixColors.border,
                child: Icon(Icons.person, size: 18, color: HarmonixColors.textMuted),
              ),
              Expanded(
                child: Text(
                  'Harmonix',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
              IconButton(
                onPressed: widget.onOpenSearch,
                icon: const Icon(Icons.search),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Container(width: 28, height: 2, color: HarmonixColors.accent),
              const SizedBox(width: 8),
              Text('WORD OF THE DAY', style: Theme.of(context).textTheme.titleSmall),
              if (ready != null) ...[
                const Spacer(),
                Text(
                  '$ready ready',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: HarmonixColors.accent),
                ),
              ],
            ],
          ),
          const SizedBox(height: 20),
          Text(
            (word['text'] as String? ?? '—').toUpperCase(),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayLarge,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                word['pronunciation'] != null ? '/${word['pronunciation']}/' : (word['part_of_speech'] ?? ''),
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              IconButton(
                onPressed: word['text'] == null ? null : () => _speakWord(word['text'] as String),
                icon: const Icon(Icons.volume_up, size: 20, color: HarmonixColors.textMuted),
              ),
            ],
          ),
          const Divider(height: 32),
          Text(
            word['translation'] as String? ?? '',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          _LyricCard(
            snippet: lyric['snippet'] as String? ?? '',
            highlight: word['text'] as String? ?? '',
            artist: song['artist'] as String? ?? '',
            title: song['title'] as String? ?? '',
            charStart: (lyric['char_start'] as num?)?.toInt(),
            charEnd: (lyric['char_end'] as num?)?.toInt(),
          ),
          const SizedBox(height: 28),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _RoundAction(
                filled: true,
                icon: Icons.play_arrow,
                onTap: _playPreview,
              ),
              const SizedBox(width: 20),
              _RoundAction(
                filled: false,
                icon: Icons.headphones,
                onTap: _openPlayer,
              ),
              const SizedBox(width: 20),
              _RoundAction(
                filled: false,
                icon: Icons.ios_share,
                onTap: _share,
              ),
            ],
          ),
          const SizedBox(height: 28),
          OutlinedButton(
            onPressed: _nexting ? null : () => _load(next: true),
            style: OutlinedButton.styleFrom(
              foregroundColor: HarmonixColors.accent,
              side: const BorderSide(color: HarmonixColors.accent),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: Text(_nexting ? 'Finding next word…' : 'Next word'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
          ],
        ],
      ),
    );
  }
}

class _LyricCard extends StatelessWidget {
  const _LyricCard({
    required this.snippet,
    required this.highlight,
    required this.artist,
    required this.title,
    this.charStart,
    this.charEnd,
  });

  final String snippet;
  final String highlight;
  final String artist;
  final String title;
  final int? charStart;
  final int? charEnd;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: const Border(
          left: BorderSide(color: HarmonixColors.accent, width: 4),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Align(
            alignment: Alignment.topRight,
            child: Icon(Icons.format_quote, color: Colors.grey.shade300, size: 36),
          ),
          Text.rich(
            _buildSnippet(),
            style: const TextStyle(
              fontSize: 18,
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w700,
              color: HarmonixColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: HarmonixColors.accent,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Icon(Icons.music_note, size: 14, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${artist.toUpperCase()} • ${title.toUpperCase()}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  TextSpan _buildSnippet() {
    if (charStart != null && charEnd != null && charStart! >= 0 && charEnd! <= snippet.length && charStart! < charEnd!) {
      return TextSpan(children: [
        TextSpan(text: snippet.substring(0, charStart!)),
        TextSpan(
          text: snippet.substring(charStart!, charEnd!),
          style: const TextStyle(color: HarmonixColors.accent),
        ),
        TextSpan(text: snippet.substring(charEnd!)),
      ]);
    }
    final lower = snippet.toLowerCase();
    final needle = highlight.toLowerCase();
    final idx = lower.indexOf(needle);
    if (idx < 0) return TextSpan(text: '"$snippet"');
    return TextSpan(children: [
      TextSpan(text: '"${snippet.substring(0, idx)}'),
      TextSpan(
        text: snippet.substring(idx, idx + highlight.length),
        style: const TextStyle(color: HarmonixColors.accent),
      ),
      TextSpan(text: '${snippet.substring(idx + highlight.length)}"'),
    ]);
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.filled, required this.icon, required this.onTap});

  final bool filled;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? HarmonixColors.accent : Colors.white,
      shape: const CircleBorder(),
      elevation: filled ? 2 : 0,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Container(
          width: filled ? 64 : 56,
          height: filled ? 64 : 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: filled ? null : Border.all(color: HarmonixColors.textPrimary, width: 1.5),
          ),
          child: Icon(
            icon,
            color: filled ? Colors.white : HarmonixColors.textPrimary,
            size: filled ? 32 : 24,
          ),
        ),
      ),
    );
  }
}
