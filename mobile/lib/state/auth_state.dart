import 'package:flutter/foundation.dart';

import '../services/api_client.dart';

class AuthState extends ChangeNotifier {
  AuthState(this.api);

  final ApiClient api;
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;

  bool get isAuthenticated => api.accessToken != null && user != null;
  bool get needsOnboarding =>
      isAuthenticated && (user?['native_language'] == null || user?['native_language'] == '');

  Future<void> bootstrap() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await api.loadSession();
      if (api.accessToken != null) {
        final ok = await api.refresh();
        if (ok || api.accessToken != null) {
          user = await api.me();
        }
      }
    } catch (e) {
      await api.clearSession();
      user = null;
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
        user = await api.me();
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
    user = await api.me();
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    user = null;
    notifyListeners();
  }

  Future<void> refreshUser() async {
    user = await api.me();
    notifyListeners();
  }
}
