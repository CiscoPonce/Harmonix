const _similarFallback = {
  'en': ['a small thing', 'another time', 'someone nearby'],
  'es': ['algo pequeño', 'otro momento', 'alguien cerca'],
  'fr': ['une petite chose', 'un autre moment', 'quelqu’un près'],
  'de': ['etwas Kleines', 'ein anderer Moment', 'jemand in der Nähe'],
  'pt': ['algo pequeno', 'outro momento', 'alguém perto'],
  'it': ['qualcosa di piccolo', 'un altro momento', 'qualcuno vicino'],
};

const _silly = {
  'en': [
    'a sock sandwich',
    'the fridge’s cousin',
    'a cloud wearing shoes',
    'a singing toaster',
    'Tuesday’s pet rock',
    'a bicycle made of soup',
    'the moon’s left sock',
    'a polite thunderstorm',
  ],
  'es': [
    'un sándwich de calcetines',
    'el primo del refrigerador',
    'una nube con zapatos',
    'una tostadora que canta',
    'la piedra mascota del martes',
    'una bicicleta de sopa',
    'el calcetín izquierdo de la luna',
    'una tormenta educada',
  ],
  'fr': [
    'un sandwich de chaussettes',
    'le cousin du réfrigérateur',
    'un nuage à chaussures',
    'un grille-pain qui chante',
    'le caillou du mardi',
    'un vélo en soupe',
    'la chaussette gauche de la lune',
    'un orage poli',
  ],
  'de': [
    'ein Sandwich aus Socken',
    'der Cousin des Kühlschranks',
    'eine Wolke mit Schuhen',
    'ein singender Toaster',
    'Dienstags Haustierstein',
    'ein Fahrrad aus Suppe',
    'die linke Socke des Mondes',
    'ein höfliches Gewitter',
  ],
  'pt': [
    'um sanduíche de meias',
    'o primo da geladeira',
    'uma nuvem de sapatos',
    'uma torradeira que canta',
    'a pedra de estimação de terça',
    'uma bicicleta de sopa',
    'a meia esquerda da lua',
    'uma tempestade educada',
  ],
  'it': [
    'un panino di calzini',
    'il cugino del frigorifero',
    'una nuvola con le scarpe',
    'un tostapane che canta',
    'il sasso di martedì',
    'una bici di zuppa',
    'il calzino sinistro della luna',
    'un temporale educato',
  ],
};

String _keyOf(String value) => value.trim().toLowerCase();

int _hashText(String value) {
  var hash = 0;
  for (final code in _keyOf(value).codeUnits) {
    hash = (hash * 33 + code) & 0xFFFFFFFF;
  }
  return hash;
}

List<String> _tokens(String value) {
  return _keyOf(value).split(RegExp(r'[^\p{L}\p{N}]+', unicode: true)).where((token) => token.length > 2).toList();
}

int _similarity(String correct, String candidate) {
  final left = _tokens(correct);
  final right = _tokens(candidate).toSet();
  var shared = 0;
  for (final token in left) {
    if (right.contains(token)) shared += 1;
  }
  return shared * 100 - (correct.length - candidate.length).abs();
}

String _pickSimilar(String correct, List<String> pool, Set<String> blocked, String lang) {
  String? best;
  var bestScore = -1 << 30;
  for (final raw in pool) {
    final text = raw.trim();
    final key = _keyOf(text);
    if (text.isEmpty || blocked.contains(key)) continue;
    final score = _similarity(correct, text);
    if (score > bestScore || (score == bestScore && best != null && text.compareTo(best) < 0)) {
      best = text;
      bestScore = score;
    }
  }
  if (best != null) return best;
  final fallback = _similarFallback[lang] ?? _similarFallback['en']!;
  return fallback.firstWhere((item) => !blocked.contains(_keyOf(item)), orElse: () => fallback.first);
}

String _pickSilly(String correct, Set<String> blocked, String lang) {
  final jokes = _silly[lang] ?? _silly['en']!;
  final start = _hashText(correct) % jokes.length;
  for (var step = 0; step < jokes.length; step += 1) {
    final joke = jokes[(start + step) % jokes.length];
    if (!blocked.contains(_keyOf(joke))) return joke;
  }
  return jokes.first;
}

/// Right meaning, the closest other meaning, and one silly meaning. Order is shuffled.
List<String> buildReviewChoices(String correct, List<String> pool, [String lang = 'en']) {
  final right = correct.trim();
  if (right.isEmpty) return const [];
  final language = lang.toLowerCase();
  final blocked = {_keyOf(right)};
  final similar = _pickSimilar(right, pool, blocked, language);
  blocked.add(_keyOf(similar));
  final silly = _pickSilly(right, blocked, language);
  final choices = [right, similar, silly]..shuffle();
  return choices;
}
