import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_shell.dart';
import 'screens/onboarding_screen.dart';
import 'screens/welcome_screen.dart';
import 'services/api_client.dart';
import 'state/auth_state.dart';
import 'state/home_navigation_controller.dart';
import 'state/theme_controller.dart';
import 'theme/harmonix_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HarmonixApp());
}

class HarmonixApp extends StatefulWidget {
  const HarmonixApp({super.key});

  @override
  State<HarmonixApp> createState() => _HarmonixAppState();
}

class _HarmonixAppState extends State<HarmonixApp> {
  late final HomeNavigationController _nav;
  late final AppLinks _appLinks;
  StreamSubscription<Uri>? _linkSub;
  bool _linksBound = false;

  @override
  void initState() {
    super.initState();
    _nav = HomeNavigationController();
    _appLinks = AppLinks();
  }

  void _bindAppLinksOnce() {
    if (_linksBound) return;
    _linksBound = true;
    _consumeInitialLink();
    _linkSub = _appLinks.uriLinkStream.listen(_nav.handleIncomingUri);
  }

  Future<void> _consumeInitialLink() async {
    try {
      final uri = await _appLinks.getInitialLink();
      if (uri != null) {
        _nav.handleIncomingUri(uri);
      }
    } catch (_) {
      // Platform channels unavailable in some test/desktop hosts — ignore.
    }
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    _nav.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => ApiClient()),
        ChangeNotifierProvider(
          create: (ctx) => AuthState(ctx.read<ApiClient>())..bootstrap(),
        ),
        ChangeNotifierProvider(
          create: (_) => ThemeController()..load(),
        ),
        ChangeNotifierProvider<HomeNavigationController>.value(value: _nav),
      ],
      child: Consumer<ThemeController>(
        builder: (context, themeCtrl, _) {
          return MaterialApp(
            title: 'Harmonix',
            debugShowCheckedModeBanner: false,
            theme: buildHarmonixLightTheme(),
            darkTheme: buildHarmonixDarkTheme(),
            themeMode: themeCtrl.mode,
            home: _RootGate(onAuthenticated: _bindAppLinksOnce),
          );
        },
      ),
    );
  }
}

class _RootGate extends StatefulWidget {
  const _RootGate({required this.onAuthenticated});

  final VoidCallback onAuthenticated;

  @override
  State<_RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<_RootGate> {
  bool _scheduledBind = false;

  void _scheduleBindIfReady(bool ready) {
    if (!ready || _scheduledBind) return;
    _scheduledBind = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onAuthenticated();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final colors = HarmonixColors.of(context);
    if (auth.loading) {
      return Scaffold(
        body: Center(child: CircularProgressIndicator(color: colors.accent)),
      );
    }
    if (!auth.isAuthenticated) return const WelcomeScreen();
    if (auth.needsOnboarding) return const OnboardingScreen();
    _scheduleBindIfReady(true);
    return const HomeShell();
  }
}
