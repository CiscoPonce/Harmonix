const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_MATCH';
const CORPUS_PATH = path.join(__dirname, 'fixtures', 'spotify-match-corpus.json');

function loadMatcher() {
  try {
    return require('./spotifyMatchService');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /spotifyMatchService/.test(err.message)) {
      return null;
    }
    throw err;
  }
}

function loadCorpus() {
  if (!fs.existsSync(CORPUS_PATH)) {
    throw new Error(`fixture missing: ${CORPUS_PATH}`);
  }
  const raw = fs.readFileSync(CORPUS_PATH, 'utf8');
  let corpus;
  try {
    corpus = JSON.parse(raw);
  } catch (err) {
    throw new Error(`fixture load failed: ${err.message}`);
  }
  if (!corpus || !Array.isArray(corpus.cases) || corpus.cases.length === 0) {
    throw new Error('fixture load failed: corpus.cases must be a non-empty array');
  }
  return corpus;
}

describe('spotify match corpus evaluation', () => {
  it('loads a labeled multilingual corpus with collision categories', () => {
    const corpus = loadCorpus();
    const categories = new Set(corpus.cases.map((c) => c.category));
    const languages = new Set(corpus.cases.map((c) => c.language));
    expect(languages.size).to.be.at.least(4);
    for (const required of [
      'diacritics',
      'featured_artist',
      'edition_live',
      'edition_remaster',
      'edition_remix',
      'clean_explicit',
      'same_title_ambiguity',
      'ambiguity_tie',
      'weak_candidate',
      'missing_artist',
      'missing_title',
      'invalid_uri',
      'local',
      'unavailable',
      'relinked',
      'duration_conflict',
      'multilingual',
      'null_item',
    ]) {
      expect(categories.has(required), `missing category ${required}`).to.equal(true);
    }
    for (const c of corpus.cases) {
      expect(c.source.identity).to.match(/^(harmonix|spotify):/);
      expect(c.market).to.be.a('string').and.not.empty;
      expect(c.candidates.length).to.be.at.most(10);
      expect(c.expected.outcome).to.be.oneOf(['accept', 'reject']);
    }
  });

  it('requires accepted-match precision greater than 0.90 (not overall accuracy)', () => {
    const matcher = loadMatcher();
    if (!matcher || typeof matcher.selectMatch !== 'function') {
      expect.fail(`${SENTINEL}: corpus precision gate cannot run without selectMatch`);
    }

    const corpus = loadCorpus();
    let acceptedExpected = 0;
    let acceptedCorrect = 0;
    let falsePositives = 0;
    let rejectionExpected = 0;
    let rejectionCorrect = 0;

    for (const c of corpus.cases) {
      const result = matcher.selectMatch(c.source, c.candidates.filter(Boolean), {
        market: c.market,
      });

      if (c.expected.outcome === 'accept') {
        acceptedExpected += 1;
        if (result.outcome === 'accept' && result.spotify_id === c.expected.spotify_id) {
          acceptedCorrect += 1;
        } else if (result.outcome === 'accept') {
          falsePositives += 1;
        }
      } else {
        rejectionExpected += 1;
        if (result.outcome === 'reject' && result.reason === c.expected.reason) {
          rejectionCorrect += 1;
        } else if (result.outcome === 'accept') {
          falsePositives += 1;
        }
      }
    }

    expect(acceptedExpected).to.be.at.least(1);
    // Precision among accepts = correct accepts / (correct accepts + false positives)
    const precisionDenom = acceptedCorrect + falsePositives;
    const precision = precisionDenom === 0 ? 0 : acceptedCorrect / precisionDenom;
    const rejectionCoverage = rejectionExpected === 0 ? 1 : rejectionCorrect / rejectionExpected;

    // Deterministic metrics for the labeled corpus gate (D-12-13).
    // eslint-disable-next-line no-console
    console.log(
      `[spotify-match-corpus] accepted=${acceptedCorrect}/${acceptedExpected} ` +
        `precision=${precision.toFixed(3)} falsePositives=${falsePositives} ` +
        `rejectionCoverage=${rejectionCoverage.toFixed(3)} (${rejectionCorrect}/${rejectionExpected})`
    );

    expect(
      precision,
      `accepted-match precision ${precision} must be > 0.90 (falsePositives=${falsePositives})`
    ).to.be.above(0.9);

    expect(rejectionCoverage, 'rejection coverage recorded separately').to.be.a('number');

    // Every corpus case must return the labeled ID or rejection reason deterministically.
    for (const c of corpus.cases) {
      const result = matcher.selectMatch(c.source, c.candidates.filter(Boolean), {
        market: c.market,
      });
      if (c.expected.outcome === 'accept') {
        expect(result.outcome, c.id).to.equal('accept');
        expect(result.spotify_id, c.id).to.equal(c.expected.spotify_id);
      } else {
        expect(result.outcome, c.id).to.equal('reject');
        expect(result.reason, c.id).to.equal(c.expected.reason);
      }
    }
  });
});
