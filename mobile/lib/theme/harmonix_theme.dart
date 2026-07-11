import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Light + dark-green tokens from the Flutter Learn screenshot (source of truth).
class HarmonixColors {
  static const background = Color(0xFFFFFFFF);
  static const textPrimary = Color(0xFF111111);
  static const textMuted = Color(0xFF6B6B6B);
  static const accent = Color(0xFF006432);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFE5E5E5);
}

ThemeData buildHarmonixTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.light(
      primary: HarmonixColors.accent,
      onPrimary: Colors.white,
      surface: HarmonixColors.surface,
      onSurface: HarmonixColors.textPrimary,
    ),
    scaffoldBackgroundColor: HarmonixColors.background,
  );

  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
      displayLarge: GoogleFonts.inter(
        fontSize: 48,
        fontWeight: FontWeight.w900,
        fontStyle: FontStyle.italic,
        color: HarmonixColors.textPrimary,
      ),
      headlineMedium: GoogleFonts.inter(
        fontSize: 22,
        fontWeight: FontWeight.w800,
        fontStyle: FontStyle.italic,
        color: HarmonixColors.accent,
      ),
      titleSmall: GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: HarmonixColors.textMuted,
      ),
      bodyLarge: GoogleFonts.inter(
        fontSize: 16,
        color: HarmonixColors.textMuted,
      ),
      bodyMedium: GoogleFonts.inter(
        fontSize: 14,
        color: HarmonixColors.textPrimary,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: HarmonixColors.background,
      foregroundColor: HarmonixColors.textPrimary,
      elevation: 0,
      centerTitle: true,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HarmonixColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HarmonixColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HarmonixColors.accent, width: 2),
      ),
    ),
  );
}
