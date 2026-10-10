import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/offline_word_cache.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('recent words round-trip through shared preferences', () async {
    final cache = await OfflineWordCache.open();
    expect(cache.loadRecentWords(), isEmpty);

    await cache.saveRecentWords([
      {
        'word': {'text': 'anyone', 'translation': 'cualquiera'},
        'song': {'id': '1', 'title': 'Song', 'artist': 'Artist'},
      },
    ]);

    final loaded = cache.loadRecentWords();
    expect(loaded, hasLength(1));
    expect(loaded.first['word']['text'], 'anyone');
  });

  test('looksLikeOfflineError detects socket failures', () {
    expect(
      looksLikeOfflineError(Exception('ClientException: SocketException failed host lookup')),
      isTrue,
    );
    expect(looksLikeOfflineError(Exception('503 daily_word_unavailable')), isFalse);
  });
}
