/// Three meanings for a review question: the real one and two from the learner's other words.
List<String> buildReviewChoices(String correct, List<String> pool) {
  final right = correct.trim();
  if (right.isEmpty) return const [];
  String key(String value) => value.trim().toLowerCase();
  final seen = {key(right)};
  final distractors = <String>[];
  final shuffled = [...pool]..shuffle();
  for (final raw in shuffled) {
    final text = raw.trim();
    if (text.isEmpty || seen.contains(key(text))) continue;
    seen.add(key(text));
    distractors.add(text);
    if (distractors.length == 2) break;
  }
  final choices = [right, ...distractors]..shuffle();
  return choices;
}
