import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/state/auth_state.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class _MemorySecureStorage extends FlutterSecureStorage {
  _MemorySecureStorage(this.store) : super();

  final Map<String, String> store;

  @override
  Future<void> write({
    required String key,
    required String? value,
    AndroidOptions? aOptions,
    IOSOptions? iOptions,
    LinuxOptions? lOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
    WebOptions? webOptions,
  }) async {
    if (value == null) {
      store.remove(key);
    } else {
      store[key] = value;
    }
  }

  @override
  Future<String?> read({
    required String key,
    AndroidOptions? aOptions,
    IOSOptions? iOptions,
    LinuxOptions? lOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
    WebOptions? webOptions,
  }) async =>
      store[key];

  @override
  Future<void> delete({
    required String key,
    AndroidOptions? aOptions,
    IOSOptions? iOptions,
    LinuxOptions? lOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
    WebOptions? webOptions,
  }) async {
    store.remove(key);
  }
}

const _profile = {'id': 'u1', 'email': 'a@b.c', 'native_language': 'en', 'target_language': 'es'};

Map<String, String> _signedInStore() => {
      'access_token': 'old-access',
      'refresh_token': 'old-refresh',
      'user_profile': jsonEncode(_profile),
    };

AuthState _auth(Map<String, String> store, Future<http.Response> Function(http.Request) handler) {
  final api = ApiClient(client: MockClient(handler), storage: _MemorySecureStorage(store));
  return AuthState(api);
}

void main() {
  test('opening offline keeps the login and uses the saved profile', () async {
    final store = _signedInStore();
    final auth = _auth(store, (_) async => throw const SocketException('Failed host lookup'));

    await auth.bootstrap();

    expect(auth.isAuthenticated, isTrue);
    expect(auth.user?['email'], 'a@b.c');
    expect(store['refresh_token'], 'old-refresh');
  });

  test('a server error during startup keeps the login', () async {
    final store = _signedInStore();
    final auth = _auth(store, (_) async => http.Response('{"error":"down"}', 502));

    await auth.bootstrap();

    expect(auth.isAuthenticated, isTrue);
    expect(store['refresh_token'], 'old-refresh');
  });

  test('a rejected refresh token signs out', () async {
    final store = _signedInStore();
    final auth = _auth(store, (_) async => http.Response('', 403));

    await auth.bootstrap();

    expect(auth.isAuthenticated, isFalse);
    expect(store, isEmpty);
  });

  test('a session that expires mid-use returns to sign-in', () async {
    final store = _signedInStore();
    var expired = false;
    final auth = _auth(store, (request) async {
      if (request.url.path.endsWith('/auth/refresh')) {
        return expired
            ? http.Response('', 401)
            : http.Response('{"accessToken":"new","refreshToken":"r2"}', 200);
      }
      if (request.url.path.endsWith('/auth/me')) {
        return http.Response(jsonEncode(_profile), 200);
      }
      return http.Response('', 401);
    });
    await auth.bootstrap();
    expect(auth.isAuthenticated, isTrue);

    var notified = false;
    auth.addListener(() => notified = true);
    expired = true;
    await expectLater(auth.api.request('GET', '/daily-word'), throwsA(isA<ApiException>()));

    expect(notified, isTrue);
    expect(auth.isAuthenticated, isFalse);
  });
}
