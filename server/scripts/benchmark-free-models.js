#!/usr/bin/env node
/**
 * Benchmark free NVIDIA NIM + OpenRouter models for Harmonix tasks:
 *  1) Vocabulary gloss (idiom trap: "brings" ≠ "hace caer")
 *  2) Daily-word song candidates JSON
 *
 * Usage (from server/):
 *   node scripts/benchmark-free-models.js
 *   node scripts/benchmark-free-models.js --provider=nvidia
 *   node scripts/benchmark-free-models.js --provider=openrouter
 */

const { OpenAI } = require('openai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const NVIDIA_MODELS = [
  'moonshotai/kimi-k2.6',
  'stepfun-ai/step-3.7-flash',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.3-70b-instruct',
  'mistralai/mistral-medium-3.5-128b',
  'minimaxai/minimax-m3',
  'google/gemma-3-27b-it',
  'microsoft/phi-4-mini-instruct',
  'qwen/qwen3-next-80b-a3b-instruct',
  'nvidia/nvidia-nemotron-nano-9b-v2',
];

const OPENROUTER_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'poolside/laguna-xs-2.1:free',
  'poolside/laguna-s-2.1:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3.5-content-safety:free',
];

const GOOD_BRINGS = /\b(trae|lleva|aport[ae]|bring[se]?|bring)\b/i;
const BAD_BRINGS = /\b(hace\s+caer|derriba|tira|makes?\s+fall|brings?\s+down)\b/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function scoreGloss(parsed) {
  const word = parsed?.words?.[0] || parsed?.items?.[0] || parsed;
  const translation = String(word?.translation || '').trim();
  if (!translation) return { score: 0, translation: '', detail: 'empty' };
  if (BAD_BRINGS.test(translation)) {
    return { score: 0, translation, detail: 'idiom calque (bad)' };
  }
  if (GOOD_BRINGS.test(translation)) {
    return { score: 100, translation, detail: 'correct sense' };
  }
  // Accept other reasonable short glosses that are not calques
  const tokens = translation.split(/\s+/).filter(Boolean);
  if (tokens.length <= 3 && translation.toLowerCase() !== 'brings') {
    return { score: 60, translation, detail: 'plausible non-calque' };
  }
  return { score: 20, translation, detail: 'weak/unclear' };
}

function scoreCandidates(parsed) {
  const list = parsed?.candidates || parsed?.words || [];
  if (!Array.isArray(list) || !list.length) {
    return { score: 0, count: 0, detail: 'no candidates' };
  }
  let ok = 0;
  for (const c of list.slice(0, 5)) {
    if (c?.target_word && c?.song_title && c?.artist) ok += 1;
  }
  const score = Math.round((ok / Math.min(5, list.length || 5)) * 100);
  return { score, count: list.length, detail: `${ok}/5 complete rows` };
}

async function chatJson(client, model, messages, { maxTokens = 1024, temperature = 0.15 } = {}) {
  const t0 = Date.now();
  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature,
    });
    const raw = response.choices?.[0]?.message?.content || '';
    return {
      ok: true,
      latencyMs: Date.now() - t0,
      parsed: parseJson(raw),
      raw: raw.slice(0, 240),
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      parsed: null,
      raw: '',
      error: `${err.status || ''} ${err.message || err}`.trim().slice(0, 140),
    };
  }
}

async function runGloss(client, model) {
  const messages = [
    {
      role: 'system',
      content:
        'You translate single English words into Spanish for learners. Use lyric context only to disambiguate sense — never paraphrase the whole line. Return JSON only.',
    },
    {
      role: 'user',
      content: `Translate ONLY the single target word into Spanish.
Use the lyric line only to pick the correct dictionary sense — never gloss the whole phrase.
WRONG: "brings" → "hace caer" because the line says "brings me down"; RIGHT: "trae".
Items: ${JSON.stringify([{ word: 'brings', line: '…brings me down… under pressure' }])}
Reply: { "words": [ { "word": "...", "translation": "...", "part_of_speech": "verb", "pronunciation": "/.../" } ] }`,
    },
  ];
  const result = await chatJson(client, model, messages, { maxTokens: 256, temperature: 0.1 });
  if (!result.ok) return { task: 'gloss', ...result, scores: null };
  return { task: 'gloss', ...result, scores: scoreGloss(result.parsed) };
}

async function runCandidates(client, model) {
  const messages = [
    {
      role: 'system',
      content:
        'You are an English language teacher. Return JSON only with real song titles/artists.',
    },
    {
      role: 'user',
      content: `Pick 3 DIFFERENT English vocabulary words for a B1 learner. Pair each with a REAL well-known English song that contains that exact word.
Preferred genre: rock
Reply ONLY:
{ "candidates": [ { "target_word": "...", "translation": "Spanish gloss", "part_of_speech": "...", "pronunciation": "...", "song_title": "...", "artist": "...", "genre": "rock" } ] }`,
    },
  ];
  const result = await chatJson(client, model, messages, { maxTokens: 900, temperature: 0.3 });
  if (!result.ok) return { task: 'candidates', ...result, scores: null };
  return { task: 'candidates', ...result, scores: scoreCandidates(result.parsed) };
}

async function probe(client, model) {
  const t0 = Date.now();
  try {
    await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply with {"ok":true}' }],
      response_format: { type: 'json_object' },
      max_tokens: 32,
      temperature: 0,
    });
    return { available: true, ms: Date.now() - t0 };
  } catch (err) {
    return {
      available: false,
      ms: Date.now() - t0,
      error: `${err.status || ''} ${err.message || err}`.trim().slice(0, 100),
    };
  }
}

function parseArgs() {
  const provider = (process.argv.find((a) => a.startsWith('--provider=')) || '').split('=')[1] || 'both';
  const modelsArg = process.argv.find((a) => a.startsWith('--models='));
  const models = modelsArg
    ? modelsArg.slice('--models='.length).split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  return { provider, models };
}

function rankRows(rows) {
  return [...rows].sort((a, b) => {
    const as = (a.glossScore ?? -1) + (a.candScore ?? -1);
    const bs = (b.glossScore ?? -1) + (b.candScore ?? -1);
    if (bs !== as) return bs - as;
    return (a.avgLatency || 999999) - (b.avgLatency || 999999);
  });
}

async function benchProvider(label, client, models) {
  console.log(`\n=== ${label} ===`);
  const usable = [];
  for (const model of models) {
    process.stdout.write(`  probe ${model} ... `);
    const p = await probe(client, model);
    if (p.available) {
      console.log(`OK (${p.ms}ms)`);
      usable.push(model);
    } else {
      console.log(`FAIL ${p.error}`);
    }
    await sleep(800);
  }

  const summaries = [];
  for (const model of usable) {
    process.stdout.write(`  gloss  ${model} ... `);
    const gloss = await runGloss(client, model);
    if (gloss.ok) {
      console.log(`${gloss.latencyMs}ms | ${gloss.scores.score}/100 | "${gloss.scores.translation}" (${gloss.scores.detail})`);
    } else {
      console.log(`ERROR ${gloss.error}`);
    }
    await sleep(1200);

    process.stdout.write(`  songs  ${model} ... `);
    const cand = await runCandidates(client, model);
    if (cand.ok) {
      console.log(`${cand.latencyMs}ms | ${cand.scores.score}/100 | ${cand.scores.detail}`);
    } else {
      console.log(`ERROR ${cand.error}`);
    }
    await sleep(1500);

    const latencies = [gloss.ok ? gloss.latencyMs : null, cand.ok ? cand.latencyMs : null].filter((n) => n != null);
    summaries.push({
      provider: label,
      model,
      glossOk: gloss.ok,
      glossScore: gloss.scores?.score ?? null,
      glossTranslation: gloss.scores?.translation || null,
      glossDetail: gloss.scores?.detail || gloss.error,
      candOk: cand.ok,
      candScore: cand.scores?.score ?? null,
      candDetail: cand.scores?.detail || cand.error,
      avgLatency: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
    });
  }
  return summaries;
}

async function main() {
  const { provider, models } = parseArgs();
  const all = [];

  if ((provider === 'both' || provider === 'nvidia') && process.env.NVIDIA_NIM_API_KEY) {
    const nvidia = new OpenAI({
      apiKey: process.env.NVIDIA_NIM_API_KEY,
      baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      timeout: 90000,
      maxRetries: 0,
    });
    all.push(
      ...(await benchProvider(
        'NVIDIA NIM',
        nvidia,
        models && provider === 'nvidia' ? models : NVIDIA_MODELS
      ))
    );
  } else if (provider === 'nvidia') {
    console.error('NVIDIA_NIM_API_KEY missing');
  }

  if ((provider === 'both' || provider === 'openrouter') && process.env.OPENROUTER_API_KEY) {
    const or = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      timeout: 90000,
      maxRetries: 0,
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://harmonix.app',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Harmonix-bench',
      },
    });
    all.push(
      ...(await benchProvider(
        'OpenRouter free',
        or,
        models && provider === 'openrouter' ? models : OPENROUTER_MODELS
      ))
    );
  } else if (provider === 'openrouter' || provider === 'both') {
    console.warn('OPENROUTER_API_KEY missing — skipping OpenRouter');
  }

  const ranked = rankRows(all.filter((r) => r.glossOk || r.candOk));
  console.log('\n=== RANKING (gloss + candidates quality, then latency) ===\n');
  console.log(
    'rank | provider | model | gloss | gloss_text | songs | avg_ms'
  );
  ranked.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(2)} | ${r.provider.padEnd(14)} | ${r.model} | ${String(r.glossScore ?? '-').padStart(3)} | ${(r.glossTranslation || r.glossDetail || '').slice(0, 18).padEnd(18)} | ${String(r.candScore ?? '-').padStart(3)} | ${r.avgLatency ?? '-'}`
    );
  });

  const bestGloss = [...all]
    .filter((r) => r.glossScore != null)
    .sort((a, b) => b.glossScore - a.glossScore || (a.avgLatency || 9e9) - (b.avgLatency || 9e9))[0];
  const bestOverall = ranked[0];
  const currentPrimary = 'moonshotai/kimi-k2.6';
  const currentRow = all.find((r) => r.model === currentPrimary);

  console.log('\n=== RECOMMENDATION ===');
  if (bestOverall) {
    console.log(`Best overall for Harmonix tasks: ${bestOverall.provider} / ${bestOverall.model}`);
  }
  if (bestGloss) {
    console.log(
      `Best gloss (brings→Spanish): ${bestGloss.provider} / ${bestGloss.model} → "${bestGloss.glossTranslation}" (${bestGloss.glossScore}/100)`
    );
  }
  if (currentRow) {
    console.log(
      `Current primary ${currentPrimary}: gloss ${currentRow.glossScore ?? 'n/a'}/100, songs ${currentRow.candScore ?? 'n/a'}/100, avg ${currentRow.avgLatency ?? 'n/a'}ms`
    );
  } else {
    console.log(`Current primary ${currentPrimary}: unavailable in this run`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
