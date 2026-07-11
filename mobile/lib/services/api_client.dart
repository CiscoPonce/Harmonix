import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// API base without trailing slash. Override at build time:
/// `flutter run --dart-define=API_BASE=https://your-host/api`
const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://moral-sparrow-nationally.ngrok-free.app/api',
);

class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;
  @override
  String toString() => message;
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

  Map<String, String> _headers({bool jsonBody = false}) {
    final headers = <String, String>{
      'Accept': 'application/json',
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
      throw ApiException(
        (data['error'] as String?) ?? 'Request failed (${res.statusCode})',
        status: res.statusCode,
      );
    }
    return data;
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
}
