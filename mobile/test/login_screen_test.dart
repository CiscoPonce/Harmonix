import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/login_screen.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';

Future<void> _pumpLogin(WidgetTester tester, Brightness brightness) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: buildHarmonixTheme(brightness: brightness),
      home: const LoginScreen(),
    ),
  );
}

FilledButton _loginButton(WidgetTester tester) {
  return tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Login'));
}

void main() {
  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('Login lights up after the password is entered ($brightness)', (tester) async {
      await _pumpLogin(tester, brightness);
      final colors = HarmonixColors.of(tester.element(find.byType(LoginScreen)));

      expect(_loginButton(tester).onPressed, isNull);
      expect(
        _loginButton(tester).style?.backgroundColor?.resolve({WidgetState.disabled}),
        colors.border,
      );
      expect(colors.border, isNot(colors.accent));

      await tester.enterText(find.byType(TextField).at(0), 'ada@example.com');
      await tester.pump();
      expect(_loginButton(tester).onPressed, isNull);

      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.pump();

      final ready = _loginButton(tester);
      expect(ready.onPressed, isNotNull);
      expect(ready.style?.backgroundColor?.resolve({}), colors.accent);
      expect(ready.style?.foregroundColor?.resolve({}), colors.onAccent);

      if (brightness == Brightness.dark) {
        expect(colors.accent, const Color(0xFF3DCF7A));
      } else {
        expect(colors.accent, HarmonixColors.brand);
      }
    });
  }
}
