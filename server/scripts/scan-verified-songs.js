const ai = require('../services/aiService');
const { searchDeezerTrack, fetchLyrics } = require('../services/dailyWordService');

async function check(song) {
  const t = await searchDeezerTrack(song.artist, song.song_title, fetch);
  if (!t) return { song, ok: false, reason: 'deezer' };
  const l = await fetchLyrics(t.artist.name, t.title, t.duration, fetch, t.id);
  if (!l?.syncedLyrics) return { song, ok: false, reason: 'lyrics' };
  return { song, ok: true };
}

(async () => {
  for (const code of ['en', 'fr', 'de', 'pt']) {
    console.log(`\n=== ${code} ===`);
    const songs = ai.getVerifiedSongCandidates(code, 'any');
    let ok = 0;
    for (const s of songs) {
      const r = await check(s);
      const mark = r.ok ? 'OK' : r.reason;
      if (r.ok) ok += 1;
      console.log(`${mark}\t${s.artist} - ${s.song_title}`);
    }
    console.log(`passed ${ok}/${songs.length}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
