#!/usr/bin/env node
/**
 * Live smoke test: for each target language, verify verified songs resolve on Deezer
 * and have synced lyrics on LRCLib. Reports all native→target preference pairs.
 */
const {
  VALID_LANGUAGE_CODES,
  LANG_CODE_TO_NAME,
  languageNameFromCode,
} = require('../constants/languages');
const {
  getVerifiedSongCandidates,
  getCuratedSongCandidates,
} = require('../services/aiService');
const {
  searchDeezerTrack,
  fetchLyrics,
  pickWordFromLyricsHeuristic,
} = require('../services/dailyWordService');

const SAMPLES_PER_LANG = 4;
const fetchImpl = global.fetch;

function pairs() {
  const out = [];
  for (const native of VALID_LANGUAGE_CODES) {
    for (const target of VALID_LANGUAGE_CODES) {
      if (native === target) continue;
      out.push({ native, target });
    }
  }
  return out;
}

async function validateSong(song, targetCode) {
  const label = `${song.artist} - ${song.song_title}`;
  const track = await searchDeezerTrack(song.artist, song.song_title, fetchImpl);
  if (!track) return { label, ok: false, reason: 'deezer_not_found' };

  const lyricsData = await fetchLyrics(track.artist.name, track.title, track.duration, fetchImpl, track.id);
  if (!lyricsData?.syncedLyrics) return { label, ok: false, reason: 'lyrics_not_found' };

  const plain = lyricsData.plainLyrics
    || require('../services/validationService').parseLrc(lyricsData.syncedLyrics).map((p) => p.text).join('\n');
  const picked = pickWordFromLyricsHeuristic(plain, 'medium', new Set(), targetCode);
  if (!picked) return { label, ok: false, reason: 'no_suitable_word' };

  return { label, ok: true, word: picked.word };
}

async function testTargetLanguage(targetCode) {
  const songs = getVerifiedSongCandidates(targetCode, 'pop').slice(0, SAMPLES_PER_LANG);
  const results = [];
  for (const song of songs) {
    results.push(await validateSong(song, targetCode));
  }
  const passed = results.filter((r) => r.ok);
  return {
    target: targetCode,
    name: LANG_CODE_TO_NAME[targetCode],
    catalogSize: getVerifiedSongCandidates(targetCode, 'pop').length,
    curatedSize: getCuratedSongCandidates(targetCode, 'pop').length,
    tested: results.length,
    passed: passed.length,
    results,
  };
}

async function main() {
  console.log('=== Harmonix language combination smoke test ===\n');
  console.log(`Preference pairs (${pairs().length}):`);
  for (const { native, target } of pairs()) {
    console.log(
      `  ${languageNameFromCode(native)} → ${languageNameFromCode(target)} (${native}→${target})`
    );
  }
  console.log('');

  let allOk = true;
  for (const code of VALID_LANGUAGE_CODES) {
    const report = await testTargetLanguage(code);
    const status = report.passed === report.tested ? 'OK' : 'FAIL';
    if (report.passed < report.tested) allOk = false;
    console.log(
      `[${status}] target=${report.name} (${code}) catalog=${report.catalogSize} curated=${report.curatedSize} passed=${report.passed}/${report.tested}`
    );
    for (const r of report.results) {
      if (r.ok) {
        console.log(`       ✓ ${r.label} → "${r.word}"`);
      } else {
        console.log(`       ✗ ${r.label} (${r.reason})`);
      }
    }
    console.log('');
  }

  console.log(allOk ? 'All target languages passed smoke test.' : 'Some target languages failed — see above.');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
