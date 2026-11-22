import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/i18n.dart';

/// Persists an optional pre-login language override and observes system locale changes.
class LocaleController extends ChangeNotifier with WidgetsBindingObserver {
  LocaleController() {
    WidgetsBinding.instance.addObserver(this);
  }

  static const _key = 'pre_login_lang';

  String? _overrideLang;
  String _deviceLang = AppI18n.detectDeviceLanguage();

  String? get overrideLang => _overrideLang;
  String get deviceLang => _deviceLang;
  String get effectivePreLoginLang => _overrideLang ?? _deviceLang;

  @override
  void didChangeLocales(List<Locale>? locales) {
    final next = AppI18n.detectDeviceLanguage(locales);
    if (next != _deviceLang) {
      _deviceLang = next;
      notifyListeners();
    }
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _overrideLang = AppI18n.normalizeSupportedCode(prefs.getString(_key));
    _deviceLang = AppI18n.detectDeviceLanguage();
    notifyListeners();
  }

  Future<void> setOverrideLang(String? code) async {
    final normalized = AppI18n.normalizeSupportedCode(code);
    if (_overrideLang == normalized) return;
    _overrideLang = normalized;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    if (normalized == null) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, normalized);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
