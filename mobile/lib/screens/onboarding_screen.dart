import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';

const languages = [
  ('en', 'English'),
  ('es', 'Spanish'),
  ('fr', 'French'),
  ('de', 'German'),
  ('pt', 'Portuguese'),
  ('it', 'Italian'),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  String? _native;
  String? _target;
  String _genre = 'pop';
  String _difficulty = 'medium';
  bool _busy = false;
  String? _error;
  bool _seeded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_seeded) return;
    _seeded = true;
    final user = context.read<AuthState>().user;
    if (user == null) return;
    _native = user['native_language'] as String?;
    _target = user['target_language'] as String?;
    _genre = (user['genre'] as String?) ?? 'pop';
    _difficulty = (user['difficulty'] as String?) ?? 'medium';
  }

  Future<void> _save() async {
    if (_native == null || _target == null) {
      setState(() => _error = 'Select both languages');
      return;
    }
    if (_native == _target) {
      setState(() => _error = 'Native and target must differ');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().savePreferences({
        'native_language': _native!,
        'target_language': _target!,
        'genre': _genre,
        'difficulty': _difficulty,
      });
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('Set your languages', style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: HarmonixColors.textPrimary)),
            const SizedBox(height: 8),
            Text('Choose native and target languages', style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 24),
            DropdownButtonFormField<String>(
              initialValue: _native,
              decoration: const InputDecoration(labelText: 'Native language'),
              items: languages
                  .map((l) => DropdownMenuItem(value: l.$1, child: Text(l.$2)))
                  .toList(),
              onChanged: (v) => setState(() => _native = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _target,
              decoration: const InputDecoration(labelText: 'Target language'),
              items: languages
                  .map((l) => DropdownMenuItem(value: l.$1, child: Text(l.$2)))
                  .toList(),
              onChanged: (v) => setState(() => _target = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _genre,
              decoration: const InputDecoration(labelText: 'Genre'),
              items: const [
                DropdownMenuItem(value: 'pop', child: Text('Pop')),
                DropdownMenuItem(value: 'rock', child: Text('Rock')),
                DropdownMenuItem(value: 'reggaeton', child: Text('Reggaeton')),
                DropdownMenuItem(value: 'any', child: Text('Any')),
              ],
              onChanged: (v) => setState(() => _genre = v ?? 'pop'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _difficulty,
              decoration: const InputDecoration(labelText: 'Difficulty'),
              items: const [
                DropdownMenuItem(value: 'easy', child: Text('Easy')),
                DropdownMenuItem(value: 'medium', child: Text('Medium')),
                DropdownMenuItem(value: 'hard', child: Text('Hard')),
              ],
              onChanged: (v) => setState(() => _difficulty = v ?? 'medium'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _save,
              style: FilledButton.styleFrom(backgroundColor: HarmonixColors.accent),
              child: Text(_busy ? 'Saving…' : 'Start learning'),
            ),
          ],
        ),
      ),
    );
  }
}
