List<Map<String, dynamic>> uniqueShelfWords(List<Map<String, dynamic>> items) {
  final seen = <String>{};
  final out = <Map<String, dynamic>>[];
  for (final item in items) {
    final rawWord = item['word'];
    final text = rawWord is Map
        ? (rawWord['text'] ?? '').toString()
        : (rawWord ?? item['text'] ?? '').toString();
    final key = text.toLowerCase().trim();
    if (key.isEmpty || seen.contains(key)) continue;
    seen.add(key);
    out.add(item);
  }
  return out;
}
