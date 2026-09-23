import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/utils/study_spacing.dart';

void main() {
  test('study text uses wider spacing only when the dyslexia flag is on', () {
    expect(studyLetterSpacing(1), 1.6);
    expect(studyLetterSpacing(true), 1.6);
    expect(studyLetterSpacing('1'), 1.6);
    expect(studyLetterSpacing(0), 0);
    expect(studyLetterSpacing(false), 0);
    expect(studyLetterSpacing('0'), 0);
    expect(studyLetterSpacing(null), 0);
  });
}
