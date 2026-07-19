import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/home_shell.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/state/auth_state.dart';
import 'package:harmonix_mobile/state/home_navigation_controller.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_LINK';

const kApprovedHost = 'moral-sparrow-nationally.ngrok-free.app';

/// Explicit constructor contract for OAuth completion → Library selection (D-12-04).
class HomeShellArgs {
  const HomeShellArgs({
    this.initialTabIndex,
    this.selectLibraryAfterSpotifyLink = false,
  });

  final int? initialTabIndex;
  final bool selectLibraryAfterSpotifyLink;
}

/// Factory hook — returns null until HomeShell accepts post-OAuth Library selection.
Widget? buildHomeShellForSpotifyLink(HomeShellArgs args) {
  return HomeShell(
    initialTabIndex: args.initialTabIndex,
    selectLibraryAfterSpotifyLink: args.selectLibraryAfterSpotifyLink,
  );
}

Widget _harness(Widget child, {HomeNavigationController? nav}) {
  final client = ApiClient(
    client: MockClient((request) async {
      if (request.url.path.endsWith('/playlists')) {
        return http.Response('[]', 200);
      }
      if (request.url.path.contains('daily-words') ||
          request.url.path.contains('daily-word')) {
        return http.Response('{"recent":[]}', 200);
      }
      if (request.url.path.contains('progress') ||
          request.url.path.contains('badges') ||
          request.url.path.contains('spotify')) {
        return http.Response('{"status":"disconnected"}', 200);
      }
      return http.Response('{}', 200);
    }),
  );
  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: client),
      ChangeNotifierProvider(create: (_) => AuthState(client)),
      ChangeNotifierProvider(
        create: (_) => nav ?? HomeNavigationController(),
      ),
    ],
    child: MaterialApp(
      theme: buildHarmonixTheme(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  test('Learn remains the ordinary default tab index (2)', () {
    final nav = HomeNavigationController();
    expect(nav.index, HomeNavigationController.learnIndex);
    expect(HomeNavigationController.learnIndex, 2);
    expect(HomeNavigationController.libraryIndex, 1);
    expect(HomeNavigationController.settingsIndex, 3);
  });

  test('success App Link selects Library once; duplicate delivery is ignored', () {
    final nav = HomeNavigationController();
    final uri = Uri.parse(
      'https://$kApprovedHost/app/library?spotify=connected',
    );
    expect(nav.handleIncomingUri(uri), isTrue);
    expect(nav.index, HomeNavigationController.libraryIndex);
    expect(nav.handleIncomingUri(uri), isFalse);
    expect(nav.index, HomeNavigationController.libraryIndex);
  });

  test('cancellation/error App Link selects Settings once with allowlisted reason', () {
    final nav = HomeNavigationController();
    final uri = Uri.parse(
      'https://$kApprovedHost/app/settings?spotify=error',
    );
    expect(nav.handleIncomingUri(uri), isTrue);
    expect(nav.index, HomeNavigationController.settingsIndex);
    expect(nav.consumeRecoveryReason(), 'error');
    expect(nav.consumeRecoveryReason(), isNull);
    expect(nav.handleIncomingUri(uri), isFalse);
  });

  test('cancelled outcome maps to Settings recovery without secrets', () {
    final nav = HomeNavigationController();
    final uri = Uri.parse(
      'https://$kApprovedHost/app/settings?spotify=cancelled&code=SECRET&state=SECRET',
    );
    expect(nav.handleIncomingUri(uri), isTrue);
    expect(nav.index, HomeNavigationController.settingsIndex);
    expect(nav.consumeRecoveryReason(), 'error');
  });

  test('unknown hosts/paths and secret query payloads do not navigate', () {
    final nav = HomeNavigationController();
    final baseline = nav.index;
    final rejected = [
      Uri.parse('https://evil.example/app/library?spotify=connected'),
      Uri.parse('https://$kApprovedHost/app/other?spotify=connected'),
      Uri.parse('https://$kApprovedHost/app/library?code=abc&state=xyz'),
      Uri.parse('https://$kApprovedHost/app/library'),
      Uri.parse('harmonix://library?spotify=connected'),
    ];
    for (final uri in rejected) {
      expect(nav.handleIncomingUri(uri), isFalse, reason: uri.toString());
      expect(nav.index, baseline);
      expect(nav.consumeRecoveryReason(), isNull);
    }
  });

  testWidgets('cold start OAuth completion selects Library once', (tester) async {
    final shell = buildHomeShellForSpotifyLink(
      const HomeShellArgs(selectLibraryAfterSpotifyLink: true),
    );
    if (shell == null) {
      fail('$kSentinel: HomeShell selectLibraryAfterSpotifyLink cold-start missing');
    }
    final nav = HomeNavigationController();
    await tester.pumpWidget(_harness(shell, nav: nav));
    await tester.pumpAndSettle();
    expect(nav.index, HomeNavigationController.libraryIndex);
    expect(find.text('Library'), findsWidgets);
  });

  testWidgets('warm start OAuth completion selects Library once', (tester) async {
    final shell = buildHomeShellForSpotifyLink(
      const HomeShellArgs(
        initialTabIndex: 3,
        selectLibraryAfterSpotifyLink: true,
      ),
    );
    if (shell == null) {
      fail('$kSentinel: HomeShell selectLibraryAfterSpotifyLink warm-start missing');
    }
    final nav = HomeNavigationController();
    await tester.pumpWidget(_harness(shell, nav: nav));
    await tester.pumpAndSettle();
    expect(nav.index, HomeNavigationController.libraryIndex);
    expect(find.text('Library'), findsWidgets);
  });

  testWidgets('ordinary launch selects Learn', (tester) async {
    final nav = HomeNavigationController();
    await tester.pumpWidget(_harness(const HomeShell(), nav: nav));
    await tester.pumpAndSettle();
    expect(nav.index, HomeNavigationController.learnIndex);
    expect(find.text('Learn'), findsWidgets);
  });
}
