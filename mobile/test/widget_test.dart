import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/services/api_client.dart';
import 'package:harmonix_mobile/theme/harmonix_theme.dart';

void main() {
  test('Harmonix brand accent is forest green', () {
    expect(HarmonixColors.brand.toARGB32(), 0xFF0B6B3A);
  });

  test('friendlyDailyWordError maps known reasons', () {
    expect(
      friendlyDailyWordError(reason: 'cooldown_active', retryAfterSec: 12),
      contains('12 seconds'),
    );
    expect(
      friendlyDailyWordError(reason: 'ai_rate_limit'),
      contains('rate limit'),
    );
    expect(
      friendlyDailyWordError(reason: 'batch_in_progress'),
      contains('generating'),
    );
  });
}
