import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/settings_screen.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/state/auth_state.dart';
import 'package:harmonix_mobile/state/home_navigation_controller.dart';
import 'package:harmonix_mobile/state/theme_controller.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

class _MemorySecureStorage extends FlutterSecureStorage {
  _MemorySecureStorage() : super();

  final Map<String, String> store = {};

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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Settings renders username, bio, and streak in the account header', (tester) async {
    final storage = _MemorySecureStorage();
    http.Response jsonOk(String body) => http.Response(
          body,
          200,
          headers: {'content-type': 'application/json'},
        );
    final api = ApiClient(
      storage: storage,
      client: MockClient((request) async {
        if (request.url.path.contains('/progress/stats')) {
          return jsonOk(
            '{"streak_days":4,"total_words":12,"days_learned":3,"words_reviewed":2,"today_words":1,"daily_goal":10}',
          );
        }
        if (request.url.path.contains('/badges')) {
          return jsonOk(
            '{"badges":[{"id":"vocab_50","name":"50 Words","description":"Get 50 words","unlocked":0,"progress":12,"target":50}]}',
          );
        }
        if (request.url.path.contains('/spotify/status')) {
          return jsonOk('{"status":"disconnected"}');
        }
        return jsonOk('{}');
      }),
    );
    final auth = AuthState(api)
      ..user = {
        'email': 'ada@example.com',
        'username': 'ada_1',
        'bio': 'Songs and words',
        'has_avatar': false,
      };

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<ApiClient>.value(value: api),
          ChangeNotifierProvider<AuthState>.value(value: auth),
          ChangeNotifierProvider(create: (_) => ThemeController()),
          ChangeNotifierProvider(create: (_) => HomeNavigationController()),
        ],
        child: MaterialApp(
          theme: buildHarmonixTheme(brightness: Brightness.light),
          home: const Scaffold(body: SettingsScreen()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ada_1'), findsOneWidget);
    expect(find.text('Songs and words'), findsOneWidget);
    expect(find.text('ada@example.com'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    expect(find.text('50 Words'), findsOneWidget);
    expect(find.text('12/50'), findsOneWidget);
    expect(find.text('1/10'), findsNothing);
  });

  testWidgets('Settings localizes badge titles in Spanish and supports Delete account', (tester) async {
    final storage = _MemorySecureStorage();
    var deleteCalled = false;
    http.Response jsonOk(String body) => http.Response(
          body,
          200,
          headers: {'content-type': 'application/json'},
        );
    final api = ApiClient(
      storage: storage,
      client: MockClient((request) async {
        if (request.method == 'DELETE' && request.url.path.contains('/user/account')) {
          deleteCalled = true;
          return http.Response('', 204);
        }
        if (request.url.path.contains('/progress/stats')) {
          return jsonOk(
            '{"streak_days":2,"total_words":5,"days_learned":2,"words_reviewed":3,"today_words":1,"daily_goal":10}',
          );
        }
        if (request.url.path.contains('/badges')) {
          return jsonOk(
            '{"badges":[{"id":"review_10","name":"10 Reviews","description":"Review 10 words","unlocked":0,"progress":3,"target":10}]}',
          );
        }
        if (request.url.path.contains('/spotify/status')) {
          return jsonOk('{"status":"disconnected"}');
        }
        return jsonOk('{}');
      }),
    );
    final auth = AuthState(api)
      ..user = {
        'email': 'carlos@example.com',
        'username': 'carlos_es',
        'native_language': 'es',
        'target_language': 'en',
        'has_avatar': false,
      };

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<ApiClient>.value(value: api),
          ChangeNotifierProvider<AuthState>.value(value: auth),
          ChangeNotifierProvider(create: (_) => ThemeController()),
          ChangeNotifierProvider(create: (_) => HomeNavigationController()),
        ],
        child: MaterialApp(
          theme: buildHarmonixTheme(brightness: Brightness.light),
          home: const Scaffold(body: SettingsScreen()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('10 repasos'), findsOneWidget);
    expect(find.text('Repasa 10 palabras'), findsOneWidget);
    expect(find.text('3/10'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Eliminar cuenta'),
      300,
    );
    await tester.tap(find.text('Eliminar cuenta'));
    await tester.pumpAndSettle();

    expect(find.text('Eliminar mi cuenta permanentemente'), findsOneWidget);
    await tester.tap(find.text('Eliminar mi cuenta permanentemente'));
    await tester.pumpAndSettle();

    expect(deleteCalled, isTrue);
  });
}
