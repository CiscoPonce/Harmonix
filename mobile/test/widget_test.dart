import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';

void main() {
  test('design tokens match screenshot palette', () {
    expect(HarmonixColors.background, const Color(0xFFFFFFFF));
    expect(HarmonixColors.accent, const Color(0xFF006432));
    expect(HarmonixColors.textPrimary, const Color(0xFF111111));
  });
}
