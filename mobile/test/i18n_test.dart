import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/utils/i18n.dart';

void main() {
  const langs = ['en', 'es', 'fr', 'de', 'pt', 'it'];

  test('every language has every key of the base and extra dictionaries', () {
    final baseKeys = AppI18n.translations['en']!.keys.toSet();
    final extraKeys = AppI18n.extra['en']!.keys.toSet();
    for (final lang in langs) {
      final base = AppI18n.translations[lang]!;
      final extra = AppI18n.extra[lang]!;
      expect(base.keys.toSet(), baseKeys, reason: 'base keys for $lang');
      expect(extra.keys.toSet(), extraKeys, reason: 'extra keys for $lang');
      for (final v in [...base.values, ...extra.values]) {
        expect(v.trim(), isNotEmpty);
      }
    }
  });

  test('interpolates {vars}, falls back to English, and picks plurals', () {
    expect(AppI18n.t('n_ready', 'es', {'n': 4}), '4 listas');
    expect(AppI18n.t('n_ready', 'xx', {'n': 4}), '4 ready');
    expect(AppI18n.t('unknown_key'), 'unknown_key');
    expect(AppI18n.plural('streak_days', 1, 'en'), '1 day');
    expect(AppI18n.plural('streak_days', 3, 'de'), '3 Tage');
    expect(AppI18n.plural('to_review', 2, 'pt'), '2 palavras para revisar →');
  });
}
