const ai = require('../services/aiService');
const { searchDeezerTrack, fetchLyrics } = require('../services/dailyWordService');

async function check(song) {
  const t = await searchDeezerTrack(song.artist, song.song_title, fetch);
  if (!t) return { song, ok: false, reason: 'deezer' };
  const l = await fetchLyrics(t.artist.name, t.title, t.duration, fetch, t.id);
  if (!l?.syncedLyrics) return { song, ok: false, reason: 'lyrics' };
  return { song, ok: true };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const codes = process.argv.slice(2);
  const targets = codes.length ? codes : ['en', 'es', 'fr', 'de', 'pt', 'it'];
  let allOk = true;

  for (const code of targets) {
    console.log(`\n=== ${code} ===`);
    const songs = ai.getVerifiedSongCandidates(code, 'any');
    let ok = 0;
    for (const s of songs) {
      const r = await check(s);
      await wait(400);
      const mark = r.ok ? 'OK' : r.reason;
      if (r.ok) ok += 1;
      console.log(`${mark}\t${s.artist} - ${s.song_title}`);
    }
    console.log(`passed ${ok}/${songs.length}`);
    if (ok < 8) {
      allOk = false;
      console.warn(`WARN: ${code} has only ${ok} LRCLib-proven songs (need ≥8)`);
    }
  }

  process.exit(allOk ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
