import 'package:flutter_test/flutter_test.dart';

import 'package:harmonix_mobile/utils/hear_it_timing.dart';

void main() {
  group('hear_it_timing', () {
    test('estimates word later in the line than the LRC stamp', () {
      final lineStart = estimateWordSongTimeSec(
        timestampMs: 55000,
        snippet: 'I want you to notice',
        charStart: 0,
        charEnd: 1,
        lineEndMs: 58500,
      );
      final wordLater = estimateWordSongTimeSec(
        timestampMs: 55000,
        snippet: 'I want you to notice',
        charStart: 14,
        charEnd: 20,
        lineEndMs: 58500,
      );
      expect(wordLater, greaterThan(lineStart));
      expect(wordLater - 55, lessThan(4));
    });

    test('centers Deezer seek on the sung word inside the preview', () {
      final win = computeDeezerHearWindow(
        timestampMs: 52000,
        lineEndMs: 56000,
        snippet: 'But I am a creep',
        charStart: 11,
        charEnd: 16,
        previewOffset: 30,
        previewProvider: 'deezer',
      );
      expect(win.inWindow, isTrue);
      expect(win.seekTo, inInclusiveRange(22, 26));
      expect(win.stopAt, greaterThan(win.relative));
      expect(win.stopAt - win.seekTo, greaterThanOrEqualTo(5));
      expect(win.seekTo, lessThan(win.relative));
    });

    test('uses offset 0 for iTunes previews', () {
      expect(
        resolvePreviewOffsetSec(
          previewProvider: 'itunes',
          previewOffset: 30,
          durationSeconds: 200,
        ),
        0,
      );
      final win = computeDeezerHearWindow(
        timestampMs: 12000,
        lineEndMs: 15000,
        snippet: 'hola mundo',
        charStart: 0,
        charEnd: 4,
        previewOffset: 30,
        previewProvider: 'itunes',
      );
      expect(win.inWindow, isTrue);
      expect(win.seekTo, lessThan(12));
    });

    test('does not play when lyric is outside the preview cut', () {
      final win = computeDeezerHearWindow(
        timestampMs: 64000,
        lineEndMs: 68000,
        snippet: 'And it was called Yellow',
        charStart: 18,
        charEnd: 24,
        previewOffset: 30,
      );
      expect(win.inWindow, isFalse);
      expect(win.shouldPlay, isFalse);
    });
  });
}
