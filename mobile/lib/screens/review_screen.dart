import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../theme/harmonix_theme.dart';

/// SRS review — mirrors web `/review`.
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key});

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  List<Map<String, dynamic>> _due = [];
  int _index = 0;
  final List<Map<String, dynamic>> _results = [];
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  DateTime? _shownAt;
  bool _revealed = false;

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
      final data = await context.read<ApiClient>().progressDue(limit: 20);
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
    setState(() => _submitting = true);
    try {
      if (results.isNotEmpty) {
        await context.read<ApiClient>().progressReview(results);
      }
    } catch (_) {
      // best effort
    }
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review'),
        actions: [
          TextButton(
            onPressed: _submitting
                ? null
                : () => _submit(_results),
            child: const Text('Done'),
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
                        FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _due.isEmpty
                  ? Center(
                      child: Text(
                        'No words due for review. Come back tomorrow.',
                        style: TextStyle(color: colors.textMuted),
                        textAlign: TextAlign.center,
                      ),
                    )
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
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
                            style: Theme.of(context).textTheme.displayLarge,
                          ),
                          const SizedBox(height: 16),
                          if (_revealed)
                            Text(
                              (_due[_index]['definition'] ?? '').toString(),
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyLarge,
                            )
                          else
                            TextButton(
                              onPressed: () => setState(() => _revealed = true),
                              child: const Text('Show meaning'),
                            ),
                          const Spacer(),
                          if (_revealed) ...[
                            FilledButton(
                              onPressed: _submitting ? null : () => _rate(true),
                              child: const Text('Got it'),
                            ),
                            const SizedBox(height: 10),
                            OutlinedButton(
                              onPressed: _submitting ? null : () => _rate(false),
                              child: const Text('Still learning'),
                            ),
                          ],
                        ],
                      ),
                    ),
    );
  }
}
