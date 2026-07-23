#!/usr/bin/env node
require('dotenv').config();
const { lyricsMatchTargetLanguage } = require('../constants/languages');
const lrc = require('../services/lrcLibService');
const deezer = require('../services/deezerService');

function counts(plain) {
  const esHits = (plain.match(/[ñ]|ción|\btambién\b|\bcorazón\b|\bcómo\b|\bqué\b/gi) || []).length;
  const enHits = (plain.match(
    /\b(the|and|you|your|love|baby|tonight|feel|feeling|change|freedom|children|with|from|this|that|what|when|where|how|why|would|could|should|have|has|been|being|are|were|don't|can't|won't|i'm|you're|we're|they're|listening|follow|followed|people|dream|dreams|believe|goodbye|hello|home|alone|again|together|better|never|always|forever|everything|something|nothing|everybody|watching|waiting|running|walking|talking|thinking|dreaming|beautiful|perfect|coming|leaving|beggin'|begging|windows|future|closed|gorky|moskva)\b/gi
  ) || []).length;
  return { esHits, enHits };
}

async function check(artist, title) {
  const t0 = Date.now();
  const track = await deezer.searchTrack(artist, title);
  if (!track) {
    console.log(JSON.stringify({ label: `${artist} - ${title}`, error: 'NO_DEEZER', ms: Date.now() - t0 }));
    return;
  }
  const t1 = Date.now();
  const lyrics = await lrc.fetchLyricsForTrack(track.artist.name, track.title, track.duration);
  const t2 = Date.now();
  const plain = lyrics?.plainLyrics
    || String(lyrics?.syncedLyrics || '').replace(/\[[^\]]+\]/g, ' ');
  const { esHits, enHits } = counts(plain);
  console.log(JSON.stringify({
    label: `${artist} - ${title}`,
    deezerMs: t1 - t0,
    lrcMs: t2 - t1,
    hasSynced: Boolean(lyrics?.syncedLyrics),
    plainLen: String(plain).length,
    esHits,
    enHits,
    ok: lyricsMatchTargetLanguage(plain, 'es'),
    sample: String(plain).slice(0, 180).replace(/\s+/g, ' '),
  }));
}

(async () => {
  for (const pair of [
    ['Luis Fonsi', 'Échame La Culpa'],
    ['Romeo Santos', 'Propuesta Indecente'],
    ['Shawn Mendes', 'Señorita'],
    ['Maluma', 'Corazón'],
    ['Marc Anthony', 'Vivir Mi Vida'],
  ]) {
    await check(pair[0], pair[1]);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
