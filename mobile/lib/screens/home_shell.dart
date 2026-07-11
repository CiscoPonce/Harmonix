import 'package:flutter/material.dart';

import '../theme/harmonix_theme.dart';
import 'discover_screen.dart';
import 'learn_screen.dart';
import 'library_screen.dart';
import 'settings_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 2; // Learn default

  @override
  Widget build(BuildContext context) {
    final pages = [
      const DiscoverScreen(),
      const LibraryScreen(),
      LearnScreen(onOpenSearch: () => setState(() => _index = 0)),
      const SettingsScreen(),
    ];

    return Scaffold(
      body: SafeArea(child: pages[_index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        indicatorColor: HarmonixColors.accent.withValues(alpha: 0.15),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore, color: HarmonixColors.accent), label: 'Discover'),
          NavigationDestination(icon: Icon(Icons.library_music_outlined), selectedIcon: Icon(Icons.library_music, color: HarmonixColors.accent), label: 'Library'),
          NavigationDestination(icon: Icon(Icons.auto_stories_outlined), selectedIcon: Icon(Icons.auto_stories, color: HarmonixColors.accent), label: 'Learn'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings, color: HarmonixColors.accent), label: 'Settings'),
        ],
      ),
    );
  }
}
