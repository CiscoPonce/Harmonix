const { expect } = require('chai');
const {
 parseLrc,
 validateSongSync,
 cacheSongData,
 getCachedSong,
 recordValidation
} = require('./validationService');
const db = require('../db');

describe('Validation Service', () => {
 describe('parseLrc', () => {
 it('parses mm:ss timestamps to milliseconds', () => {
 const out = parseLrc('[00:01.500] Hello\n[00:05.000] World');
 expect(out).to.have.lengthOf(2);
 expect(out[0].time).to.equal(1500);
 expect(out[1].time).to.equal(5000);
 expect(out[0].text).to.equal('Hello');
 });

 it('ignores lines without timestamps', () => {
 const out = parseLrc('[00:01.000] Hi\nPlain text\n[00:02.000] Bye');
 expect(out).to.have.lengthOf(2);
 });

 it('returns empty array for non-string input', () => {
 expect(parseLrc(null)).to.deep.equal([]);
 expect(parseLrc('')).to.deep.equal([]);
 });
 });

 describe('validateSongSync', () => {
 const track = { duration: 30 };

 it('flags missing LRC as invalid', () => {
 const result = validateSongSync(track, null);
 expect(result.valid).to.equal(false);
 expect(result.issues).to.include('missing_lrc');
 });

 it('flags too few lines', () => {
 const lrc = '[00:01.000] Only one';
 const result = validateSongSync(track, lrc);
 expect(result.issues).to.include('too_few_lines');
 });

 it('flags out-of-bounds timestamps', () => {
 // duration 30s -> threshold 30_000 + max(10_000, 1500) = 40_000ms
 const lrc = '[00:01.000] A\n[00:02.000] B\n[00:50.000] C\n[01:00.000] D';
 const result = validateSongSync(track, lrc);
 expect(result.issues.join(',')).to.match(/out_of_bounds/);
 });

 it('accepts a well-formed LRC', () => {
 const lrc = '[00:01.000] Line 1\n[00:02.000] Line 2\n[00:03.000] Line 3\n[00:04.000] Line 4';
 const result = validateSongSync(track, lrc);
 expect(result.valid).to.equal(true);
 expect(result.issues).to.have.lengthOf(0);
 });

 it('flags missing track duration', () => {
 const result = validateSongSync({}, '[00:01.000] A\n[00:02.000] B\n[00:03.000] C');
 expect(result.valid).to.equal(false);
 });
 });

 describe('cache + record', () => {
 beforeEach(() => {
 db.prepare('DELETE FROM song_cache WHERE song_id LIKE ?').run('test-song-%');
 db.prepare('DELETE FROM validated_songs WHERE song_id LIKE ?').run('test-song-%');
 });

 it('round-trips cached song metadata', () => {
 cacheSongData('test-song-1', { syncedLyrics: '[00:01.000] Hi' }, { artist_name: 'X', track_name: 'Y', duration: 30 });
 const got = getCachedSong('test-song-1');
 expect(got).to.not.be.null;
 expect(got.track.artist_name).to.equal('X');
 expect(got.lyrics.syncedLyrics).to.contain('Hi');
 });

 it('returns null for untracked cache misses', () => {
 expect(getCachedSong('test-song-does-not-exist')).to.equal(null);
 });

 it('persists validation results', () => {
 recordValidation('test-song-v1', 'artist', 'title', 30, { valid: true, score: 0.95 });
 const row = db.prepare('SELECT * FROM validated_songs WHERE song_id = ?').get('test-song-v1');
 expect(row.lrc_valid).to.equal(1);
 expect(row.score).to.equal(0.95);
 });
 });
});
