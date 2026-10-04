import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:audioplayers/audioplayers.dart' as ap;
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart' as ja;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/api_client.dart';
import '../spotify/spotify_open.dart';
import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';
import '../utils/hear_it_timing.dart';
import '../utils/i18n.dart';
import '../utils/study_spacing.dart';
import '../widgets/add_to_playlist_sheet.dart';
import '../widgets/word_flip_card.dart';

/// A saved word from Library, with the same card actions as the home word.
class WordDetailScreen extends StatefulWidget {
  const WordDetailScreen({super.key, required this.payload});

  final Map<String, dynamic> payload;

  @override
  State<WordDetailScreen> createState() => _WordDetailScreenState();
}

class _WordDetailScreenState extends State<WordDetailScreen> {
  final _previewPlayer = ja.AudioPlayer();
  final _pronouncePlayer = ap.AudioPlayer();
  final _tts = FlutterTts();
  bool _speaking = false;
  bool _playingPreview = false;
  Timer? _hearStopTimer;

  Map<String, dynamic> get _word =>
      widget.payload['word'] is Map
          ? Map<String, dynamic>.from(widget.payload['word'] as Map)
          : <String, dynamic>{};
  Map<String, dynamic> get _lyric =>
      widget.payload['lyric'] is Map
          ? Map<String, dynamic>.from(widget.payload['lyric'] as Map)
          : <String, dynamic>{};
  Map<String, dynamic> get _song =>
      widget.payload['song'] is Map
          ? Map<String, dynamic>.from(widget.payload['song'] as Map)
          : <String, dynamic>{};
  Map<String, dynamic> get _audio =>
      widget.payload['audio'] is Map
          ? Map<String, dynamic>.from(widget.payload['audio'] as Map)
          : <String, dynamic>{};

  @override
  void initState() {
    super.initState();
    _previewPlayer.playerStateStream.listen((state) {
      if (!mounted) return;
      final playing = state.playing && state.processingState != ja.ProcessingState.completed;
      if (playing != _playingPreview) setState(() => _playingPreview = playing);
    });
  }

  @override
  void dispose() {
    _hearStopTimer?.cancel();
    _previewPlayer.dispose();
    _pronouncePlayer.dispose();
    super.dispose();
  }

  Future<void> _openInSpotify() async {
    await launchSpotifySong(
      artist: _song['artist']?.toString() ?? '',
      title: _song['title']?.toString() ?? '',
      uri: _song['spotify_uri']?.toString() ?? _song['uri']?.toString(),
    );
  }

  Future<void> _addToPlaylist() async {
    final id = _song['id']?.toString();
    if (id == null || id.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.tr('no_song_to_add'))),
      );
      return;
    }
    await AddToPlaylistSheet.show(
      context,
      songId: id,
      title: _song['title']?.toString() ?? 'Track',
      artist: _song['artist']?.toString() ?? '',
      preview: _audio['preview_url']?.toString(),
      duration: _audio['duration_seconds'] as num?,
      cover: _song['cover']?.toString(),
    );
  }

  Future<void> _speakWord() async {
    final text = _word['text']?.toString().trim() ?? '';
    if (text.isEmpty) return;
    final api = context.read<ApiClient>();
    final lang = context.read<AuthState>().user?['target_language']?.toString();
    try {
      await _pronouncePlayer.stop();
      await _previewPlayer.stop();
    } catch (_) {}
    if (mounted) setState(() => _speaking = true);
    try {
      final bytes = await api.pronounceWord(text, lang: lang);
      if (!mounted) return;
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.speech());
      await session.setActive(true);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/harmonix_pronounce_${DateTime.now().millisecondsSinceEpoch}.wav');
      await file.writeAsBytes(bytes, flush: true);
      await _pronouncePlayer.setReleaseMode(ap.ReleaseMode.stop);
      await _pronouncePlayer.setVolume(1.0);
      await _pronouncePlayer.play(ap.DeviceFileSource(file.path));
    } catch (e) {
      try {
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
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Pronunciation unavailable: $e')),
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
    final url = _audio['preview_url']?.toString();
    if (url == null || url.isEmpty) return;
    final api = context.read<ApiClient>();
    try {
      _hearStopTimer?.cancel();
      try {
        await _pronouncePlayer.stop();
      } catch (_) {}
      if (mounted) setState(() => _playingPreview = true);
      final fetched = await api.fetchPreviewWithProvider(
        url,
        payloadProvider: _audio['preview_provider']?.toString(),
      );
      final win = computeDeezerHearWindow(
        timestampMs: (_lyric['timestamp_ms'] as num?) ?? 0,
        lineEndMs: _lyric['line_end_ms'] as num?,
        snippet: _lyric['snippet']?.toString() ?? '',
        charStart: (_lyric['char_start'] as num?) ?? 0,
        charEnd: (_lyric['char_end'] as num?) ?? 0,
        previewOffset: _audio['preview_offset'] as num?,
        previewProvider: fetched.provider,
        durationSeconds: _audio['duration_seconds'] as num?,
      );
      if (!win.shouldPlay || !win.inWindow) {
        if (mounted) {
          setState(() => _playingPreview = false);
          final label = _word['text']?.toString() ?? 'this word';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('This preview doesn’t include “$label”. Try Open in Spotify.'),
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
      await _previewPlayer.seek(Duration(milliseconds: (win.seekTo * 1000).round()));
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
    final text = _word['text']?.toString() ?? '';
    if (text.isEmpty || _song.isEmpty) return;
    final api = context.read<ApiClient>();
    final title = [
      text,
      if ((_word['translation']?.toString() ?? '').trim().isNotEmpty)
        _word['translation']?.toString(),
    ].whereType<String>().join(' · ');
    final caption = '$title\nFrom ${_song['title']} — ${_song['artist']}';
    try {
      final card = await api.createPostcard(word: _word, lyric: _lyric, song: _song);
      final id = card['id']?.toString();
      if (id == null || id.isEmpty) throw ApiException('Could not create postcard');
      final shareUrl = api.sharePageUrl(id);
      final message = '$caption\n\n$shareUrl';
      try {
        final bytes = await api.fetchPostcardPng(id);
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/harmonix-word.png');
        await file.writeAsBytes(bytes, flush: true);
        await Share.shareXFiles(
          [XFile(file.path, mimeType: 'image/png', name: 'harmonix-word.png')],
          text: message,
          subject: '$title · Harmonix',
        );
      } catch (_) {
        await Share.share(message, subject: '$title · Harmonix');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e is ApiException ? e.message : '$e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final authUser = context.watch<AuthState>().user;
    final studySpacing = studyLetterSpacing(authUser?['dyslexia_font']);
    final wordText = (_word['text']?.toString() ?? '').trim();
    final translation = (_word['translation']?.toString() ?? '').trim();
    final ipaRaw = (_word['pronunciation']?.toString() ?? '').trim();
    final ipaLabel = ipaRaw.isEmpty
        ? ''
        : (ipaRaw.startsWith('/') || ipaRaw.startsWith('[') ? ipaRaw : '/$ipaRaw/');
    final snippet = (_lyric['snippet']?.toString() ?? widget.payload['phrase']?.toString() ?? '').trim();
    final songTitle = _song['title']?.toString() ?? widget.payload['title']?.toString() ?? '';
    final artist = _song['artist']?.toString() ?? widget.payload['artist']?.toString() ?? '';

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back),
              ),
            ),
            WordFlipCard(
              height: 280,
              canFlip: snippet.isNotEmpty || songTitle.isNotEmpty,
              front: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      wordText.isEmpty ? '—' : wordText,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.displayLarge?.copyWith(
                            color: colors.accent,
                            fontSize: 40,
                            letterSpacing: studySpacing,
                          ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    translation.isEmpty ? context.tr('meaning_pending') : translation,
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
                        onPressed: wordText.isEmpty ? null : _speakWord,
                        icon: Icon(
                          _speaking ? Icons.volume_up : Icons.volume_up_outlined,
                          size: 20,
                          color: colors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              back: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    [songTitle, artist].where((s) => s.isNotEmpty).join(' · '),
                    style: TextStyle(fontWeight: FontWeight.w800, color: colors.textPrimary),
                  ),
                  const SizedBox(height: 14),
                  Expanded(
                    child: Text(
                      snippet,
                      style: TextStyle(
                        fontSize: 18,
                        fontStyle: FontStyle.italic,
                        fontWeight: FontWeight.w700,
                        color: colors.textPrimary,
                        height: 1.35,
                      ),
                    ),
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
                _Action(
                  filled: true,
                  icon: _playingPreview ? Icons.pause : Icons.play_arrow,
                  label: _playingPreview ? context.tr('pause') : context.tr('hear_it'),
                  onTap: _togglePreview,
                ),
                _Action(
                  filled: false,
                  icon: Icons.playlist_add,
                  label: context.tr('playlist'),
                  onTap: _addToPlaylist,
                ),
                _Action(
                  filled: false,
                  icon: Icons.open_in_new,
                  label: context.tr('spotify'),
                  onTap: _openInSpotify,
                ),
                _Action(
                  filled: false,
                  icon: Icons.ios_share,
                  label: context.tr('share'),
                  onTap: _share,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
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
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: filled ? 64 : 56,
              height: filled ? 64 : 56,
              child: Icon(icon, color: filled ? colors.onAccent : colors.textPrimary),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
