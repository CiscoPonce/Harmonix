import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart' as ja;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import '../constants/learning_prefs.dart';
import '../services/api_client.dart';
import '../services/offline_word_cache.dart';
import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';
import '../utils/i18n.dart';
import '../utils/study_spacing.dart';

/// SRS review — mirrors web `/review`.
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key});

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  final _pronouncePlayer = ja.AudioPlayer();
  final _tts = FlutterTts();
  List<Map<String, dynamic>> _due = [];
  int _index = 0;
  final List<Map<String, dynamic>> _results = [];
  bool _loading = true;
  bool _submitting = false;
  bool _speaking = false;
  String? _error;
  DateTime? _shownAt;
  bool _revealed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pronouncePlayer.dispose();
    super.dispose();
  }

  Future<void> _speakCurrentWord() async {
    if (_index >= _due.length || _speaking) return;
    final current = _due[_index];
    final text = (current['word'] ?? '').toString().trim();
    if (text.isEmpty) return;

    final api = context.read<ApiClient>();
    final user = context.read<AuthState>().user;
    final lang = (current['language_code'] ?? user?['target_language'])?.toString();
    final gender = normalizeVoiceGender(user?['voice_gender']?.toString());

    try {
      await _pronouncePlayer.stop();
    } catch (_) {}
    if (mounted) setState(() => _speaking = true);

    try {
      final bytes = await api.pronounceWord(text, lang: lang, voiceGender: gender);
      if (!mounted) return;
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.speech());
      await session.setActive(true);
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/harmonix_review_${DateTime.now().millisecondsSinceEpoch}.wav',
      );
      await file.writeAsBytes(bytes, flush: true);
      await _pronouncePlayer.setFilePath(file.path);
      await _pronouncePlayer.setVolume(1.0);
      await _pronouncePlayer.play().timeout(
            const Duration(seconds: 15),
            onTimeout: () {},
          );
      try {
        if (await file.exists()) await file.delete();
      } catch (_) {}
    } catch (_) {
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
      } catch (_) {}
    } finally {
      if (mounted) setState(() => _speaking = false);
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<ApiClient>();
    try {
      try {
        final cache = await OfflineWordCache.open();
        await cache.flushPendingReviews(api);
      } catch (_) {}
      final data = await api.progressDue(limit: 20);
      final due = (data['due'] as List? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (!mounted) return;
      setState(() {
        _due = due;
        _index = 0;
        _results.clear();
        _revealed = false;
        _shownAt = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _rate(bool correct) async {
    if (_index >= _due.length || _submitting) return;
    final word = _due[_index];
    final ms = _shownAt == null
        ? 0
        : DateTime.now().difference(_shownAt!).inMilliseconds;
    final nextResults = [
      ..._results,
      {
        'vocab_id': word['vocab_id'],
        'is_correct': correct,
        'response_ms': ms,
      },
    ];
    if (_index < _due.length - 1) {
      setState(() {
        _results
          ..clear()
          ..addAll(nextResults);
        _index += 1;
        _revealed = false;
        _shownAt = DateTime.now();
      });
      return;
    }
    await _submit(nextResults);
  }

  Future<void> _submit(List<Map<String, dynamic>> results) async {
    if (results.isEmpty) {
      if (mounted) Navigator.of(context).pop(true);
      return;
    }
    setState(() => _submitting = true);
    try {
      await context.read<ApiClient>().progressReview(results);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (looksLikeOfflineError(e)) {
        try {
          final cache = await OfflineWordCache.open();
          await cache.enqueuePendingReviews(results);
        } catch (_) {}
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.tr('review_saved_offline'))),
        );
        Navigator.of(context).pop(true);
        return;
      }
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${context.tr('review_submit_failed')}: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('review_title')),
        actions: [
          TextButton(
            onPressed: _submitting
                ? null
                : () => _submit(_results),
            child: Text(context.tr('review_done')),
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: colors.accent))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _load, child: Text(context.tr('retry'))),
                      ],
                    ),
                  ),
                )
              : _due.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          context.tr('review_empty'),
                          style: TextStyle(color: colors.textMuted),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: Builder(
                        builder: (context) {
                          final spacing = studyLetterSpacing(
                            context.watch<AuthState>().user?['dyslexia_font'],
                          );
                          return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            '${_index + 1} / ${_due.length}',
                            style: Theme.of(context).textTheme.titleSmall,
                            textAlign: TextAlign.center,
                          ),
                          const Spacer(),
                          Text(
                            (_due[_index]['word'] ?? '—').toString().toUpperCase(),
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.displayLarge?.copyWith(
                                  letterSpacing: spacing,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Center(
                            child: IconButton(
                              onPressed: _speaking ? null : _speakCurrentWord,
                              tooltip: context.tr('pronounce'),
                              icon: Icon(
                                _speaking ? Icons.graphic_eq : Icons.volume_up_outlined,
                                color: colors.accent,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          if (_revealed)
                            Text(
                              (_due[_index]['definition'] ?? '').toString(),
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    letterSpacing: spacing,
                                  ),
                            )
                          else
                            TextButton(
                              onPressed: () => setState(() => _revealed = true),
                              child: Text(context.tr('review_show_meaning')),
                            ),
                          if (_revealed &&
                              (_due[_index]['context_sentence'] ?? '').toString().isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: Text(
                                '"${_due[_index]['context_sentence']}"',
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      fontStyle: FontStyle.italic,
                                      color: HarmonixColors.of(context).textMuted,
                                      letterSpacing: spacing,
                                    ),
                              ),
                            ),
                          if (_revealed &&
                              ((_due[_index]['song_title'] ?? '').toString().isNotEmpty ||
                                  (_due[_index]['song_artist'] ?? '').toString().isNotEmpty))
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                [
                                  (_due[_index]['song_title'] ?? '').toString(),
                                  (_due[_index]['song_artist'] ?? '').toString(),
                                ].where((part) => part.isNotEmpty).join(' — '),
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color: HarmonixColors.of(context).textMuted,
                                      letterSpacing: spacing,
                                    ),
                              ),
                            ),
                          const Spacer(),
                          if (_revealed) ...[
                            FilledButton(
                              onPressed: _submitting ? null : () => _rate(true),
                              child: Text(context.tr('review_got_it')),
                            ),
                            const SizedBox(height: 10),
                            OutlinedButton(
                              onPressed: _submitting ? null : () => _rate(false),
                              child: Text(context.tr('review_still_learning')),
                            ),
                          ],
                        ],
                      );
                        },
                      ),
                    ),
    );
  }
}
