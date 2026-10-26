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
    expect(find.text('Register'), findsOneWidget);
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
}
