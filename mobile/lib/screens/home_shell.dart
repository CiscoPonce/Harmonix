import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/home_navigation_controller.dart';
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
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Discover',
          ),
          NavigationDestination(
            icon: Icon(Icons.library_music_outlined),
            selectedIcon: Icon(Icons.library_music),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
