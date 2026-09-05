import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/home_navigation_controller.dart';
import '../utils/i18n.dart';
import 'discover_screen.dart';
import 'library_screen.dart';
import 'settings_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    this.initialTabIndex,
    this.selectLibraryAfterSpotifyLink = false,
  });

  /// Optional starting tab. Ignored when [selectLibraryAfterSpotifyLink] is true.
  final int? initialTabIndex;

  /// Cold/warm OAuth success override — selects Library once (D-12-04).
  final bool selectLibraryAfterSpotifyLink;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  bool _appliedConstructorOverride = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _appliedConstructorOverride) return;
      _appliedConstructorOverride = true;
      final nav = context.read<HomeNavigationController>();
      if (widget.selectLibraryAfterSpotifyLink) {
        nav.selectLibraryOnce();
      } else if (widget.initialTabIndex != null) {
        nav.selectTab(widget.initialTabIndex!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final nav = context.watch<HomeNavigationController>();
    final index = nav.index;

    final pages = [
      const DiscoverScreen(),
      const LibraryScreen(),
      const SettingsScreen(),
    ];

    return Scaffold(
      body: SafeArea(child: pages[index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: nav.selectTab,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.explore_outlined),
            selectedIcon: const Icon(Icons.explore),
            label: context.tr('nav_discover'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.library_music_outlined),
            selectedIcon: const Icon(Icons.library_music),
            label: context.tr('nav_shelf'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            selectedIcon: const Icon(Icons.settings),
            label: context.tr('nav_settings'),
          ),
        ],
      ),
    );
  }
}
