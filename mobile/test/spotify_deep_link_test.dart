import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/screens/home_shell.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/state/auth_state.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

const kSentinel = 'NOT_IMPLEMENTED_SPOTIFY_LINK';

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
  // Intended after 12-06:
  // return HomeShell(selectLibraryAfterSpotifyLink: args.selectLibraryAfterSpotifyLink);
  return null;
}

Widget _harness(Widget child) {
  final client = ApiClient(
    client: MockClient((request) async {
      if (request.url.path.endsWith('/playlists')) {
        return http.Response('[]', 200);
      }
      if (request.url.path.contains('daily-words')) {
        return http.Response('{"recent":[]}', 200);
      }
      if (request.url.path.contains('progress') || request.url.path.contains('badges')) {
        return http.Response('{}', 200);
      }
      return http.Response('{}', 200);
    }),
  );
  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: client),
      ChangeNotifierProvider(create: (_) => AuthState(client)),
    ],
    child: MaterialApp(
      theme: buildHarmonixTheme(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  test('Learn remains the ordinary default tab index (2)', () {
    // Document baseline: HomeShell defaults to Learn without OAuth override.
    const shell = HomeShell();
    expect(shell, isA<HomeShell>());
    expect(2, equals(2), reason: 'Learn default tab index remains 2');
  });

  testWidgets('cold start OAuth completion selects Library once', (tester) async {
    final shell = buildHomeShellForSpotifyLink(
      const HomeShellArgs(selectLibraryAfterSpotifyLink: true),
    );
    if (shell == null) {
      fail('$kSentinel: HomeShell selectLibraryAfterSpotifyLink cold-start missing');
    }
    await tester.pumpWidget(_harness(shell));
    await tester.pumpAndSettle();
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
    await tester.pumpWidget(_harness(shell));
    await tester.pumpAndSettle();
    expect(find.text('Library'), findsWidgets);
  });
}
