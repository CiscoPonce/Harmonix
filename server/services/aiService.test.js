const { expect } = require('chai');
const {
  extractVocabulary,
  createChatCompletion,
  AVAILABLE_MODELS,
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

  it('uses Kimi K2.6 as the default primary model', () => {
    expect(AVAILABLE_MODELS[0]).to.equal('moonshotai/kimi-k2.6');
    expect(AVAILABLE_MODELS).to.include('stepfun-ai/step-3.7-flash');
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
    expect(capturedArgs.model).to.equal('moonshotai/kimi-k2.6');
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

  it('falls back to the next model on rate limit', async () => {
    let callCount = 0;
    openai.chat.completions.create = async (args) => {
      callCount += 1;
      if (args.model === AVAILABLE_MODELS[0]) {
        const err = new Error('429 Too Many Requests');
        err.status = 429;
        throw err;
      }
      return {
        choices: [{ message: { content: '{"ok":true}' } }],
      };
    };

    const response = await createChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(callCount).to.be.at.least(2);
    expect(response.choices[0].message.content).to.equal('{"ok":true}');
  });
});
