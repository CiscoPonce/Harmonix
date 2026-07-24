/// Shared with web `client/src/lib/languages.ts`.
const kLanguages = [
  ('en', 'English'),
  ('es', 'Spanish'),
  ('fr', 'French'),
  ('de', 'German'),
  ('pt', 'Portuguese'),
  ('it', 'Italian'),
];

/// Shared with web Settings MUSIC_STYLES / server VALID_GENRES.
const kMusicStyles = [
  ('any', 'Any'),
  ('pop', 'Pop'),
  ('rock', 'Rock'),
  ('hip-hop', 'Hip-Hop'),
  ('reggaeton', 'Reggaeton'),
];

const kVoiceGenders = [
  ('female', 'Female'),
  ('male', 'Male'),
];

String normalizeGenre(String? value) {
  final g = (value ?? 'pop').toLowerCase();
  for (final s in kMusicStyles) {
    if (s.$1 == g) return g;
  }
  return 'pop';
}

String normalizeVoiceGender(String? value) {
  return value == 'male' ? 'male' : 'female';
}

String normalizeLanguage(String? value, {String fallback = 'en'}) {
  final v = (value ?? '').toLowerCase();
  for (final l in kLanguages) {
    if (l.$1 == v) return v;
  }
  return fallback;
}
