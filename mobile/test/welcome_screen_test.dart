import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/welcome_screen.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';

void main() {
  testWidgets('Get Started Free opens account creation', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildHarmonixTheme(brightness: Brightness.dark),
        home: const WelcomeScreen(),
      ),
    );

    await tester.tap(find.text('Get Started Free'));
    await tester.pumpAndSettle();

    expect(find.text('Create your account'), findsOneWidget);
    expect(find.text('Register'), findsOneWidget);
  });
}
