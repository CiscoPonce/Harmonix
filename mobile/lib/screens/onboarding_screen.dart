import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../constants/learning_prefs.dart';
import '../state/auth_state.dart';
import '../theme/harmonix_theme.dart';
import '../services/api_client.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _step = 0; // 0: Languages, 1: Music & Voice, 2: Spotify (Optional)

  String? _native;
  String? _target;
  String _genre = 'pop';
  String _difficulty = 'medium';
  String _voice = 'female';
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
    _native = user['native_language'] as String? ?? 'en';
    _target = user['target_language'] as String? ?? 'es';
    _genre = normalizeGenre(user['genre'] as String?);
    _difficulty = (user['difficulty'] as String?) ?? 'medium';
    _voice = normalizeVoiceGender(user['voice_gender'] as String?);
  }

  void _nextStep() {
    if (_step == 0) {
      if (_native == null || _target == null) {
        setState(() => _error = 'Select both mother and target languages');
        return;
      }
      if (_native == _target) {
        setState(() => _error = 'Mother and target languages must differ');
        return;
      }
    }
    setState(() => _error = null);
    if (_step < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _prevStep() {
    if (_step > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _saveAndFinish() async {
    if (_native == null || _target == null) {
      setState(() => _error = 'Select both languages');
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
        'voice_gender': _voice,
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

  Future<void> _connectSpotify() async {
    try {
      final urlStr = await context.read<ApiClient>().spotifyAuthStart(client: 'android');
      final uri = Uri.parse(urlStr);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      await _saveAndFinish();
    } catch (_) {
      await _saveAndFinish();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = HarmonixColors.of(context);
    final theme = Theme.of(context);
    final user = context.watch<AuthState>().user;
    final isSpotifyConnected = user?['is_spotify_connected'] == true;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 20),
            // Header Progress Dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildDot(0, colors),
                const SizedBox(width: 8),
                _buildDot(1, colors),
                const SizedBox(width: 8),
                _buildDot(2, colors),
              ],
            ),
            const SizedBox(height: 12),

            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (idx) => setState(() => _step = idx),
                children: [
                  // STEP 1: Mother Language & Target Language
                  _buildStep1Languages(context, theme, colors),

                  // STEP 2: Music Style & Voice
                  _buildStep2MusicStyle(context, theme, colors),

                  // STEP 3: Optional Spotify Connection
                  _buildStep3Spotify(context, theme, colors, isSpotifyConnected),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDot(int stepIdx, HarmonixColors colors) {
    final active = _step == stepIdx;
    final done = _step > stepIdx;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: active ? 28 : 10,
      height: 10,
      decoration: BoxDecoration(
        color: active
            ? colors.accent
            : (done ? colors.accent.withValues(alpha: 0.5) : colors.textMuted.withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(5),
      ),
    );
  }

  Widget _buildStep1Languages(BuildContext context, ThemeData theme, HarmonixColors colors) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          'Setup Profile',
          style: theme.textTheme.labelLarge?.copyWith(
            color: colors.accent,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Select Languages',
          style: theme.textTheme.headlineMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Select your mother language and the language you want to learn.',
          style: theme.textTheme.bodyMedium?.copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: 32),
        DropdownButtonFormField<String>(
          initialValue: _native,
          decoration: const InputDecoration(
            labelText: 'Mother Language (Native)',
            border: OutlineInputBorder(),
          ),
          items: [
            for (final l in kLanguages) DropdownMenuItem(value: l.$1, child: Text(l.$2)),
          ],
          onChanged: (v) => setState(() => _native = v),
        ),
        const SizedBox(height: 20),
        DropdownButtonFormField<String>(
          initialValue: _target,
          decoration: const InputDecoration(
            labelText: 'Target Language (Learning)',
            border: OutlineInputBorder(),
          ),
          items: [
            for (final l in kLanguages) DropdownMenuItem(value: l.$1, child: Text(l.$2)),
          ],
          onChanged: (v) => setState(() => _target = v),
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: const TextStyle(color: Colors.red)),
        ],
        const SizedBox(height: 36),
        SizedBox(
          height: 52,
          child: FilledButton(
            onPressed: _nextStep,
            style: FilledButton.styleFrom(
              backgroundColor: colors.accent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: const Text(
              'Continue',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.black),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStep2MusicStyle(BuildContext context, ThemeData theme, HarmonixColors colors) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          'Personalize Music',
          style: theme.textTheme.labelLarge?.copyWith(
            color: colors.accent,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Style of Music',
          style: theme.textTheme.headlineMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Choose your favorite music genre to tailor daily song recommendations.',
          style: theme.textTheme.bodyMedium?.copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: 24),
        for (final s in kMusicStyles) ...[
          InkWell(
            onTap: () => setState(() => _genre = s.$1),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: _genre == s.$1 ? colors.accent.withValues(alpha: 0.15) : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _genre == s.$1 ? colors.accent : colors.textMuted.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Text(
                    s.$1 == 'pop' ? '🎤' : (s.$1 == 'rock' ? '🎸' : (s.$1 == 'hip-hop' ? '🎧' : (s.$1 == 'reggaeton' ? '🔥' : '🎵'))),
                    style: const TextStyle(fontSize: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      s.$2,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                  if (_genre == s.$1) Icon(Icons.check_circle, color: colors.accent),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: _voice,
          decoration: const InputDecoration(
            labelText: 'Pronunciation Voice',
            border: OutlineInputBorder(),
          ),
          items: [
            for (final v in kVoiceGenders) DropdownMenuItem(value: v.$1, child: Text(v.$2)),
          ],
          onChanged: (v) => setState(() => _voice = v ?? 'female'),
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: const TextStyle(color: Colors.red)),
        ],
        const SizedBox(height: 28),
        Row(
          children: [
            OutlinedButton(
              onPressed: _prevStep,
              child: const Text('Back'),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 50,
                child: FilledButton(
                  onPressed: _nextStep,
                  style: FilledButton.styleFrom(
                    backgroundColor: colors.accent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text(
                    'Next Step',
                    style: TextStyle(fontWeight: FontWeight.w800, color: Colors.black),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep3Spotify(BuildContext context, ThemeData theme, HarmonixColors colors, bool isConnected) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xFF1DB954).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Icon(Icons.music_note_rounded, size: 36, color: Color(0xFF1DB954)),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Spotify Integration',
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Connect your Spotify account to import your playlists and stream lyrics automatically. (Optional)',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium?.copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: 32),

        if (isConnected) ...[
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF1DB954).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1DB954)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: Color(0xFF1DB954), size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Spotify Connected',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        'Your playlists will sync with Harmonix.',
                        style: theme.textTheme.bodySmall?.copyWith(color: colors.textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ] else ...[
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _busy ? null : _connectSpotify,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1DB954),
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.music_note, color: Colors.black),
              label: const Text(
                'Connect Spotify Account',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
              ),
            ),
          ),
        ],

        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: const TextStyle(color: Colors.red)),
        ],
        const SizedBox(height: 24),

        SizedBox(
          height: 52,
          child: FilledButton(
            onPressed: _busy ? null : _saveAndFinish,
            style: FilledButton.styleFrom(
              backgroundColor: colors.accent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(
              _busy
                  ? 'Saving…'
                  : (isConnected ? 'Finish Setup & Start Learning' : 'Skip & Start Learning'),
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.black),
            ),
          ),
        ),
      ],
    );
  }
}
