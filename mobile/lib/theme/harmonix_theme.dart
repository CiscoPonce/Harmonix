import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Harmonix palette — forest green brand, soft light surfaces, deep dark mode.
class HarmonixColors {
  const HarmonixColors._({
    required this.background,
    required this.surface,
    required this.textPrimary,
    required this.textMuted,
    required this.accent,
    required this.border,
    required this.onAccent,
  });

  final Color background;
  final Color surface;
  final Color textPrimary;
  final Color textMuted;
  final Color accent;
  final Color border;
  final Color onAccent;

  /// Brand green (light theme primary). Use `of(context).accent` in widgets.
  static const brand = Color(0xFF0B6B3A);

  static const _light = HarmonixColors._(
    background: Color(0xFFF4F7F5),
    surface: Color(0xFFFFFFFF),
    textPrimary: Color(0xFF121612),
    textMuted: Color(0xFF5C6B62),
    accent: brand,
    border: Color(0xFFD7E0DA),
    onAccent: Color(0xFFFFFFFF),
  );

  static const _dark = HarmonixColors._(
    background: Color(0xFF0C1210),
    surface: Color(0xFF171E1B),
    textPrimary: Color(0xFFF2F5F3),
    textMuted: Color(0xFF9AABA0),
    accent: Color(0xFF3DCF7A),
    border: Color(0xFF2A3530),
    onAccent: Color(0xFF062214),
  );

  static HarmonixColors of(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark ? _dark : _light;
  }
}

ThemeData buildHarmonixTheme({required Brightness brightness}) {
  final colors = brightness == Brightness.dark ? HarmonixColors._dark : HarmonixColors._light;
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: ColorScheme(
      brightness: brightness,
      primary: colors.accent,
      onPrimary: colors.onAccent,
      secondary: colors.accent,
      onSecondary: colors.onAccent,
      error: const Color(0xFFD32F2F),
      onError: Colors.white,
      surface: colors.surface,
      onSurface: colors.textPrimary,
    ),
    scaffoldBackgroundColor: colors.background,
    cardColor: colors.surface,
    dividerColor: colors.border,
  );

  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
      displayLarge: GoogleFonts.inter(
        fontSize: 48,
        fontWeight: FontWeight.w900,
        fontStyle: FontStyle.italic,
        color: colors.textPrimary,
      ),
      headlineMedium: GoogleFonts.inter(
        fontSize: 22,
        fontWeight: FontWeight.w800,
        fontStyle: FontStyle.italic,
        color: colors.accent,
      ),
      titleSmall: GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: colors.textMuted,
      ),
      bodyLarge: GoogleFonts.inter(
        fontSize: 16,
        color: colors.textMuted,
      ),
      bodyMedium: GoogleFonts.inter(
        fontSize: 14,
        color: colors.textPrimary,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: colors.background,
      foregroundColor: colors.textPrimary,
      elevation: 0,
      centerTitle: true,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: colors.surface,
      indicatorColor: colors.accent.withValues(alpha: 0.18),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: selected ? colors.accent : colors.textMuted,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(color: selected ? colors.accent : colors.textMuted);
      }),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.accent, width: 2),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) {
        return s.contains(WidgetState.selected) ? colors.onAccent : colors.surface;
      }),
      trackColor: WidgetStateProperty.resolveWith((s) {
        return s.contains(WidgetState.selected) ? colors.accent : colors.border;
      }),
    ),
  );
}

ThemeData buildHarmonixLightTheme() => buildHarmonixTheme(brightness: Brightness.light);
ThemeData buildHarmonixDarkTheme() => buildHarmonixTheme(brightness: Brightness.dark);
