import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/api_client.dart';

void main() {
  group('pronounceQuery', () {
    test('keys the request by voice so a gender change is a different URL', () {
      final female = pronounceQuery('harbor', lang: 'en', voiceGender: 'female');
      final male = pronounceQuery('harbor', lang: 'en', voiceGender: 'male');
      expect(female['word'], 'harbor');
      expect(female['lang'], 'en');
      expect(female['voice'], 'female');
      expect(male['voice'], 'male');
      expect(female['voice'], isNot(male['voice']));
    });

    test('omits voice when gender is unknown', () {
      final query = pronounceQuery('harbor', lang: ' en ');
      expect(query, {'word': 'harbor', 'lang': 'en'});
    });
  });
}
