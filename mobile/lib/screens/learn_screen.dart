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
import '../spotify/spotify_open.dart';
import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';
import '../utils/hear_it_timing.dart';
import '../utils/i18n.dart';
import '../widgets/add_to_playlist_sheet.dart';
import '../widgets/word_flip_card.dart';
import 'review_screen.dart';

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
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>> _shelf = [];
  int _dueCount = 0;
  List<dynamic> _searchResults = [];
  bool _loading = true;
  bool _nexting = false;
  bool _speaking = false;
  bool _playingPreview = false;
  bool _searching = false;
  String? _error;
  String? _trackedLang;
  String? _trackedGenre;
  AuthState? _auth;
  Timer? _hearStopTimer;

  @override
  void initState() {
    super.initState();
    _previewPlayer.playerStateStream.listen((state) {
      if (!mounted) return;
      final playing = state.playing && state.processingState != ja.ProcessingState.completed;
      if (playing != _playingPreview) {
        setState(() => _playingPreview = playing);
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _auth = context.read<AuthState>();
      _trackedLang = _auth?.user?['target_language']?.toString();
      _trackedGenre = _auth?.user?['genre']?.toString();
      _auth?.addListener(_onAuthChanged);
      _load();
    });
  }

  void _onAuthChanged() {
    final lang = _auth?.user?['target_language']?.toString();
    final genre = _auth?.user?['genre']?.toString();
    final changed = lang != _trackedLang || genre != _trackedGenre;
    _trackedLang = lang;
    _trackedGenre = genre;
    if (changed && mounted) _load();
  }

  @override
  void dispose() {
    _hearStopTimer?.cancel();
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
      Map<String, dynamic>? stats;
      List<Map<String, dynamic>> shelf = [];
      var dueCount = 0;
      try {
        queue = await api.queueStatus();
      } catch (_) {}
      try {
        stats = await api.progressStats();
      } catch (_) {}
      try {
        final recent = await api.recentDailyWords(days: 14);
        final raw = recent['recent'] as List? ?? [];
        shelf = raw
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      } catch (_) {}
      try {
        final due = await api.progressDue(limit: 1);
        dueCount = (due['count'] as num?)?.toInt() ?? 0;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _word = payload;
        _queue = queue ?? payload['queue'] as Map<String, dynamic>?;
        _stats = stats;
        _shelf = shelf;
        _dueCount = dueCount;
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

  Future<void> _openReview() async {
    final refreshed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ReviewScreen()),
    );
    if (refreshed == true && mounted) _load();
  }

  Future<void> _openInSpotify() async {
    final song = _word?['song'] as Map<String, dynamic>?;
    if (song == null) return;
    await launchSpotifySong(
      artist: song['artist']?.toString() ?? '',
      title: song['title']?.toString() ?? '',
      uri: song['spotify_uri']?.toString() ?? song['uri']?.toString(),
    );
  }

  Future<void> _addToPlaylist() async {
    final song = _word?['song'] as Map<String, dynamic>?;
    final audio = _word?['audio'] as Map<String, dynamic>?;
    final id = song?['id']?.toString();
    if (id == null || id.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No song to add yet')),
      );
      return;
    }
    await AddToPlaylistSheet.show(
      context,
      songId: id,
      title: song?['title']?.toString() ?? 'Track',
      artist: song?['artist']?.toString() ?? '',
      preview: audio?['preview_url']?.toString(),
      duration: audio?['duration_seconds'] as num?,
      cover: song?['cover']?.toString() ?? song?['album_cover']?.toString(),
    );
  }

  Future<void> _speakWord(String text, {String? lang}) async {
    try {
      await _pronouncePlayer.stop();
      await _pronouncePlayer.release();
      await _previewPlayer.stop();
    } catch (_) {}
    if (mounted) setState(() => _speaking = true);

    Object? lastError;
    try {
      final api = context.read<ApiClient>();
      final bytes = await api.pronounceWord(text, lang: lang);
      if (!mounted) return;

      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.speech());
      await session.setActive(true);

      final dir = await getTemporaryDirectory();
      final stamp = DateTime.now().millisecondsSinceEpoch;
      final file = File('${dir.path}/harmonix_pronounce_$stamp.wav');
      await file.writeAsBytes(bytes, flush: true);

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
          await _pronouncePlayer.onPlayerComplete.first.timeout(const Duration(seconds: 15));
        } on TimeoutException {
          // ignore
        }
      }

      await _pronouncePlayer.play(ap.DeviceFileSource(file.path));
      await waitDone();

      try {
        if (await file.exists()) await file.delete();
      } catch (_) {}
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

  Future<void> _togglePreview() async {
    if (_playingPreview || _previewPlayer.playing) {
      _hearStopTimer?.cancel();
      try {
        await _previewPlayer.pause();
      } catch (_) {}
      if (mounted) setState(() => _playingPreview = false);
      return;
    }

    final api = context.read<ApiClient>();
    final audio = _word?['audio'] as Map<String, dynamic>?;
    final lyric = _word?['lyric'] as Map<String, dynamic>?;
    final word = _word?['word'] as Map<String, dynamic>?;
    final url = audio?['preview_url'] as String?;
    if (url == null || lyric == null) return;
    try {
      _hearStopTimer?.cancel();
      try {
        await _pronouncePlayer.stop();
      } catch (_) {}

      if (mounted) setState(() => _playingPreview = true);

      // Fetch bytes so we can read X-Harmonix-Preview-Provider (iTunes fallback).
      final fetched = await api.fetchPreviewWithProvider(
        url,
        payloadProvider: audio?['preview_provider']?.toString(),
      );
      final win = computeDeezerHearWindow(
        timestampMs: (lyric['timestamp_ms'] as num?) ?? 0,
        lineEndMs: lyric['line_end_ms'] as num?,
        snippet: lyric['snippet']?.toString() ?? '',
        charStart: (lyric['char_start'] as num?) ?? 0,
        charEnd: (lyric['char_end'] as num?) ?? 0,
        previewOffset: audio?['preview_offset'] as num?,
        previewProvider: fetched.provider,
        durationSeconds: audio?['duration_seconds'] as num?,
      );
      if (!win.shouldPlay || !win.inWindow) {
        if (mounted) {
          setState(() => _playingPreview = false);
          final label = word?['text']?.toString() ?? 'this word';
          final stamp = lyric['timestamp']?.toString() ?? '';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                stamp.isEmpty
                    ? 'This preview doesn’t include “$label”. Try Open in Spotify.'
                    : 'This preview doesn’t include “$label” at $stamp. Try Open in Spotify.',
              ),
            ),
          );
        }
        return;
      }

      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/hearit_preview.mp3');
      await file.writeAsBytes(fetched.bytes, flush: true);
      await _previewPlayer.setFilePath(file.path);
      await _previewPlayer.setVolume(1.0);
      final startMs = (win.seekTo * 1000).round();
      await _previewPlayer.seek(Duration(milliseconds: startMs));
      await _previewPlayer.play();
      if (mounted) setState(() => _playingPreview = true);

      final playMs = ((win.stopAt - win.seekTo) * 1000).clamp(1800, 14000).round();
      _hearStopTimer = Timer(Duration(milliseconds: playMs), () async {
        try {
          await _previewPlayer.pause();
        } catch (_) {}
        if (mounted) setState(() => _playingPreview = false);
      });
    } catch (e) {
      if (mounted) {
        setState(() => _playingPreview = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Preview unavailable: $e')),
        );
      }
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
          if (_word?['style_relaxed'] == true) ...[
            const SizedBox(height: 8),
            Text(
              "Couldn't find more ${(_word?['style_relaxed_from'] ?? 'that').toString().replaceAll('-', ' ')} tracks — showing a close match.",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textMuted),
            ),
          ],
          const SizedBox(height: 20),
          WordFlipCard(
            height: 300,
            canFlip: (lyric['snippet']?.toString().trim().isNotEmpty ?? false) ||
                (song['title']?.toString().trim().isNotEmpty ?? false),
            front: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.center,
                  child: Text(
                    (word['text'] as String? ?? '—'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(
                          color: colors.accent,
                          fontSize: 40,
                        ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  word['translation'] as String? ?? '',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const Spacer(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (ipaLabel.isNotEmpty)
                      Text(ipaLabel, style: Theme.of(context).textTheme.bodyLarge),
                    IconButton(
                      onPressed: word['text'] == null
                          ? null
                          : () => _speakWord(
                                word['text'] as String,
                                lang: _word?['language_code'] as String?,
                              ),
                      icon: Icon(
                        _speaking ? Icons.volume_up : Icons.volume_up_outlined,
                        size: 20,
                        color: colors.textMuted,
                      ),
                    ),
                  ],
                ),
                if ((word['part_of_speech']?.toString() ?? '').isNotEmpty)
                  Text(
                    word['part_of_speech'].toString().toUpperCase(),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
              ],
            ),
            back: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${context.tr('found_in')} ${song['title'] ?? '—'} · ${song['artist'] ?? ''}',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: colors.textPrimary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 14),
                Expanded(
                  child: Text.rich(
                    highlightLyricSpan(
                      snippet: lyric['snippet'] as String? ?? '',
                      colors: colors,
                      highlightWord: word['text'] as String?,
                      charStart: (lyric['char_start'] as num?)?.toInt(),
                      charEnd: (lyric['char_end'] as num?)?.toInt(),
                    ),
                    style: TextStyle(
                      fontSize: 18,
                      fontStyle: FontStyle.italic,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                      height: 1.35,
                    ),
                  ),
                ),
                if ((lyric['timestamp']?.toString() ?? '').isNotEmpty)
                  Text(
                    lyric['timestamp'].toString(),
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            runSpacing: 12,
            children: [
              _LabeledRoundAction(
                filled: true,
                icon: _playingPreview ? Icons.pause : Icons.play_arrow,
                label: _playingPreview ? context.tr('pause') : context.tr('hear_it'),
                onTap: _togglePreview,
              ),
              _LabeledRoundAction(
                filled: false,
                icon: Icons.playlist_add,
                label: context.tr('playlist'),
                onTap: _addToPlaylist,
              ),
              _LabeledRoundAction(
                filled: false,
                icon: Icons.open_in_new,
                label: context.tr('spotify'),
                onTap: _openInSpotify,
              ),
              _LabeledRoundAction(
                filled: false,
                icon: Icons.ios_share,
                label: context.tr('share'),
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
            child: Text(_nexting ? context.tr('loading') : context.tr('next_word')),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 24),
          if (_stats != null || _dueCount > 0) ...[
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 10,
              runSpacing: 10,
              children: [
                if (_stats != null)
                  _PracticeChip(
                    icon: Icons.local_fire_department,
                    label:
                        '${_stats!['streak_days'] ?? 0} day${(_stats!['streak_days'] == 1) ? '' : 's'}',
                  ),
                if (_stats != null)
                  _GoalChip(
                    today: (_stats!['today_words'] as num?)?.toInt() ?? 0,
                    goal: (_stats!['daily_goal'] as num?)?.toInt() ?? 1,
                    met: _stats!['today_goal_met'] == true,
                  ),
                if (_dueCount > 0)
                  ActionChip(
                    avatar: Icon(Icons.replay, size: 16, color: colors.accent),
                    label: Text(
                      '$_dueCount ${_dueCount == 1 ? 'word' : 'words'} to review →',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: colors.textPrimary,
                      ),
                    ),
                    onPressed: _openReview,
                    side: BorderSide(color: colors.border),
                    backgroundColor: colors.surface,
                  ),
              ],
            ),
            const SizedBox(height: 24),
          ],
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: HarmonixColors.brand,
              borderRadius: BorderRadius.circular(20),
            ),
            child: TextField(
              controller: _searchQuery,
              style: const TextStyle(color: Color(0xFF0C1210)),
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                hintText: 'Search lyrics, artists, or languages…',
                hintStyle: const TextStyle(color: Color(0xFF9AABA0)),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF7A8A80)),
                suffixIcon: IconButton(
                  onPressed: _searching ? null : _search,
                  icon: _searching
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.arrow_forward, color: HarmonixColors.brand),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(999),
                  borderSide: BorderSide.none,
                ),
              ),
              onSubmitted: (_) => _search(),
            ),
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
                      final url = spotifyOpenUrlForSong(
                        artist: artist ?? '',
                        title: title,
                      );
                      final uri = Uri.parse(url);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                    },
            );
          }),
          if (_shelf.isNotEmpty) ...[
            const SizedBox(height: 28),
            Text('YOUR SHELF', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 12),
            SizedBox(
              height: 240,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _shelf.length.clamp(0, 14),
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, i) {
                  final item = _shelf[i];
                  final w = item['word'] is Map
                      ? Map<String, dynamic>.from(item['word'] as Map)
                      : <String, dynamic>{'text': item['word']?.toString()};
                  final songMap = item['song'] is Map
                      ? Map<String, dynamic>.from(item['song'] as Map)
                      : <String, dynamic>{
                          'title': item['title']?.toString(),
                          'artist': item['artist']?.toString(),
                        };
                  final lyricMap = item['lyric'] is Map
                      ? Map<String, dynamic>.from(item['lyric'] as Map)
                      : <String, dynamic>{};
                  final text = (w['text'] ?? item['text'] ?? '—').toString();
                  final translation =
                      (w['translation'] ?? item['translation'] ?? '').toString();
                  final phrase = (item['phrase'] ?? lyricMap['snippet'] ?? '').toString();
                  final title =
                      (item['title'] ?? songMap['title'] ?? '').toString();
                  final artist = (songMap['artist'] ?? '').toString();
                  final pos = (w['part_of_speech'] ?? '').toString();
                  final canFlip = phrase.trim().isNotEmpty || title.trim().isNotEmpty;
                  return SizedBox(
                    width: 180,
                    child: Column(
                      children: [
                        Expanded(
                          child: WordFlipCard(
                            height: 190,
                            compact: true,
                            showHint: false,
                            canFlip: canFlip,
                            front: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    if (pos.isNotEmpty)
                                      Text(
                                        pos.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          color: colors.accent,
                                        ),
                                      ),
                                    const Spacer(),
                                    if (canFlip)
                                      Icon(Icons.flip, size: 12, color: colors.textMuted),
                                  ],
                                ),
                                const Spacer(),
                                FittedBox(
                                  fit: BoxFit.scaleDown,
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    text.toUpperCase(),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 22,
                                      color: colors.accent,
                                    ),
                                  ),
                                ),
                                if (translation.isNotEmpty)
                                  Text(
                                    translation,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 12, color: colors.textMuted),
                                  ),
                              ],
                            ),
                            back: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  [artist, title].where((s) => s.isNotEmpty).join(' · '),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: colors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Expanded(
                                  child: Text.rich(
                                    highlightLyricSpan(
                                      snippet: phrase,
                                      colors: colors,
                                      highlightWord: text,
                                      charStart: (lyricMap['char_start'] as num?)?.toInt(),
                                      charEnd: (lyricMap['char_end'] as num?)?.toInt(),
                                    ),
                                    maxLines: 5,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontStyle: FontStyle.italic,
                                      fontWeight: FontWeight.w600,
                                      color: colors.textPrimary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () async {
                            await launchSpotifySong(
                              artist: artist,
                              title: title,
                              uri: songMap['spotify_uri']?.toString(),
                            );
                          },
                          child: Text(
                            'Open in Spotify',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: colors.accent,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _LabeledRoundAction extends StatelessWidget {
  const _LabeledRoundAction({
    required this.filled,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final bool filled;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    return Column(
      children: [
        Material(
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
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: colors.textMuted,
          ),
        ),
      ],
    );
  }
}

class _PracticeChip extends StatelessWidget {
  const _PracticeChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.accent),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: colors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _GoalChip extends StatelessWidget {
  const _GoalChip({required this.today, required this.goal, required this.met});
  final int today;
  final int goal;
  final bool met;

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final pct = goal <= 0 ? 0.0 : (today / goal).clamp(0.0, 1.0);
    return Container(
      width: 148,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.flag_outlined, size: 12, color: colors.textMuted),
              const SizedBox(width: 4),
              Text(
                'TODAY',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: colors.textMuted),
              ),
              const Spacer(),
              Text(
                '$today/$goal',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: colors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 4,
              backgroundColor: colors.border,
              color: met ? colors.accent : colors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
