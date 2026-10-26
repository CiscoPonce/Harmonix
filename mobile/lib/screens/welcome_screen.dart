import 'package:flutter/material.dart';
import '../theme/harmonix_theme.dart';
import 'login_screen.dart';
import 'opening_screen.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key, this.playOpening = true});

  /// Logged-out launch plays the drawing once. Tests pass false.
  final bool playOpening;

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _openingDone = false;

  final List<Map<String, String>> _features = [
    {
      'title': 'What Harmonix is for',
      'desc':
          'It teaches new words from real song lyrics. You learn a language by hearing the word inside a song, not from a word list.',
      'icon': '🎵',
    },
    {
      'title': 'How to use a word',
      'desc':
          'Hear it plays a 30-second clip of the song. Flip the card for the meaning and the lyric line. The speaker says the word on its own.',
      'icon': '✨',
    },
    {
      'title': 'How to keep going',
      'desc':
          'Next brings another word from a song you have not learned from yet. Search if you want a song you already know. Spotify is optional.',
      'icon': '🎧',
    },
  ];

  @override
  Widget build(BuildContext context) {
    if (widget.playOpening && !_openingDone) {
      return OpeningScreen(
        onFinished: () {
          if (!mounted) return;
          setState(() => _openingDone = true);
        },
      );
    }

    final colors = HarmonixColors.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            children: [
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: ColoredBox(
                  color: openingParchment,
                  child: Image.asset(
                    'assets/harmonix_mark.png',
                    height: 168,
                    width: double.infinity,
                    fit: BoxFit.contain,
                    semanticLabel: 'Harmonix',
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Hero Feature Slider
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: (idx) => setState(() => _currentPage = idx),
                  itemCount: _features.length,
                  itemBuilder: (ctx, idx) {
                    final item = _features[idx];
                    return LayoutBuilder(
                      builder: (context, constraints) {
                        return SingleChildScrollView(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: constraints.maxHeight,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 100,
                                  height: 100,
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        colors.accent.withValues(alpha: 0.2),
                                        colors.accent.withValues(alpha: 0.05),
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(32),
                                    border: Border.all(
                                      color: colors.accent.withValues(
                                        alpha: 0.3,
                                      ),
                                    ),
                                  ),
                                  child: Center(
                                    child: Text(
                                      item['icon']!,
                                      style: const TextStyle(fontSize: 48),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 28),
                                Text(
                                  item['title']!,
                                  textAlign: TextAlign.center,
                                  style: theme.textTheme.headlineSmall
                                      ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        color: colors.textPrimary,
                                      ),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  item['desc']!,
                                  textAlign: TextAlign.center,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: colors.textMuted,
                                    height: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),

              // Page Indicator Dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _features.length,
                  (index) => AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: _currentPage == index ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _currentPage == index
                          ? colors.accent
                          : colors.textMuted.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 36),

              // Action Buttons
              SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton(
                  onPressed: () {
                    final lastPage = _currentPage >= _features.length - 1;
                    if (!lastPage) {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeOut,
                      );
                      return;
                    }
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) =>
                            const LoginScreen(startInRegister: true),
                      ),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: colors.accent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    _currentPage >= _features.length - 1
                        ? 'Get Started Free'
                        : 'Next',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.black,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: colors.accent.withValues(alpha: 0.5),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    'I already have an account',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
