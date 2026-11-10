import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

/// Last fetched recent words and daily word for offline reading.
class OfflineWordCache {
  OfflineWordCache(this._prefs);

  static const _recentKey = 'harmonix_recent_words_v1';
  static const _dailyKey = 'harmonix_last_daily_word_v1';
  static const _pendingReviewsKey = 'harmonix_pending_reviews_v1';

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

  List<Map<String, dynamic>> loadPendingReviews() {
    final raw = _prefs.getString(_pendingReviewsKey);
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

  Future<void> enqueuePendingReviews(List<Map<String, dynamic>> items) async {
    if (items.isEmpty) return;
    final existing = loadPendingReviews();
    existing.addAll(items);
    await _prefs.setString(_pendingReviewsKey, jsonEncode(existing));
  }

  Future<void> clearPendingReviews() async {
    await _prefs.remove(_pendingReviewsKey);
  }

  Future<void> flushPendingReviews(ApiClient api) async {
    final pending = loadPendingReviews();
    if (pending.isEmpty) return;
    await api.progressReview(pending);
    await clearPendingReviews();
  }
}

bool looksLikeOfflineError(Object error) {
  final msg = error.toString().toLowerCase();
  return msg.contains('socketexception') ||
      msg.contains('failed host lookup') ||
      msg.contains('network is unreachable') ||
      msg.contains('connection refused');
}
