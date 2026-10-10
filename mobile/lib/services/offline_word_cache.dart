import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Last fetched recent words and daily word for offline reading.
class OfflineWordCache {
  OfflineWordCache(this._prefs);

  static const _recentKey = 'harmonix_recent_words_v1';
  static const _dailyKey = 'harmonix_last_daily_word_v1';

  final SharedPreferences _prefs;

  static Future<OfflineWordCache> open() async {
    return OfflineWordCache(await SharedPreferences.getInstance());
  }

  List<Map<String, dynamic>> loadRecentWords() {
    final raw = _prefs.getString(_recentKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveRecentWords(List<Map<String, dynamic>> items) async {
    await _prefs.setString(_recentKey, jsonEncode(items));
  }

  Map<String, dynamic>? loadLastDailyWord() {
    final raw = _prefs.getString(_dailyKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  Future<void> saveLastDailyWord(Map<String, dynamic> payload) async {
    await _prefs.setString(_dailyKey, jsonEncode(payload));
  }
}

bool looksLikeOfflineError(Object error) {
  final msg = error.toString().toLowerCase();
  return msg.contains('socketexception') ||
      msg.contains('failed host lookup') ||
      msg.contains('network is unreachable') ||
      msg.contains('connection refused');
}
