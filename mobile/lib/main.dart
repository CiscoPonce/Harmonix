import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'screens/onboarding_screen.dart';
import 'services/api_client.dart';
import 'state/auth_state.dart';
import 'theme/harmonix_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HarmonixApp());
}

class HarmonixApp extends StatelessWidget {
  const HarmonixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => ApiClient()),
        ChangeNotifierProvider(
          create: (ctx) => AuthState(ctx.read<ApiClient>())..bootstrap(),
        ),
      ],
      child: MaterialApp(
        title: 'Harmonix',
        debugShowCheckedModeBanner: false,
        theme: buildHarmonixTheme(),
        home: const _RootGate(),
      ),
    );
  }
}

class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (auth.loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: HarmonixColors.accent)),
      );
    }
    if (!auth.isAuthenticated) return const LoginScreen();
    if (auth.needsOnboarding) return const OnboardingScreen();
    return const HomeShell();
  }
}
