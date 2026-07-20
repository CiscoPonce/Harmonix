import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../spotify/spotify_contracts.dart';

/// API base without trailing slash. Override at build time:
/// `flutter run --dart-define=API_BASE=https://your-domain/api`
const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://moral-sparrow-nationally.ngrok-free.app/api',
);

class ApiException implements Exception {
  ApiException(
    this.message, {
    this.status,
    this.reason,
    this.queue,
    this.retryAfterSec,
  });

  final String message;
  final int? status;
  final String? reason;
  final Map<String, dynamic>? queue;
  final int? retryAfterSec;

  @override
  String toString() => message;
}

String friendlyDailyWordError({
  String? reason,
  int? retryAfterSec,
  String? fallback,
}) {
  switch (reason) {
    case 'invalid_ai_daily_word_response':
      return "Couldn't find a new word in a song right now. Try again in a minute.";
    case 'daily_word_generation_failed':
    case 'generation_failed':
      return "Couldn't find a new word in a song right now. Please try again shortly.";
    case 'ai_rate_limit':
      return 'AI is busy (rate limit). Please wait a minute and try again.';
    case 'cooldown_active':
      return retryAfterSec != null
          ? 'Please wait $retryAfterSec seconds before requesting another word.'
          : 'Please wait a moment before requesting another word.';
    case 'batch_in_progress':
      return 'Still generating your word — please wait a moment.';
    default:
      if (reason != null && reason.contains('429')) {
        return 'AI is busy (rate limit). Please wait a minute and try again.';
      }
      return fallback ?? reason ?? 'Could not load daily word';
  }
}

class ApiClient {
  ApiClient({http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  final http.Client _client;
  final FlutterSecureStorage _storage;
  String? _accessToken;
  String? _refreshToken;

  String? get accessToken => _accessToken;

  Future<void> loadSession() async {
    _accessToken = await _storage.read(key: 'access_token');
    _refreshToken = await _storage.read(key: 'refresh_token');
  }

  Future<void> _persistTokens({String? access, String? refresh}) async {
    _accessToken = access;
    if (access == null) {
      await _storage.delete(key: 'access_token');
    } else {
      await _storage.write(key: 'access_token', value: access);
    }
    if (refresh != null) {
      _refreshToken = refresh;
      await _storage.write(key: 'refresh_token', value: refresh);
    }
  }

  Future<void> clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = kApiBase.endsWith('/') ? kApiBase.substring(0, kApiBase.length - 1) : kApiBase;
    final normalized = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$normalized').replace(queryParameters: query);
  }

  Map<String, String> _headers({bool jsonBody = false, String? accept}) {
    final headers = <String, String>{
      'Accept': accept ?? 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
    if (jsonBody) headers['Content-Type'] = 'application/json';
    if (_accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    return headers;
  }

  Future<Map<String, dynamic>> _decode(http.Response res) async {
    if (res.body.isEmpty) return {};
    final contentType = res.headers['content-type'] ?? '';
    if (!contentType.contains('application/json')) {
      throw ApiException('Unexpected response (${res.statusCode})');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is List) return {'items': decoded};
    return {};
  }

  ApiException _apiError(Map<String, dynamic> data, int status) {
    final reason = data['reason'] as String?;
    final queue = data['queue'] is Map<String, dynamic>
        ? data['queue'] as Map<String, dynamic>
        : null;
    final retry = (data['retryAfterSec'] as num?)?.toInt() ??
        (data['retry_after'] as num?)?.toInt();
    final rawError = data['error'] as String?;
    final message = (rawError == 'daily_word_unavailable' ||
            (reason != null &&
                (reason.contains('daily') || reason.contains('ai_'))))
        ? friendlyDailyWordError(
            reason: reason ?? rawError,
            retryAfterSec: retry,
            fallback: rawError,
          )
        : (rawError ?? 'Request failed ($status)');
    return ApiException(
      message,
      status: status,
      reason: reason ?? rawError,
      queue: queue,
      retryAfterSec: retry,
    );
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool authRetry = true,
  }) async {
    final uri = _uri(path, query);
    late http.Response res;
    final headers = _headers(jsonBody: body != null);
    final encoded = body == null ? null : jsonEncode(body);

    switch (method.toUpperCase()) {
      case 'GET':
        res = await _client.get(uri, headers: headers);
        break;
      case 'POST':
        res = await _client.post(uri, headers: headers, body: encoded);
        break;
      case 'PATCH':
        res = await _client.patch(uri, headers: headers, body: encoded);
        break;
      case 'DELETE':
        res = await _client.delete(uri, headers: headers);
        break;
      default:
        throw ApiException('Unsupported method $method');
    }

    if (res.statusCode == 401 && authRetry && !path.contains('/auth/')) {
      final refreshed = await refresh();
      if (refreshed) {
        return request(method, path, body: body, query: query, authRetry: false);
      }
    }

    final data = await _decode(res);
    if (res.statusCode >= 400) {
      throw _apiError(data, res.statusCode);
    }
    return data;
  }

  /// Authenticated binary GET for Pocket-TTS WAV pronunciation.
  Future<Uint8List> pronounceWord(String word, {bool authRetry = true}) async {
    final uri = _uri('/daily-word/pronounce', {'word': word});
    final res = await _client.get(
      uri,
      headers: _headers(accept: 'audio/wav, application/json'),
    );

    if (res.statusCode == 401 && authRetry) {
      final refreshed = await refresh();
      if (refreshed) return pronounceWord(word, authRetry: false);
    }

    if (res.statusCode >= 400) {
      Map<String, dynamic> data = {};
      try {
        data = await _decode(res);
      } catch (_) {}
      throw ApiException(
        (data['error'] as String?) ?? 'Pronunciation unavailable (${res.statusCode})',
        status: res.statusCode,
        reason: data['error'] as String?,
      );
    }

    final contentType = res.headers['content-type'] ?? '';
    if (contentType.contains('application/json') || contentType.contains('text/html')) {
      Map<String, dynamic> data = {};
      try {
        data = await _decode(res);
      } catch (_) {}
      throw ApiException(
        (data['error'] as String?) ?? 'Pronunciation unavailable (bad response)',
        status: res.statusCode,
      );
    }

    final bytes = res.bodyBytes;
    // WAV should start with RIFF
    final isRiff = bytes.length >= 12 &&
        bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46;
    if (!isRiff) {
      throw ApiException('Pronunciation audio was invalid (${bytes.length} bytes)');
    }
    return bytes;
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await request('POST', '/auth/login', body: {
      'email': email,
      'password': password,
    }, authRetry: false);
    await _persistTokens(
      access: data['accessToken'] as String?,
      refresh: data['refreshToken'] as String?,
    );
    return data;
  }

  Future<void> register(String email, String password) async {
    await request('POST', '/auth/register', body: {
      'email': email,
      'password': password,
    }, authRetry: false);
  }

  Future<bool> refresh() async {
    if (_refreshToken == null) return false;
    try {
      final data = await request(
        'POST',
        '/auth/refresh',
        body: {'refreshToken': _refreshToken},
        authRetry: false,
      );
      final token = data['accessToken'] as String?;
      if (token != null) {
        await _persistTokens(
          access: token,
          refresh: data['refreshToken'] as String? ?? _refreshToken,
        );
        return true;
      }
    } catch (_) {}
    await clearSession();
    return false;
  }

  Future<Map<String, dynamic>> me() => request('GET', '/auth/me');

  Future<void> logout() async {
    try {
      await request('POST', '/auth/logout', authRetry: false);
    } catch (_) {}
    await clearSession();
  }

  Future<Map<String, dynamic>> patchPreferences(Map<String, String> body) =>
      request('PATCH', '/user/preferences', body: body);

  Future<Map<String, dynamic>> getDailyWord() => request('GET', '/daily-word');

  Future<Map<String, dynamic>> nextDailyWord() => request('POST', '/daily-word/next');

  Future<Map<String, dynamic>> queueStatus() => request('GET', '/daily-word/queue-status');

  Future<Map<String, dynamic>> recentDailyWords({int days = 7}) =>
      request('GET', '/daily-word/recent', query: {'days': '$days'});

  Future<Map<String, dynamic>> progressStats() => request('GET', '/progress/stats');

  Future<List<dynamic>> searchSongs(String q) async {
    final data = await request('GET', '/search', query: {'q': q});
    final items = data['data'] ?? data['items'] ?? data['results'];
    if (items is List) return items;
    return [];
  }

  Future<List<dynamic>> playlists() async {
    final data = await request('GET', '/playlists');
    final items = data['playlists'] ?? data['items'];
    if (items is List) return items;
    return [];
  }

  Future<Map<String, dynamic>> getPlaylist(String id) =>
      request('GET', '/playlists/$id');

  Future<Map<String, dynamic>> createPlaylist(String name) =>
      request('POST', '/playlists', body: {'name': name});

  Future<List<dynamic>> badges() async {
    final data = await request('GET', '/badges');
    final items = data['badges'] ?? data['items'];
    if (items is List) return items;
    return [];
  }

  String resolveMediaUrl(String pathOrUrl) {
    if (pathOrUrl.startsWith('http')) return pathOrUrl;
    final root = kApiBase.replaceAll(RegExp(r'/api/?$'), '');
    if (pathOrUrl.startsWith('/')) return '$root$pathOrUrl';
    return '$root/$pathOrUrl';
  }

  String playerUrlForSongId(String id) {
    final root = kApiBase.replaceAll(RegExp(r'/api/?$'), '');
    return '$root/player/$id';
  }

  /// Backend-owned Spotify status. Never includes provider tokens.
  Future<SpotifyConnectionStatus> spotifyStatus() async {
    final data = await request('GET', '/spotify/status');
    return parseSpotifyStatusResponse(data);
  }

  /// Start OAuth for Android; returns validated accounts.spotify.com URL only.
  Future<String> spotifyAuthStart({String client = 'android'}) async {
    final data = await request(
      'POST',
      '/spotify/auth/start',
      body: {'client': client},
    );
    return parseSpotifyAuthStartResponse(data);
  }

  /// Disconnect Spotify. Caller must wait for success before clearing UI.
  Future<void> disconnectSpotify() async {
    await request('DELETE', '/spotify/connection');
  }

  /// List Spotify playlists via authenticated sync. Provider credentials stay on server.
  Future<SpotifyPlaylistListResult> spotifyPlaylists() async {
    final data = await request('GET', '/spotify/playlists');
    return parseSpotifyPlaylistListResponse(data);
  }

  /// Provider-aware Spotify playlist detail. Never treats ID as a Harmonix playlist.
  Future<SpotifyPlaylistDetail> spotifyPlaylistDetail(String providerId) async {
    final data = await request(
      'GET',
      '/spotify/playlists/${Uri.encodeComponent(providerId)}',
    );
    return parsePlaylistDetailDto(data);
  }
}
