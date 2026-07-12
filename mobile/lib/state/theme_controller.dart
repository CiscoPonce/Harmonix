import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists app-wide light / dark preference (Settings → profile).
class ThemeController extends ChangeNotifier {
  ThemeController();

  static const _key = 'theme_mode';

  ThemeMode _mode = ThemeMode.light;
  bool _ready = false;

  ThemeMode get mode => _mode;
  bool get ready => _ready;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key) ?? 'light';
    _mode = switch (raw) {
      'dark' => ThemeMode.dark,
      'system' => ThemeMode.system,
      _ => ThemeMode.light,
    };
    _ready = true;
    notifyListeners();
  }

  Future<void> setDarkMode(bool enabled) async {
    await setMode(enabled ? ThemeMode.dark : ThemeMode.light);
  }

  Future<void> setMode(ThemeMode mode) async {
    _mode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    final value = switch (mode) {
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
      ThemeMode.light => 'light',
    };
    await prefs.setString(_key, value);
  }
}
