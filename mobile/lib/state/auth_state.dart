import 'package:flutter/foundation.dart';

import '../services/api_client.dart';

class AuthState extends ChangeNotifier {
  AuthState(this.api) {
    api.onSessionExpired = _sessionExpired;
  }

  void _sessionExpired() {
    if (user == null) return;
    user = null;
    notifyListeners();
  }

  final ApiClient api;
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;

  bool get isAuthenticated => api.accessToken != null && user != null;

  bool _blank(dynamic v) => v == null || v.toString().trim().isEmpty;

  bool get needsOnboarding =>
      isAuthenticated && (_blank(user?['native_language']) || _blank(user?['target_language']));

  Future<void> _loadMe() async {
    user = await api.me();
    try {
      await api.saveProfile(user!);
    } catch (_) {}
  }

  Future<void> bootstrap() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await api.loadSession();
      if (api.accessToken != null) {
        await api.refresh();
        if (api.accessToken != null) {
          await _loadMe();
        }
      }
    } on ApiException catch (e) {
      if (e.status == 401 || e.status == 403) {
        await api.clearSession();
        user = null;
      } else {
        user = await api.loadProfile();
      }
    } catch (_) {
      user = await api.loadProfile();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    error = null;
    notifyListeners();
    try {
      final data = await api.login(email, password);
      user = (data['user'] as Map<String, dynamic>?) ?? await api.me();
      // Prefer full profile from /me
      try {
        await _loadMe();
      } catch (_) {}
      notifyListeners();
    } on ApiException catch (e) {
      error = e.message;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> register(String email, String password) async {
    error = null;
    notifyListeners();
    await api.register(email, password);
    await login(email, password);
  }

  Future<void> savePreferences(Map<String, String> prefs) async {
    await api.patchPreferences(prefs);
    await _loadMe();
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    user = null;
    notifyListeners();
  }

  Future<void> refreshUser() async {
    await _loadMe();
    notifyListeners();
  }
}
