import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/utils/review_choices.dart';

const _spanishJokes = [
  'un sándwich de calcetines',
  'el primo del refrigerador',
  'una nube con zapatos',
  'una tostadora que canta',
  'la piedra mascota del martes',
  'una bicicleta de sopa',
  'el calcetín izquierdo de la luna',
  'una tormenta educada',
];

void main() {
  test('offers the right meaning, the closest other meaning, and one silly meaning', () {
    final choices = buildReviewChoices('corto', ['una vida muy larga', 'breve palabra', 'corto'], 'es');
    expect(choices, hasLength(3));
    expect(choices.toSet(), hasLength(3));
    expect(choices, contains('corto'));
    expect(choices, contains('breve palabra'));
    expect(choices.where(_spanishJokes.contains), hasLength(1));
  });

  test('still offers three choices when the learner has no other words', () {
    final choices = buildReviewChoices('corto', ['corto', ''], 'es');
    expect(choices, hasLength(3));
    expect(choices, contains('corto'));
    expect(choices, contains('algo pequeño'));
    expect(choices.where(_spanishJokes.contains), hasLength(1));
  });

  test('keeps the silly line in the home language', () {
    final choices = buildReviewChoices('short', [], 'en');
    expect(choices, contains('short'));
    expect(choices, contains('a small thing'));
    expect(
      choices.any((choice) =>
          choice.contains('sock') ||
          choice.contains('toaster') ||
          choice.contains('fridge') ||
          choice.contains('cloud') ||
          choice.contains('Tuesday') ||
          choice.contains('soup') ||
          choice.contains('moon') ||
          choice.contains('thunderstorm')),
      isTrue,
    );
  });
}
