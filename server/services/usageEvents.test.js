const { expect } = require('chai');
const db = require('../db');
const { platformFromRequest, recordEvent, normalizeSignupSource } = require('./usageEvents');

describe('usage events', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM usage_events').run();
  });

  it('ignores an unknown event name', () => {
    expect(recordEvent('not_a_real_event', { userId: 'u1' })).to.equal(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_events').get().n).to.equal(0);
  });

  it('records app_open at most once per user per UTC day', () => {
    expect(recordEvent('app_open', { userId: 'u1', platform: 'web' })).to.equal(true);
    expect(recordEvent('app_open', { userId: 'u1', platform: 'web' })).to.equal(false);
    expect(db.prepare("SELECT COUNT(*) AS n FROM usage_events WHERE name = 'app_open'").get().n).to.equal(1);
  });

  it('drops a string prop longer than 40 characters', () => {
    recordEvent('word_delivered', {
      userId: 'u1',
      props: { lang: 'es', lyric: 'x'.repeat(41) },
    });
    const row = db.prepare('SELECT props_json FROM usage_events').get();
    expect(JSON.parse(row.props_json)).to.deep.equal({ lang: 'es' });
  });

  it('reads the Android client from a Dart user agent', () => {
    expect(platformFromRequest({ headers: { 'user-agent': 'Dart/3.12 (dart:io)' } })).to.equal('android');
  });

  it('does not throw when the name is not a string', () => {
    expect(() => recordEvent({ bad: true })).to.not.throw();
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_events').get().n).to.equal(0);
  });

  it('normalizes a signup source and stores it on the signup event', () => {
    expect(normalizeSignupSource('postcard')).to.equal('postcard');
    expect(normalizeSignupSource('Postcard')).to.equal('postcard');
    expect(normalizeSignupSource('<bad>')).to.equal(null);
    expect(normalizeSignupSource('')).to.equal(null);
    expect(normalizeSignupSource('a'.repeat(41))).to.equal(null);

    recordEvent('signup', { userId: 'u1', props: { source: 'postcard' } });
    const row = db.prepare("SELECT props_json FROM usage_events WHERE name = 'signup'").get();
    expect(row.props_json).to.include('postcard');
  });
});
