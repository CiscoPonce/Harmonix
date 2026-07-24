import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:audio_session/audio_session.dart';
import 'package:audioplayers/audioplayers.dart' as ap;
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart' as ja;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';

class LearnScreen extends StatefulWidget {
  const LearnScreen({super.key});

  @override
  State<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends State<LearnScreen> {
  final _previewPlayer = ja.AudioPlayer();
  final _pronouncePlayer = ap.AudioPlayer();
  final _tts = FlutterTts();
  final _searchQuery = TextEditingController();
  Map<String, dynamic>? _word;
  Map<String, dynamic>? _queue;
  List<dynamic> _searchResults = [];
  bool _loading = true;
  bool _nexting = false;
  bool _speaking = false;
  bool _searching = false;
  String? _error;
  String? _trackedLang;
  AuthState? _auth;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _auth = context.read<AuthState>();
      _trackedLang = _auth?.user?['target_language']?.toString();
      _auth?.addListener(_onAuthChanged);
      _load();
    });
  }

  void _onAuthChanged() {
    final lang = _auth?.user?['target_language']?.toString();
    if (lang != _trackedLang) {
      _trackedLang = lang;
      if (mounted) _load();
    }
  }

  @override
  void dispose() {
    _auth?.removeListener(_onAuthChanged);
    _searchQuery.dispose();
    _previewPlayer.dispose();
    _pronouncePlayer.dispose();
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
      if (!mounted) return;
      setState(() {
        _word = payload;
        _queue = queue ?? payload['queue'] as Map<String, dynamic>?;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        if (e.queue != null) _queue = e.queue;
        if (next && _word != null) {
          // keep showing current word; surface error below
        } else if (!next) {
          _word = null;
        }
      });
    } catch (e) {
      if (!mounted) return;
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
    try {
      await _pronouncePlayer.stop();
      await _previewPlayer.stop();
    } catch (_) {}
    if (mounted) setState(() => _speaking = true);

    Object? lastError;
    try {
      final api = context.read<ApiClient>();
      final bytes = await api.pronounceWord(text);
      if (!mounted) return;

      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.speech());
      await session.setActive(true);

      await _pronouncePlayer.setReleaseMode(ap.ReleaseMode.stop);
      await _pronouncePlayer.setVolume(1.0);
      await _pronouncePlayer.setPlayerMode(ap.PlayerMode.mediaPlayer);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Playing pronunciation…'),
            duration: Duration(seconds: 1),
          ),
        );
      }

      Future<void> waitDone() async {
        try {
          await _pronouncePlayer.onPlayerComplete.first.timeout(const Duration(seconds: 20));
        } on TimeoutException {
          // ignore
        }
      }

      try {
        await _pronouncePlayer.play(
          ap.BytesSource(Uint8List.fromList(bytes), mimeType: 'audio/wav'),
        );
        await waitDone();
      } catch (bytesErr) {
        debugPrint('BytesSource play failed: $bytesErr');
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/harmonix_pronounce.wav');
        await file.writeAsBytes(bytes, flush: true);
        await _pronouncePlayer.play(ap.DeviceFileSource(file.path));
        await waitDone();
      }
    } catch (e, st) {
      lastError = e;
      debugPrint('Pocket-TTS pronounce failed: $e\n$st');

      try {
        if (!mounted) return;
        final lang = context.read<AuthState>().user?['target_language']?.toString() ?? 'en';
        final locale = switch (lang) {
          'es' => 'es-ES',
          'fr' => 'fr-FR',
          'de' => 'de-DE',
          'pt' => 'pt-BR',
          'it' => 'it-IT',
          _ => 'en-US',
        };
        await _tts.setLanguage(locale);
        await _tts.setVolume(1.0);
        await _tts.speak(text);
        lastError = null;
      } catch (e2) {
        debugPrint('Device TTS fallback failed: $e2');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Pronunciation unavailable: $lastError')),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _speaking = false);
    }
  }

  Future<void> _playPreview() async {
    final api = context.read<ApiClient>();
    final audio = _word?['audio'] as Map<String, dynamic>?;
    final lyric = _word?['lyric'] as Map<String, dynamic>?;
    final url = audio?['preview_url'] as String?;
    if (url == null) return;
    final resolved = api.resolveMediaUrl(url);
    try {
      try {
        await _pronouncePlayer.stop();
      } catch (_) {}
      await _previewPlayer.setUrl(resolved);
      await _previewPlayer.setVolume(1.0);
      final offset = (audio?['preview_offset'] as num?)?.toDouble() ?? 0;
      final tsMs = (lyric?['timestamp_ms'] as num?)?.toDouble() ?? 0;
      // Preview element timeline: lyric song-time minus preview offset (not plus).
      final start = (tsMs / 1000 - offset - 2).clamp(0.0, 25.0);
      await _previewPlayer.seek(Duration(milliseconds: (start * 1000).round()));
      await _previewPlayer.play();
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
    final uri = Uri.parse(context.read<ApiClient>().playerUrlForSongId(id));
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _share() async {
    final w = _word?['word'] as Map<String, dynamic>?;
    final lyric = _word?['lyric'] as Map<String, dynamic>?;
    final song = _word?['song'] as Map<String, dynamic>?;
    if (w == null || song == null) return;

    final api = context.read<ApiClient>();
    final title = [
      w['text']?.toString(),
      if ((w['translation']?.toString() ?? '').trim().isNotEmpty)
        w['translation']?.toString(),
    ].whereType<String>().join(' · ');
    final caption =
        '$title\nFrom ${song['title']} — ${song['artist']}';

    try {
      final card = await api.createPostcard(word: w, lyric: lyric, song: song);
      final id = card['id']?.toString();
      if (id == null || id.isEmpty) {
        throw ApiException('Could not create postcard');
      }
      final shareUrl = api.sharePageUrl(id);
      final text = '$caption\n\n$shareUrl';

      try {
        final bytes = await api.fetchPostcardPng(id);
        final dir = await getTemporaryDirectory();
        final slug = (w['text']?.toString() ?? 'word')
            .trim()
            .replaceAll(RegExp(r'\s+'), '-')
            .replaceAll(RegExp(r'[^\w\-]+'), '');
        final file = File(
          '${dir.path}/harmonix-${slug.isEmpty ? 'word' : slug}.png',
        );
        await file.writeAsBytes(bytes, flush: true);
        await Share.shareXFiles(
          [XFile(file.path, mimeType: 'image/png', name: file.uri.pathSegments.last)],
          text: text,
          subject: '$title · Harmonix',
        );
      } catch (_) {
        // PNG unavailable — still share the classic link + caption.
        await Share.share(text, subject: '$title · Harmonix');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiException ? e.message : '$e')),
      );
    }
  }

  Future<void> _search() async {
    final q = _searchQuery.text.trim();
    if (q.isEmpty) return;
    setState(() => _searching = true);
    try {
      final results = await context.read<ApiClient>().searchSongs(q);
      if (!mounted) return;
      setState(() => _searchResults = results);
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
    if (_loading && _word == null) {
      return const Center(child: CircularProgressIndicator(color: HarmonixColors.brand));
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
                style: FilledButton.styleFrom(backgroundColor: HarmonixColors.brand),
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
    final ipa = word['pronunciation'] as String?;
    final ipaLabel = ipa == null
        ? (word['part_of_speech']?.toString() ?? '')
        : (ipa.startsWith('/') ? ipa : '/$ipa/');
    final colors = HarmonixColors.of(context);

    return RefreshIndicator(
      color: colors.accent,
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: colors.border,
                child: Icon(Icons.person, size: 18, color: colors.textMuted),
              ),
              const SizedBox(width: 10),
              Text(
                'Harmonix',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Container(width: 28, height: 2, color: colors.accent),
              const SizedBox(width: 8),
              Text('WORD OF THE DAY', style: Theme.of(context).textTheme.titleSmall),
              if (ready != null) ...[
                const Spacer(),
                Text(
                  '$ready ready',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.accent),
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
          const SizedBox(height: 10),
          Text(
            word['translation'] as String? ?? '',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (ipaLabel.isNotEmpty)
                Text(ipaLabel, style: Theme.of(context).textTheme.bodyLarge),
              IconButton(
                onPressed: word['text'] == null ? null : () => _speakWord(word['text'] as String),
                icon: Icon(
                  _speaking ? Icons.volume_up : Icons.volume_up_outlined,
                  size: 20,
                  color: colors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
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
              foregroundColor: colors.accent,
              side: BorderSide(color: colors.accent),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: Text(_nexting ? 'Finding next word…' : 'Next word'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 32),
          TextField(
            controller: _searchQuery,
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
          const SizedBox(height: 12),
          ..._searchResults.map((raw) {
            final item = raw as Map<String, dynamic>;
            final title = item['title']?.toString() ?? 'Track';
            final artist = item['artist'] is Map
                ? (item['artist'] as Map)['name']?.toString()
                : item['artist']?.toString();
            final id = item['id']?.toString();
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.music_note, color: colors.accent),
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
    final colors = HarmonixColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: Theme.of(context).brightness == Brightness.dark ? 0.35 : 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border(
          left: BorderSide(color: colors.accent, width: 4),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Align(
            alignment: Alignment.topRight,
            child: Icon(Icons.format_quote, color: colors.border, size: 36),
          ),
          Text.rich(
            _buildSnippet(colors),
            style: TextStyle(
              fontSize: 18,
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: colors.accent,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Icon(Icons.music_note, size: 14, color: colors.onAccent),
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

  TextSpan _buildSnippet(HarmonixColors colors) {
    if (charStart != null && charEnd != null && charStart! >= 0 && charEnd! <= snippet.length && charStart! < charEnd!) {
      return TextSpan(children: [
        TextSpan(text: snippet.substring(0, charStart!)),
        TextSpan(
          text: snippet.substring(charStart!, charEnd!),
          style: TextStyle(color: colors.accent),
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
        style: TextStyle(color: colors.accent),
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
    final colors = HarmonixColors.of(context);
    return Material(
      color: filled ? colors.accent : colors.surface,
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
            border: filled ? null : Border.all(color: colors.textPrimary, width: 1.5),
          ),
          child: Icon(
            icon,
            color: filled ? colors.onAccent : colors.textPrimary,
            size: filled ? 32 : 24,
          ),
        ),
      ),
    );
  }
}
