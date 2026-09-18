import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/utils/shelf.dart';

void main() {
  test('uniqueShelfWords keeps one card per word', () {
    final rows = uniqueShelfWords([
      {
        'word': {'text': 'flame'},
        'song': {'id': 'maps'},
      },
      {
        'word': {'text': 'Flame'},
        'song': {'id': 'maps'},
      },
      {
        'word': {'text': 'trust'},
      },
    ]);
    expect(rows, hasLength(2));
    expect(rows[0]['word']['text'], 'flame');
    expect(rows[1]['word']['text'], 'trust');
  });
}
