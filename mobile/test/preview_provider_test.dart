import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/api_client.dart';

void main() {
  group('resolveStreamedPreviewProvider', () {
    test('prefers live header over payload', () {
      expect(
        resolveStreamedPreviewProvider(
          responseHeaders: {'x-harmonix-preview-provider': 'itunes'},
          payloadProvider: 'deezer',
        ),
        'itunes',
      );
    });

    test('falls back to payload then deezer', () {
      expect(
        resolveStreamedPreviewProvider(
          responseHeaders: const {},
          payloadProvider: 'deezer',
        ),
        'deezer',
      );
      expect(
        resolveStreamedPreviewProvider(responseHeaders: null, payloadProvider: null),
        'deezer',
      );
    });

    test('is case-insensitive on header name', () {
      expect(
        resolveStreamedPreviewProvider(
          responseHeaders: {'X-Harmonix-Preview-Provider': 'iTunes'},
          payloadProvider: 'deezer',
        ),
        'itunes',
      );
    });
  });

  group('friendlyDailyWordError', () {
    test('never surfaces song_already_used raw code', () {
      final msg = friendlyDailyWordError(reason: 'song_already_used');
      expect(msg.contains('song_already_used'), isFalse);
      expect(msg.toLowerCase(), contains('moment'));
    });
  });
}
