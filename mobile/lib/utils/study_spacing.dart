/// Wider tracking for the word card, shelf, and review when the learner opted in.
double studyLetterSpacing(Object? flag) {
  final on = flag == 1 || flag == true || flag == '1';
  return on ? 1.6 : 0;
}
