import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/utils/review_choices.dart';

void main() {
  test('offers the real meaning and two other meanings from the learner', () {
    final choices = buildReviewChoices('corto', ['dinero', 'vida', 'corto', '  Dinero  ']);
    expect(choices, hasLength(3));
    expect(choices.map((choice) => choice.toLowerCase()), contains('corto'));
    expect(choices.map((choice) => choice.toLowerCase()).toSet(), hasLength(3));
    for (final choice in choices) {
      expect(['corto', 'dinero', 'vida'], contains(choice.toLowerCase()));
    }
  });

  test('does not invent a third choice when the learner only has one other word', () {
    expect(buildReviewChoices('corto', ['corto', '']), ['corto']);
  });
}
