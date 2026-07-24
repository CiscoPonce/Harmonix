/// Hear-it timing helpers — map lyric lines into Deezer / iTunes preview seek.
/// Mirrors `client/src/lib/hearItTiming.ts` so Flutter and web stay in sync.

const double _maxLineDurForWordEstSec = 5;

class LineBounds {
  const LineBounds({
    required this.lineStartSec,
    required this.lineEndSec,
    required this.lineDurSec,
  });

  final double lineStartSec;
  final double lineEndSec;
  final double lineDurSec;
}

LineBounds lineBoundsSec({
  required num timestampMs,
  num? lineEndMs,
}) {
  final lineStartSec = timestampMs.toDouble() / 1000;
  final start = lineStartSec < 0 ? 0.0 : lineStartSec;
  final rawEndSec = lineEndMs != null ? lineEndMs.toDouble() / 1000 : double.nan;
  final lineEndSec =
      rawEndSec.isFinite && rawEndSec > start + 0.35 ? rawEndSec : start + 4;
  final dur = lineEndSec - start;
  return LineBounds(
    lineStartSec: start,
    lineEndSec: lineEndSec,
    lineDurSec: dur < 0.4 ? 0.4 : dur,
  );
}

/// Estimate when the highlighted word is sung inside the LRC line.
double estimateWordSongTimeSec({
  required num timestampMs,
  required String snippet,
  required num charStart,
  required num charEnd,
  num? lineEndMs,
}) {
  final bounds = lineBoundsSec(timestampMs: timestampMs, lineEndMs: lineEndMs);
  final effectiveDur = bounds.lineDurSec < _maxLineDurForWordEstSec
      ? bounds.lineDurSec
      : _maxLineDurForWordEstSec;
  final chars = snippet.runes.toList();
  final len = chars.isEmpty ? 1 : chars.length;
  var start = charStart.toDouble();
  if (start < 0) start = 0;
  if (start > len) start = len.toDouble();
  var end = charEnd.toDouble();
  if (end < start) end = start;
  if (end > len) end = len.toDouble();
  final mid = (start + end) / 2;
  final frac = (mid / len).clamp(0.0, 1.0);
  return bounds.lineStartSec + frac * effectiveDur;
}

/// Deezer: 30–60s for long tracks. iTunes: usually from 0.
double resolvePreviewOffsetSec({
  num? previewOffset,
  String? previewProvider,
  num? durationSeconds,
}) {
  final provider = (previewProvider ?? 'deezer').toLowerCase();
  if (provider == 'itunes' || provider.startsWith('itunes')) {
    return 0;
  }
  if (previewOffset != null && previewOffset.isFinite) {
    final o = previewOffset.toDouble();
    return o < 0 ? 0 : o;
  }
  final dur = durationSeconds?.toDouble() ?? 0;
  if (dur > 60) return 30;
  if (dur > 30) return dur - 30;
  return 0;
}

class DeezerHearWindow {
  const DeezerHearWindow({
    required this.seekTo,
    required this.stopAt,
    required this.inWindow,
    required this.shouldPlay,
    required this.relative,
    required this.wordSongTimeSec,
  });

  final double seekTo;
  final double stopAt;
  final bool inWindow;
  final bool shouldPlay;
  final double relative;
  final double wordSongTimeSec;
}

double _round2(double v) => (v * 100).round() / 100;

/// Map full-song lyric time into the 30s preview element timeline.
DeezerHearWindow computeDeezerHearWindow({
  required num timestampMs,
  required String snippet,
  required num charStart,
  required num charEnd,
  num? previewOffset,
  String? previewProvider,
  num? durationSeconds,
  double previewLen = 30,
  num? lineEndMs,
}) {
  const wordLead = 1.0;
  const wordTail = 5.5;
  const targetClip = 8.0;
  const minClip = 5.0;

  final wordSongTimeSec = estimateWordSongTimeSec(
    timestampMs: timestampMs,
    snippet: snippet,
    charStart: charStart,
    charEnd: charEnd,
    lineEndMs: lineEndMs,
  );
  final offset = resolvePreviewOffsetSec(
    previewOffset: previewOffset,
    previewProvider: previewProvider,
    durationSeconds: durationSeconds,
  );
  final relativeWord = wordSongTimeSec - offset;
  final inWindow = relativeWord >= 0.4 && relativeWord <= previewLen - 0.8;

  if (!inWindow) {
    return DeezerHearWindow(
      seekTo: 0,
      stopAt: 0,
      inWindow: false,
      shouldPlay: false,
      relative: relativeWord,
      wordSongTimeSec: wordSongTimeSec,
    );
  }

  var seekTo = relativeWord - wordLead;
  if (seekTo < 0) seekTo = 0;
  var stopAt = relativeWord + wordTail;
  if (stopAt > previewLen) stopAt = previewLen;
  if (stopAt - seekTo < targetClip) {
    stopAt = seekTo + targetClip;
    if (stopAt > previewLen) stopAt = previewLen;
  }
  if (stopAt - seekTo < minClip) {
    seekTo = stopAt - minClip;
    if (seekTo < 0) seekTo = 0;
  }
  if (seekTo > relativeWord - 0.35) {
    seekTo = relativeWord - wordLead;
    if (seekTo < 0) seekTo = 0;
  }
  if (stopAt < relativeWord + 1.5) {
    stopAt = relativeWord + wordTail;
    if (stopAt > previewLen) stopAt = previewLen;
  }
  final minStop = seekTo + minClip;
  if (stopAt < minStop) {
    stopAt = minStop > previewLen ? previewLen : minStop;
  }

  return DeezerHearWindow(
    seekTo: _round2(seekTo),
    stopAt: _round2(stopAt),
    inWindow: true,
    shouldPlay: true,
    relative: relativeWord,
    wordSongTimeSec: wordSongTimeSec,
  );
}
