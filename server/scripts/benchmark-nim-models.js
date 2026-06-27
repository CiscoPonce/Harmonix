#!/usr/bin/env node
/**
 * One-off benchmark: NVIDIA NIM free chat models for daily-word generation.
 * Uses production prompts from aiService.js. Does NOT modify app code.
 *
 * Usage: node scripts/benchmark-nim-models.js [--models model1,model2]
 */

const { OpenAI } = require('openai');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const API_KEY = process.env.NVIDIA_NIM_API_KEY;

const DEFAULT_MODELS = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.3-70b-instruct',
  'mistralai/mistral-medium-3.5-128b',
  'minimaxai/minimax-m3',
  'moonshotai/kimi-k2.6',
  'stepfun-ai/step-3.7-flash',
  'nvidia/nemotron-4-340b-instruct',
  'deepseek-ai/deepseek-v3.1',
  'qwen/qwen3-235b-a22b-instruct-2507',
  'google/gemma-3-27b-it',
  'microsoft/phi-4-mini-instruct',
];

const SCENARIOS = [
  {
    id: 'pt_correct',
    label: 'Portuguese learner (correct prompt)',
    languageName: 'Portuguese',
    cefrLevel: 'B1',
    genre: 'pop',
    difficulty: 'medium',
    expectLanguage: 'pt',
  },
  {
    id: 'pt_bug',
    label: 'Portuguese user (current bug: defaults to Spanish)',
    languageName: 'Spanish',
    cefrLevel: 'B1',
    genre: 'pop',
    difficulty: 'medium',
    expectLanguage: 'pt',
    note: 'Simulates LANGUAGE_NAMES missing pt → Spanish fallback',
  },
  {
    id: 'en_rock',
    label: 'English learner, genre=rock',
    languageName: 'English',
    cefrLevel: 'B1',
    genre: 'rock',
    difficulty: 'medium',
    expectLanguage: 'en',
    expectGenre: 'rock',
  },
];

const PT_MARKERS = /\b(não|ção|ções|ã|õ|ê|á|í|ó|ú|ç|lh|nh|quando|porque|também|muito|sempre|amor|coração|saudade|beleza|noite|estrela|sonho|mundo|gente|vida|tempo|agora|ainda|nunca|sempre)\b/i;
const ES_MARKERS = /\b(ñ|¿|¡|ción|ión|qué|porque|también|muy|siempre|amor|corazón|noche|estrella|sueño|mundo|gente|vida|tiempo|ahora|todavía|nunca|siempre)\b/i;
const EN_MARKERS = /\b(the|and|you|love|heart|night|dream|world|time|never|always|through|when|where|what|why|how)\b/i;
const ROCK_GENRES = /\b(rock|metal|punk|grunge|alternative|hard\s*rock|indie\s*rock|classic\s*rock)\b/i;

function buildPrompt({ languageName, cefrLevel, genre, difficulty }) {
  return `You are a ${languageName} language teacher. Pick 5 DIFFERENT vocabulary words for a learner. Pair each word with a REAL, well-known ${languageName} song that contains that exact word in its lyrics.

Learner level: ${cefrLevel}
Preferred genre: ${genre}
Difficulty: ${difficulty}

Rules:
1. Each target_word MUST appear verbatim (same spelling) in its matching song lyrics.
2. Choose popular songs likely to have synced lyrics on LRCLib and previews on Deezer.
3. The words should match the learner level (${cefrLevel}).
4. Return realistic song_title and artist names only — no made-up songs.

Reply with ONLY a JSON object containing a "candidates" array, no markdown or explanation:
{
  "candidates": [
    {
      "target_word": "word in lyrics",
      "translation": "English translation",
      "part_of_speech": "noun|verb|adjective|...",
      "pronunciation": "optional IPA or phonetic",
      "difficulty": "easy|medium|hard",
      "song_title": "Song Title",
      "artist": "Artist Name",
      "genre": "genre label"
    }
  ]
}`;
}

function parseJsonContent(raw) {
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
      try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

function scoreLanguage(text, expectLanguage) {
  const blob = JSON.stringify(text).toLowerCase();
  const pt = (blob.match(PT_MARKERS) || []).length;
  const es = (blob.match(ES_MARKERS) || []).length;
  const en = (blob.match(EN_MARKERS) || []).length;

  if (expectLanguage === 'pt') {
    if (pt > es && pt >= 1) return { score: 100, detail: `PT markers ${pt} > ES ${es}` };
    if (es > pt) return { score: 0, detail: `ES markers ${es} > PT ${pt} (wrong language)` };
    return { score: 50, detail: `ambiguous PT=${pt} ES=${es}` };
  }
  if (expectLanguage === 'en') {
    if (en >= 2) return { score: 100, detail: `EN markers ${en}` };
    return { score: 30, detail: `weak EN signal (${en})` };
  }
  return { score: 50, detail: 'n/a' };
}

function scoreGenre(candidates, expectGenre) {
  if (!expectGenre || !candidates?.length) return { score: null, detail: 'n/a', matches: 0, total: 0 };
  const total = candidates.length;
  const matches = candidates.filter((c) => ROCK_GENRES.test(String(c.genre || ''))).length;
  const pct = Math.round((matches / total) * 100);
  return {
    score: pct,
    detail: `${matches}/${total} candidates tagged rock-like`,
    matches,
    total,
  };
}

function scoreResult(parsed, scenario) {
  const candidates = parsed?.candidates || (Array.isArray(parsed) ? parsed : null);
  if (!candidates?.length) {
    return { validJson: false, count: 0, completeness: 0, language: { score: 0, detail: 'no candidates' }, genre: { score: null, detail: 'n/a' }, overall: 0 };
  }

  const required = ['target_word', 'translation', 'song_title', 'artist', 'genre'];
  let filled = 0;
  for (const c of candidates) {
    for (const k of required) {
      if (c[k]) filled += 1;
    }
  }
  const completeness = Math.round((filled / (candidates.length * required.length)) * 100);
  const language = scoreLanguage(candidates, scenario.expectLanguage);
  const genre = scoreGenre(candidates, scenario.expectGenre);
  const countBonus = candidates.length >= 5 ? 20 : candidates.length * 4;
  const genreScore = genre.score ?? 100;
  const overall = Math.round(
    (language.score * 0.45) + (genreScore * 0.25) + (completeness * 0.2) + countBonus * 0.1
  );

  return {
    validJson: true,
    count: candidates.length,
    completeness,
    language,
    genre,
    overall,
    sample: candidates.slice(0, 2).map((c) => ({
      word: c.target_word,
      song: `${c.artist} — ${c.song_title}`,
      genre: c.genre,
    })),
  };
}

async function listModels(client) {
  try {
    const res = await client.models.list();
    return (res.data || []).map((m) => m.id).sort();
  } catch (err) {
    console.warn('Could not list models:', err.message);
    return [];
  }
}

async function probeModel(client, model) {
  try {
    const t0 = Date.now();
    await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 8,
      temperature: 0,
    });
    return { available: true, probeMs: Date.now() - t0 };
  } catch (err) {
    return { available: false, error: `${err.status || ''} ${err.message || err}`.trim().slice(0, 80) };
  }
}

async function runScenario(client, model, scenario) {
  const systemPrompt = buildPrompt(scenario);
  const userPrompt = `Generate 5 ${scenario.languageName} word-of-the-day candidates with matching songs.`;

  const t0 = Date.now();
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.4,
      top_p: 0.95,
    });
    const latencyMs = Date.now() - t0;
    const raw = response.choices?.[0]?.message?.content || '';
    const parsed = parseJsonContent(raw);
    const scores = scoreResult(parsed, scenario);
    return { ok: true, latencyMs, scores, error: null };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      scores: null,
      error: `${err.status || ''} ${err.message || err}`.trim().slice(0, 100),
    };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const arg = process.argv.find((a) => a.startsWith('--models='));
  if (arg) return arg.slice('--models='.length).split(',').map((s) => s.trim()).filter(Boolean);
  return null;
}

async function main() {
  if (!API_KEY) {
    console.error('NVIDIA_NIM_API_KEY missing');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL, timeout: 120000, maxRetries: 0 });
  let models = parseArgs() || DEFAULT_MODELS;

  console.log('Discovering available models...');
  const catalog = await listModels(client);
  if (catalog.length) {
    console.log(`Catalog has ${catalog.length} models. Probing defaults...\n`);
  }

  const available = [];
  for (const model of models) {
    if (catalog.length && !catalog.includes(model)) {
      console.log(`  skip ${model} — not in catalog`);
      continue;
    }
    process.stdout.write(`  probe ${model} ... `);
    const probe = await probeModel(client, model);
    if (probe.available) {
      console.log(`OK (${probe.probeMs}ms)`);
      available.push(model);
    } else {
      console.log(`FAIL (${probe.error})`);
    }
    await sleep(1500);
  }

  if (!available.length) {
    console.error('No models available for benchmark.');
    process.exit(1);
  }

  console.log(`\nRunning ${available.length} models × ${SCENARIOS.length} scenarios...\n`);
  const results = [];

  for (const model of available) {
    for (const scenario of SCENARIOS) {
      process.stdout.write(`  ${model} / ${scenario.id} ... `);
      const result = await runScenario(client, model, scenario);
      results.push({ model, scenario, ...result });
      if (result.ok) {
        console.log(`${result.latencyMs}ms | quality ${result.scores.overall}/100 | lang ${result.scores.language.score}`);
      } else {
        console.log(`ERROR: ${result.error}`);
      }
      await sleep(2000);
    }
  }

  // Aggregate per model
  const byModel = new Map();
  for (const r of results) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model).push(r);
  }

  const summary = [];
  for (const [model, rows] of byModel) {
    const okRows = rows.filter((r) => r.ok);
    const avgLatency = okRows.length
      ? Math.round(okRows.reduce((s, r) => s + r.latencyMs, 0) / okRows.length)
      : null;
    const ptCorrect = okRows.find((r) => r.scenario.id === 'pt_correct');
    const ptBug = okRows.find((r) => r.scenario.id === 'pt_bug');
    const enRock = okRows.find((r) => r.scenario.id === 'en_rock');
    const avgQuality = okRows.length
      ? Math.round(okRows.reduce((s, r) => s + r.scores.overall, 0) / okRows.length)
      : 0;
    summary.push({
      model,
      available: okRows.length,
      failed: rows.length - okRows.length,
      avgLatencyMs: avgLatency,
      ptCorrectLang: ptCorrect?.scores?.language?.score ?? '-',
      ptBugLang: ptBug?.scores?.language?.score ?? '-',
      enRockGenre: enRock?.scores?.genre?.detail ?? '-',
      enRockGenrePct: enRock?.scores?.genre?.score ?? '-',
      avgQuality,
      ptCorrectMs: ptCorrect?.latencyMs ?? '-',
      enRockMs: enRock?.latencyMs ?? '-',
    });
  }

  summary.sort((a, b) => {
    if (b.avgQuality !== a.avgQuality) return b.avgQuality - a.avgQuality;
    return (a.avgLatencyMs || 99999) - (b.avgLatencyMs || 99999);
  });

  console.log('\n=== BENCHMARK SUMMARY (JSON) ===');
  console.log(JSON.stringify({ ranAt: new Date().toISOString(), summary, details: results.map((r) => ({
    model: r.model,
    scenario: r.scenario.id,
    ok: r.ok,
    latencyMs: r.latencyMs,
    error: r.error,
    overall: r.scores?.overall,
    language: r.scores?.language,
    genre: r.scores?.genre,
    sample: r.scores?.sample,
  })) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
