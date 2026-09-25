const { expect } = require('chai');
const {
  extractVocabulary,
  createChatCompletion,
  AVAILABLE_MODELS,
  OPENROUTER_MODELS,
  openai,
} = require('./aiService');

describe('AI Service', () => {
  let originalCreate;

  before(() => {
    originalCreate = openai.chat.completions.create;
  });

  after(() => {
    openai.chat.completions.create = originalCreate;
  });

  it('uses GLM-5.3 as the default primary NIM model', () => {
    expect(AVAILABLE_MODELS[0]).to.equal('z-ai/glm-5.3');
    expect(AVAILABLE_MODELS).to.include('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(AVAILABLE_MODELS).to.include('z-ai/glm-5.3-flash');
    expect(AVAILABLE_MODELS).to.not.include('meta/muse-glimmer-30b');
    expect(AVAILABLE_MODELS).to.not.include('minimaxai/minimax-m3');
  });

  it('uses only OpenRouter :free models as fallback', () => {
    expect(OPENROUTER_MODELS[0]).to.equal('nvidia/nemotron-3-super-120b-a12b:free');
    expect(OPENROUTER_MODELS.every((m) => m.endsWith(':free'))).to.equal(true);
    expect(OPENROUTER_MODELS).to.not.include('z-ai/glm-5.3-flash');
  });

  describe('provider circuit breakers', () => {
    const { buildModelAttempts, __setProviderCooldownsForTest, providerCooldowns, openrouter } = require('./aiService');

    afterEach(() => __setProviderCooldownsForTest());

    it('skips OpenRouter while it is rate-limited instead of storming it', () => {
      const future = Date.now() + 60_000;
      __setProviderCooldownsForTest({ openrouterUntil: future });
      expect(providerCooldowns().openrouter).to.equal(true);
      const fast = buildModelAttempts('meta/muse-glimmer-30b', { fast: true });
      expect(fast.some((a) => a.provider === 'openrouter')).to.equal(false);
      expect(fast.some((a) => a.provider === 'nvidia')).to.equal(true);
      const slow = buildModelAttempts('meta/muse-glimmer-30b', { fast: false });
      expect(slow.some((a) => a.provider === 'openrouter')).to.equal(false);
    });

    it('fast path fails instantly when both providers are cooling down', () => {
      const future = Date.now() + 60_000;
      __setProviderCooldownsForTest({ nvidiaUntil: future, openrouterUntil: future });
      expect(buildModelAttempts('meta/muse-glimmer-30b', { fast: true })).to.have.length(0);
      // Background path still tries the NIM chain rather than giving up.
      const slow = buildModelAttempts('meta/muse-glimmer-30b', { fast: false });
      expect(slow.every((a) => a.provider === 'nvidia')).to.equal(true);
      expect(slow.length).to.be.greaterThan(0);
    });

    it('lets OpenRouter back in once the cooldown expires', function () {
      if (!openrouter) this.skip();
      __setProviderCooldownsForTest({ nvidiaUntil: Date.now() + 60_000, openrouterUntil: Date.now() - 1 });
      const fast = buildModelAttempts('meta/muse-glimmer-30b', { fast: true });
      expect(fast.every((a) => a.provider === 'openrouter')).to.equal(true);
    });

    it('403 on the first NIM model cools NIM for 30 minutes and does not call the rest of the NIM chain', async function () {
      const ai = require('./aiService');
      if (!ai.openaiFast) this.skip();
      ai.__setProviderCooldownsForTest();
      const origFast = ai.openaiFast.chat.completions.create;
      const origOr = ai.openrouter ? ai.openrouter.chat.completions.create : null;
      const calls = [];
      ai.openaiFast.chat.completions.create = async ({ model }) => {
        calls.push({ provider: 'nvidia', model });
        const err = new Error('403 status code (no body)');
        err.status = 403;
        throw err;
      };
      if (ai.openrouter) {
        ai.openrouter.chat.completions.create = async ({ model }) => {
          calls.push({ provider: 'openrouter', model });
          return { choices: [{ message: { content: '{"ok":true}' } }] };
        };
      }
      try {
        const out = await ai.createFastChatCompletion({
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 8,
        });
        if (ai.openrouter) {
          expect(out.choices[0].message.content).to.contain('ok');
        }
      } catch (err) {
        if (ai.openrouter) throw err;
        expect(err.status).to.equal(403);
      } finally {
        ai.openaiFast.chat.completions.create = origFast;
        if (ai.openrouter && origOr) ai.openrouter.chat.completions.create = origOr;
      }
      expect(calls.filter((c) => c.provider === 'nvidia')).to.have.length(1);
      expect(ai.providerCooldowns().nvidia).to.equal(true);
      expect(ai.NIM_AUTH_COOLDOWN_MS).to.be.at.least(60_000);
      ai.__setProviderCooldownsForTest();
    });

    it('disables NIM thinking so Flash returns JSON instead of a trace', async function () {
      const ai = require('./aiService');
      if (!ai.openaiFast) this.skip();
      ai.__setProviderCooldownsForTest({ openrouterUntil: Date.now() + 60_000 });
      const origFast = ai.openaiFast.chat.completions.create;
      let seen = null;
      ai.openaiFast.chat.completions.create = async (payload) => {
        seen = payload;
        return { choices: [{ message: { content: '{"ok":true}' } }] };
      };
      try {
        await ai.createFastChatCompletion({
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 8,
        });
        expect(seen.model).to.equal('z-ai/glm-5.3');
        expect(seen.chat_template_kwargs.enable_thinking).to.equal(false);
      } finally {
        ai.openaiFast.chat.completions.create = origFast;
        ai.__setProviderCooldownsForTest();
      }
    });

    it('accepts Muse JSON that lands in reasoning_content instead of content', async function () {
      const ai = require('./aiService');
      if (!ai.openaiFast) this.skip();
      ai.__setProviderCooldownsForTest();
      const origFast = ai.openaiFast.chat.completions.create;
      const origOr = ai.openrouter ? ai.openrouter.chat.completions.create : null;
      ai.openaiFast.chat.completions.create = async () => ({
        choices: [{
          message: {
            content: '',
            reasoning_content: 'thinking...\n{"words":[{"word":"brings","translation":"trae"}]}',
          },
        }],
      });
      if (ai.openrouter) {
        ai.openrouter.chat.completions.create = async () => {
          throw new Error('openrouter should not be called');
        };
      }
      try {
        const out = await ai.createFastChatCompletion({
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 32,
        });
        expect(ai.messageToJson(out).words[0].translation).to.equal('trae');
      } finally {
        ai.openaiFast.chat.completions.create = origFast;
        if (ai.openrouter && origOr) ai.openrouter.chat.completions.create = origOr;
        ai.__setProviderCooldownsForTest();
      }
    });

    it('skips an empty NIM 200 and uses OpenRouter when it returns JSON', async function () {
      const ai = require('./aiService');
      if (!ai.openaiFast || !ai.openrouter) this.skip();
      ai.__setProviderCooldownsForTest();
      const origFast = ai.openaiFast.chat.completions.create;
      const origOr = ai.openrouter.chat.completions.create;
      const calls = [];
      ai.openaiFast.chat.completions.create = async ({ model }) => {
        calls.push({ provider: 'nvidia', model });
        return { choices: [{ message: { content: '', reasoning_content: 'still thinking' } }] };
      };
      ai.openrouter.chat.completions.create = async ({ model }) => {
        calls.push({ provider: 'openrouter', model });
        return { choices: [{ message: { content: '{"ok":true}' } }] };
      };
      try {
        const out = await ai.createFastChatCompletion({
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 8,
        });
        expect(out.choices[0].message.content).to.contain('ok');
        expect(calls.some((c) => c.provider === 'nvidia')).to.equal(true);
        expect(calls.some((c) => c.provider === 'openrouter')).to.equal(true);
      } finally {
        ai.openaiFast.chat.completions.create = origFast;
        ai.openrouter.chat.completions.create = origOr;
        ai.__setProviderCooldownsForTest();
      }
    });
  });

  it('should construct correct prompt and return vocabulary', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              vocabulary: [
                {
                  word: 'test',
                  lemma: 'test',
                  definition: 'a trial',
                  cefr_level: 'A1',
                  reason: 'common word',
                },
              ],
            }),
          },
        },
      ],
    };

    let capturedArgs;
    openai.chat.completions.create = async (args) => {
      capturedArgs = args;
      return mockResponse;
    };

    const lyrics = 'This is a test song.';
    const result = await extractVocabulary(lyrics, 'English', 'A1');

    expect(result).to.be.an('array');
    expect(result[0].word).to.equal('test');
    expect(capturedArgs.model).to.equal('z-ai/glm-5.3');
    expect(capturedArgs.messages[0].content).to.contain('English');
    expect(capturedArgs.messages[0].content).to.contain('A1');
    expect(capturedArgs.messages[1].content).to.contain(lyrics);
    expect(capturedArgs.temperature).to.equal(0.6);
  });

  it('includes difficulty rubric in vocabulary extraction prompt', async () => {
    const mockResponse = {
      choices: [{ message: { content: JSON.stringify({ vocabulary: [] }) } }],
    };

    let capturedArgs;
    openai.chat.completions.create = async (args) => {
      capturedArgs = args;
      return mockResponse;
    };

    await extractVocabulary('Lyrics line', 'Spanish', 'A2', 'easy');

    expect(capturedArgs.messages[0].content).to.contain('EASY mode');
    expect(capturedArgs.messages[0].content).to.contain('Difficulty setting: easy');
    expect(capturedArgs.messages[0].content).to.contain('A2');
  });

  it('falls back off NIM after a 429 instead of walking the rest of the NIM chain', async () => {
    const ai = require('./aiService');
    ai.__setProviderCooldownsForTest();
    let nimCalls = 0;
    openai.chat.completions.create = async () => {
      nimCalls += 1;
      const err = new Error('429 Too Many Requests');
      err.status = 429;
      throw err;
    };
    const origOr = ai.openrouter ? ai.openrouter.chat.completions.create : null;
    if (ai.openrouter) {
      ai.openrouter.chat.completions.create = async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      });
    }
    try {
      const response = await createChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(ai.openrouter).to.exist;
      expect(response.choices[0].message.content).to.equal('{"ok":true}');
    } catch (err) {
      if (ai.openrouter) throw err;
      expect(err.status).to.equal(429);
    } finally {
      if (ai.openrouter && origOr) ai.openrouter.chat.completions.create = origOr;
      ai.__setProviderCooldownsForTest();
    }
    expect(nimCalls).to.equal(1);
  });

  it('flags idiom calques like brings → hace caer as suspicious', () => {
    const { translationLooksSuspicious, sanitizeGloss, commonGlossLookup } = require('./aiService');
    expect(translationLooksSuspicious('brings', 'hace caer')).to.equal(true);
    expect(translationLooksSuspicious('brings', 'trae')).to.equal(false);
    expect(translationLooksSuspicious('make', 'hacer')).to.equal(false);
    expect(translationLooksSuspicious('color', 'hope', 'paint the color of hope')).to.equal(true);
    expect(translationLooksSuspicious('color', 'hope EN')).to.equal(false); // suffix stripped → hope; no line
    expect(sanitizeGloss('brings', { translation: 'brings' }).translation).to.equal(null);
    expect(sanitizeGloss('brings', { translation: 'trae' }).translation).to.equal('trae');
    expect(sanitizeGloss('color', { translation: 'hope EN' }, 'color of hope').translation).to.equal(null);
    expect(sanitizeGloss('color', { translation: 'hope EN' }).translation).to.equal('hope');
    expect(commonGlossLookup('color', 'es', 'en')).to.equal('colour');
    expect(commonGlossLookup('esperanza', 'es', 'en')).to.equal('hope');
    expect(translationLooksSuspicious('llamas', 'Genus Lama (organism)')).to.equal(true);
    expect(translationLooksSuspicious('entero', 'int')).to.equal(true);
    expect(translationLooksSuspicious('imán', 'Imam')).to.equal(true);
    expect(translationLooksSuspicious('please', 'FIs')).to.equal(true);
    expect(translationLooksSuspicious('vaivén', 'shuttle cableway, shuttle ropeway')).to.equal(true);
    expect(translationLooksSuspicious('dirán', 'THEY WILL SAY')).to.equal(true);
    expect(commonGlossLookup('llamas', 'es', 'en')).to.equal('you call');
    expect(commonGlossLookup('imán', 'es', 'en')).to.equal('magnet');
    expect(commonGlossLookup('entero', 'es', 'en')).to.equal('whole');
    expect(commonGlossLookup("'Cause", 'en', 'es')).to.equal('porque');
    expect(commonGlossLookup("quedamo'", 'es', 'en')).to.equal('we stay');
    expect(commonGlossLookup('alive', 'en', 'es')).to.equal('vivo');
    expect(commonGlossLookup('Late', 'en', 'es', 'Late nights in the middle of June')).to.equal('tarde');
    expect(commonGlossLookup('gets', 'en', 'es', 'And when it gets hard')).to.equal('se pone');
    expect(commonGlossLookup('magnet', 'en', 'es', 'We push and pull like a magnet do')).to.equal('imán');
    expect(commonGlossLookup('signs', 'en', 'es', 'And in my face is flashing signs')).to.equal('señales');
    expect(translationLooksSuspicious('magnet', 'c. iman.')).to.equal(true);
    expect(translationLooksSuspicious('signs', 'señalización vial')).to.equal(true);
    expect(translationLooksSuspicious('world', 'las')).to.equal(true);
    expect(translationLooksSuspicious('world', 'mundo')).to.equal(false);
    expect(commonGlossLookup('world', 'en', 'es')).to.equal('mundo');
    expect(commonGlossLookup('home', 'en', 'es')).to.equal('hogar');
    expect(commonGlossLookup('planes', 'en', 'es', 'Jet planes, islands, tigers on a gold leash')).to.equal('aviones');
    expect(commonGlossLookup('time', 'en', 'es', 'Tale as old as time')).to.equal('tiempo');
    expect(commonGlossLookup('rule', 'en', 'es', 'Let me be your ruler')).to.equal('gobernar');
    expect(commonGlossLookup('care', 'en', 'es', "We don't care")).to.equal('importar');
    expect(commonGlossLookup('same', 'en', 'es', "You know it's not the same as it was")).to.equal('igual');
    expect(translationLooksSuspicious('home', 'inicio')).to.equal(true);
    expect(translationLooksSuspicious('planes', 'planos')).to.equal(true);
    expect(translationLooksSuspicious('time', 'hora')).to.equal(true);
    expect(translationLooksSuspicious('rule', 'regla')).to.equal(true);
    expect(translationLooksSuspicious('care', 'atención')).to.equal(true);
    expect(translationLooksSuspicious('same', 'Yo igual')).to.equal(true);
    expect(commonGlossLookup('hand', 'en', 'es', 'Take my hand')).to.equal('mano');
    expect(commonGlossLookup('hands', 'en', 'es')).to.equal('manos');
    expect(commonGlossLookup('skin', 'en', 'es', 'under your skin')).to.equal('piel');
    expect(commonGlossLookup('arms', 'en', 'es', 'in my arms')).to.equal('brazos');
    expect(translationLooksSuspicious('hand', 'cacho')).to.equal(true);
    expect(translationLooksSuspicious('hand', 'mano')).to.equal(false);
    expect(translationLooksSuspicious('lady', 'ama')).to.equal(true);
    expect(translationLooksSuspicious('lady', 'dama')).to.equal(false);
    expect(commonGlossLookup('lady', 'en', 'es', "There's a lady who's sure")).to.equal('dama');
    expect(translationLooksSuspicious('wondering', 'maravilla')).to.equal(true);
    expect(translationLooksSuspicious('wondering', 'preguntándose')).to.equal(false);
    const { commonGlossLookupDetailed, isTrustedGlossSource } = require('./aiService');
    expect(commonGlossLookup('wondering', 'en', 'es', 'I was wondering if after all these years')).to.equal('preguntándose');
    expect(commonGlossLookupDetailed('wondering', 'en', 'es').source).to.equal('sense');
    expect(isTrustedGlossSource('sense')).to.equal(true);
    expect(isTrustedGlossSource('stem')).to.equal(false);
    expect(isTrustedGlossSource('dict')).to.equal(false);
    expect(commonGlossLookupDetailed('waited', 'en', 'es').source).to.equal('stem');
    expect(commonGlossLookupDetailed('loved', 'en', 'es').translation).to.equal('amor');
    expect(isTrustedGlossSource(commonGlossLookupDetailed('loved', 'en', 'es').source)).to.equal(false);
    expect(translationLooksSuspicious('skin', 'máscara')).to.equal(true);
    expect(translationLooksSuspicious('arms', 'armamento')).to.equal(true);
  });

  it('rejects encyclopedic MyMemory junk and keeps high-confidence everyday glosses', async () => {
    const { dictionaryGlossFallback } = require('./aiService');
    const junk = await dictionaryGlossFallback(
      'fotón',
      'es',
      'en',
      async () => ({
        ok: true,
        json: async () => ({
          responseData: { translatedText: 'Genus Lama (organism)', match: 1 },
          matches: [{ translation: 'Imam', match: 0.9 }],
        }),
      }),
      'el fotón de luz'
    );
    expect(junk).to.equal(null);

    const lowMatch = await dictionaryGlossFallback('zxqdwellingword', 'es', 'en', async () => ({
      ok: true,
      json: async () => ({
        responseData: { translatedText: 'dwelling', match: 0.2 },
      }),
    }));
    expect(lowMatch).to.equal(null);

    const ok = await dictionaryGlossFallback('zxqhouseword', 'es', 'en', async () => ({
      ok: true,
      json: async () => ({
        responseData: { translatedText: 'house', match: 0.92 },
      }),
    }));
    expect(ok).to.equal('house');

    const curated = await dictionaryGlossFallback(
      'llamas',
      'es',
      'en',
      async () => {
        throw new Error('MyMemory should not be called for curated lemmas');
      },
      'Si tú me llamas'
    );
    expect(curated).to.equal('you call');
  });

  it('prefers curated gloss over conflicting AI neighbor-word mixup', async () => {
    const { glossDailyWords } = require('./aiService');
    const originalCreate = openai.chat.completions.create;
    openai.chat.completions.create = async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            words: [{ word: 'color', translation: 'hope', part_of_speech: 'noun', pronunciation: '/ko.lor/' }],
          }),
        },
      }],
    });
    try {
      const glosses = await glossDailyWords(
        [{ word: 'color', line: 'el color de la vida' }],
        'Spanish',
        {
          fast: true,
          nativeLanguageName: 'English',
          fromLang: 'es',
          toLang: 'en',
          fetchImpl: async () => ({ ok: false }),
        }
      );
      expect(glosses[0].translation).to.equal('colour');
    } finally {
      openai.chat.completions.create = originalCreate;
    }
  });

  it('fast table gloss still ships without IPA so Next is not blocked', async () => {
    const { glossDailyWords } = require('./aiService');
    const table = await glossDailyWords(
      [{ word: 'amor', line: 'mi amor' }],
      'Spanish',
      {
        fast: true,
        nativeLanguageName: 'English',
        fromLang: 'es',
        toLang: 'en',
        fetchImpl: async () => ({ ok: false }),
      }
    );
    expect(table[0].translation).to.be.ok;
    expect(table[0].pronunciation).to.equal(null);
  });

  describe('MyMemory quota + gloss cache', () => {
    const {
      dictionaryGlossFallback,
      parseMyMemoryResetMs,
      isMyMemoryCoolingDown,
      __setMyMemoryCooldownForTest,
      rememberGloss,
      commonGlossLookup,
      buildMyMemoryUrl,
    } = require('./aiService');

    afterEach(() => __setMyMemoryCooldownForTest(0));

    it('parses the MyMemory reset countdown', () => {
      const ms = parseMyMemoryResetMs('NEXT AVAILABLE IN 1 HOURS 2 MINUTES 0 SECONDS');
      expect(ms).to.be.greaterThan(60 * 60 * 1000);
      expect(ms).to.be.lessThan(70 * 60 * 1000);
    });

    it('skips MyMemory while cooling down and uses the persistent cache', async () => {
      rememberGloss('zxqglosscache', 'en', 'es', 'prueba', 'test');
      __setMyMemoryCooldownForTest(Date.now() + 60_000);
      expect(isMyMemoryCoolingDown()).to.equal(true);
      const cached = await dictionaryGlossFallback(
        'zxqglosscache',
        'en',
        'es',
        () => { throw new Error('MyMemory must not be called while cooling down'); }
      );
      expect(cached).to.equal('prueba');

      const miss = await dictionaryGlossFallback(
        'zxqglossmiss',
        'en',
        'es',
        () => { throw new Error('MyMemory must not be called while cooling down'); }
      );
      expect(miss).to.equal(null);
    });

    it('opens the circuit when MyMemory returns a quota warning', async () => {
      const result = await dictionaryGlossFallback(
        'zxqquotaword',
        'en',
        'es',
        async () => ({
          ok: true,
          json: async () => ({
            responseData: {
              translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 1 HOURS 0 MINUTES',
              match: 1,
            },
          }),
        })
      );
      expect(result).to.equal(null);
      expect(isMyMemoryCoolingDown()).to.equal(true);
    });

    it('looks up English plurals from the curated stem', () => {
      expect(commonGlossLookup('nights', 'en', 'es')).to.equal('noches');
    });

    it('glosses blinded and other English inflections without a network call', () => {
      expect(commonGlossLookup('blinded', 'en', 'es', 'blinded by the light')).to.equal('cegado');
      expect(commonGlossLookup('shining', 'en', 'es')).to.equal('brillando');
      expect(commonGlossLookup('waited', 'en', 'es')).to.equal('esperar');
      expect(commonGlossLookup('until', 'en', 'es')).to.equal('hasta');
      expect(commonGlossLookup('crystal', 'en', 'es')).to.equal('cristal');
      expect(commonGlossLookup('become', 'en', 'es')).to.be.ok;
    });

    it('adds de= when MYMEMORY_EMAIL is set', () => {
      const prev = process.env.MYMEMORY_EMAIL;
      process.env.MYMEMORY_EMAIL = 'ops@harmonix.test';
      try {
        expect(buildMyMemoryUrl('nights', 'en', 'es')).to.equal(
          buildMyMemoryUrl('nights', 'en', 'es')
        );
        expect(buildMyMemoryUrl('nights', 'en', 'es')).to.include('de=ops%40harmonix.test');
      } finally {
        if (prev === undefined) delete process.env.MYMEMORY_EMAIL;
        else process.env.MYMEMORY_EMAIL = prev;
      }
    });
  });
});
