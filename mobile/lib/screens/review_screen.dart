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
import '../utils/review_choices.dart';
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
  String _homeLang = 'en';
  List<String> _pool = [];
  List<String> _choices = [];
  String? _picked;
  bool _showScore = false;
  Timer? _advance;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _advance?.cancel();
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
    final lang = context.read<AuthState>().user?['native_language']?.toString() ?? 'en';
    try {
      try {
        final cache = await OfflineWordCache.open();
        await cache.flushPendingReviews(api);
      } catch (_) {}
      final data = await api.progressDue(limit: 10);
      final due = (data['due'] as List? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      final pool = due.map((word) => (word['definition'] ?? '').toString()).toList();
      try {
        final learned = await api.request('GET', '/vocab/learned');
        final words = (learned['words'] as List? ?? []).whereType<Map>();
        for (final word in words) {
          final meaning = (word['definition'] ?? '').toString();
          if (meaning.trim().isNotEmpty) pool.add(meaning);
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _due = due;
        _homeLang = lang;
        _pool = pool;
        _index = 0;
        _results.clear();
        _picked = null;
        _showScore = false;
        _choices = due.isEmpty
            ? []
            : buildReviewChoices((due.first['definition'] ?? '').toString(), pool, lang);
        _shownAt = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _choose(String option) {
    if (_picked != null || _submitting || _index >= _due.length) return;
    final word = _due[_index];
    final meaning = (word['definition'] ?? '').toString().trim().toLowerCase();
    final correct = option.trim().toLowerCase() == meaning;
    final ms = _shownAt == null ? 0 : DateTime.now().difference(_shownAt!).inMilliseconds;
    setState(() => _picked = option);
    _advance?.cancel();
    _advance = Timer(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      final nextResults = [
        ..._results,
        {
          'vocab_id': word['vocab_id'],
          'is_correct': correct,
          'response_ms': ms,
        },
      ];
      if (_index < _due.length - 1) {
        final upcoming = _due[_index + 1];
        setState(() {
          _results
            ..clear()
            ..addAll(nextResults);
          _index += 1;
          _picked = null;
          _choices = buildReviewChoices((upcoming['definition'] ?? '').toString(), _pool, _homeLang);
          _shownAt = DateTime.now();
        });
        return;
      }
      _submit(nextResults);
    });
  }

  Future<void> _submit(List<Map<String, dynamic>> results) async {
    if (results.isEmpty) {
      if (mounted) Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _submitting = true;
      _results
        ..clear()
        ..addAll(results);
      _showScore = true;
    });
    try {
      await context.read<ApiClient>().progressReview(results);
      if (!mounted) return;
      setState(() => _submitting = false);
    } catch (e) {
      if (looksLikeOfflineError(e)) {
        try {
          final cache = await OfflineWordCache.open();
          await cache.enqueuePendingReviews(results);
        } catch (_) {}
        if (!mounted) return;
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.tr('review_saved_offline'))),
        );
        return;
      }
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${context.tr('review_submit_failed')}: $e')),
      );
    }
  }

  Widget _choiceButton(String choice, String meaning, double? spacing) {
    final colors = HarmonixColors.of(context);
    final revealed = _picked != null;
    final isAnswer = choice.trim().toLowerCase() == meaning;
    final chosen = _picked == choice;
    Color border = colors.border;
    Color fill = colors.surface;
    if (revealed && isAnswer) {
      border = colors.accent;
      fill = colors.accent.withValues(alpha: 0.15);
    } else if (revealed && chosen) {
      border = Colors.redAccent;
      fill = Colors.redAccent.withValues(alpha: 0.15);
    }
    return OutlinedButton(
      onPressed: revealed ? null : () => _choose(choice),
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.textPrimary,
        backgroundColor: fill,
        side: BorderSide(color: border),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        alignment: Alignment.centerLeft,
      ),
      child: Text(choice, style: TextStyle(letterSpacing: spacing)),
    );
  }

  Widget _scoreBody(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final known = _results.where((result) => result['is_correct'] == true).length;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.tr('review_score_title'),
              style: TextStyle(color: colors.textMuted),
            ),
            const SizedBox(height: 12),
            Text(
              '$known/${_results.length}',
              style: Theme.of(context).textTheme.displayLarge,
            ),
            const SizedBox(height: 8),
            Text(
              context.tr('review_score_line', {'correct': known, 'n': _results.length}),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : () => Navigator.of(context).pop(true),
              child: Text(context.tr('review_back_word')),
            ),
          ],
        ),
      ),
    );
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
                : () => _showScore ? Navigator.of(context).pop(true) : _submit(_results),
            child: Text(_showScore ? context.tr('review_back_word') : context.tr('review_done')),
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
                  : _showScore
                  ? _scoreBody(context)
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: Builder(
                        builder: (context) {
                          final spacing = studyLetterSpacing(
                            context.watch<AuthState>().user?['dyslexia_font'],
                          );
                          final meaning = (_due[_index]['definition'] ?? '').toString().trim().toLowerCase();
                          final lyric = (_due[_index]['context_sentence'] ?? '').toString();
                          final credit = [
                            (_due[_index]['song_title'] ?? '').toString(),
                            (_due[_index]['song_artist'] ?? '').toString(),
                          ].where((part) => part.isNotEmpty).join(' — ');
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
                              Text(
                                context.tr('review_prompt'),
                                textAlign: TextAlign.center,
                                style: TextStyle(color: colors.textMuted),
                              ),
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
                              if (lyric.isNotEmpty)
                                Text(
                                  '"$lyric"',
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        fontStyle: FontStyle.italic,
                                        color: colors.textMuted,
                                        letterSpacing: spacing,
                                      ),
                                ),
                              if (credit.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(
                                    credit,
                                    textAlign: TextAlign.center,
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: colors.textMuted,
                                        ),
                                  ),
                                ),
                              const Spacer(),
                              for (final choice in _choices) ...[
                                _choiceButton(choice, meaning, spacing),
                                const SizedBox(height: 10),
                              ],
                            ],
                          );
                        },
                      ),
                    ),
    );
  }
}
