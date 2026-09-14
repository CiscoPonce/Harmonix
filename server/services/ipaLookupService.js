const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const tables = new Map();

function formatIpa(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("[")) return trimmed;
  return `/${trimmed}/`;
}

function lemmaForIpa(word) {
  return String(word || "")
    .normalize("NFC")
    .trim()
    .replace(/^[''`´‘’]+/u, "")
    .replace(/[''`´‘’]+$/gu, "")
    .toLowerCase();
}

function loadTable(lang) {
  const code = String(lang || "").toLowerCase().slice(0, 2);
  if (tables.has(code)) return tables.get(code);
  const file = path.join(__dirname, "..", "constants", "ipa", `${code}.json.gz`);
  let table = {};
  if (fs.existsSync(file)) {
    try {
      table = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
    } catch (err) {
      console.warn(`[ipaLookup] failed to load ${code}:`, err.message || err);
      table = {};
    }
  }
  tables.set(code, table);
  return table;
}

/**
 * Offline IPA for a target-language word. Direct lookup only — stemming
 * younger→young would show the wrong phonetics.
 */
function lookupOfflineIpa(word, lang) {
  const table = loadTable(lang);
  const lemma = lemmaForIpa(word);
  if (!lemma) return null;
  if (table[lemma]) return formatIpa(table[lemma]);
  const raw = String(word || "").trim().toLowerCase();
  if (raw && table[raw]) return formatIpa(table[raw]);
  return null;
}

module.exports = {
  lookupOfflineIpa,
  formatIpa,
  lemmaForIpa,
  loadTable,
};
