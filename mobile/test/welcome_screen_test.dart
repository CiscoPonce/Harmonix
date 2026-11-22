import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/welcome_screen.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';

void main() {
  testWidgets('Get Started Free opens account creation', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildHarmonixTheme(brightness: Brightness.dark),
        home: const WelcomeScreen(playOpening: false),
      ),
    );

    expect(find.text('What Harmonix is for'), findsOneWidget);
    expect(find.text('Get Started Free'), findsNothing);

    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('How to use a word'), findsOneWidget);

    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('How to keep going'), findsOneWidget);

    await tester.tap(find.text('Get Started Free'));
    await tester.pumpAndSettle();

    expect(find.text('Create your account'), findsOneWidget);
    expect(find.text('Send code'), findsOneWidget);
  });

  testWidgets('welcome shows the Bauhaus mark', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildHarmonixTheme(brightness: Brightness.dark),
        home: const WelcomeScreen(playOpening: false),
      ),
    );

    expect(find.bySemanticsLabel('Harmonix'), findsOneWidget);
    expect(find.text('♪'), findsNothing);
  });

  testWidgets('auto-detects Spanish device locale for welcome and login', (tester) async {
    tester.platformDispatcher.localesTestValue = [const Locale('es', 'ES')];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildHarmonixTheme(brightness: Brightness.dark),
        home: const WelcomeScreen(playOpening: false),
      ),
    );

    expect(find.text('Para qué sirve Harmonix'), findsOneWidget);
    expect(find.text('Ya tengo una cuenta'), findsOneWidget);

    await tester.tap(find.text('Siguiente'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Siguiente'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Empezar gratis'));
    await tester.pumpAndSettle();

    expect(find.text('Crea tu cuenta'), findsOneWidget);
    expect(find.text('Enviar código'), findsOneWidget);
  });

  testWidgets('falls back to English for unsupported device locale', (tester) async {
    tester.platformDispatcher.localesTestValue = [const Locale('ja', 'JP')];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildHarmonixTheme(brightness: Brightness.dark),
        home: const WelcomeScreen(playOpening: false),
      ),
    );

    expect(find.text('What Harmonix is for'), findsOneWidget);
  });

  testWidgets('language picker switches Welcome and Login copy immediately', (tester) async {
    tester.platformDispatcher.localesTestValue = [const Locale('en', 'US')];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildHarmonixTheme(brightness: Brightness.dark),
        home: const WelcomeScreen(playOpening: false),
      ),
    );

    expect(find.text('What Harmonix is for'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('welcome_language_picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Français'));
    await tester.pumpAndSettle();

    expect(find.text('À quoi sert Harmonix'), findsOneWidget);
    expect(find.text('J’ai déjà un compte'), findsOneWidget);

    await tester.tap(find.text('J’ai déjà un compte'));
    await tester.pumpAndSettle();

    expect(find.text('Apprenez des mots en musique'), findsOneWidget);
    expect(find.text('Connexion'), findsOneWidget);
  });
}
