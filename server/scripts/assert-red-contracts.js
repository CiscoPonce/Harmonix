#!/usr/bin/env node
/**
 * Controlled RED gate: run only the explicit Mocha files, require a non-zero
 * exit, and require the named intended-behavior sentinel in the output.
 * Syntax, fixture-load, timeout, and unrelated module-resolution failures
 * are rejected as invalid RED results.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const sentinelIdx = args.indexOf('--sentinel');
if (sentinelIdx === -1 || !args[sentinelIdx + 1]) {
  console.error('Usage: node scripts/assert-red-contracts.js <mocha-files...> --sentinel <NAME>');
  process.exit(2);
}

const sentinel = args[sentinelIdx + 1];
const files = args.slice(0, sentinelIdx).filter(Boolean);
if (files.length === 0) {
  console.error('assert-red-contracts: at least one mocha file is required before --sentinel');
  process.exit(2);
}

const serverRoot = path.resolve(__dirname, '..');
const result = spawnSync(
  process.execPath,
  [require.resolve('mocha/bin/mocha.js'), ...files],
  {
    cwd: serverRoot,
    env: process.env,
    encoding: 'utf8',
  }
);

const output = `${result.stdout || ''}\n${result.stderr || ''}`;

function fail(reason) {
  console.error(`assert-red-contracts: INVALID RED — ${reason}`);
  if (output.trim()) {
    console.error(output);
  }
  process.exit(1);
}

if (result.error) {
  fail(`spawn failed: ${result.error.message}`);
}

if (result.status === null) {
  fail('mocha exited abnormally (signal or crash)');
}

// Hard-reject syntax / timeout / fixture-style failures (not intended RED).
const hardInvalidPatterns = [
  /SyntaxError/,
  /Timeout of \d+ms exceeded/,
  /Error: timeout of \d+ms exceeded/i,
  /fixture.*(missing|failed|load)/i,
];

for (const pattern of hardInvalidPatterns) {
  if (pattern.test(output)) {
    fail(`disallowed failure pattern ${pattern}: tests must fail for missing behavior only`);
  }
}

const hasAssertionWithSentinel = output.includes('AssertionError') && output.includes(sentinel);
const moduleMiss = /Error: Cannot find module|MODULE_NOT_FOUND|ENOENT: no such file or directory/.test(output);
if (moduleMiss && !hasAssertionWithSentinel) {
  fail('module-resolution or missing-file failure without intended-behavior AssertionError');
}

if (result.status === 0) {
  fail(`expected non-zero mocha exit (got 0); sentinel ${sentinel} must come from a failing assertion`);
}

if (!output.includes(sentinel)) {
  fail(`missing required sentinel ${sentinel} in mocha output`);
}

for (const file of files) {
  const abs = path.resolve(serverRoot, file);
  if (output.includes(`Cannot find module '${abs}'`) || output.includes(`Cannot find module '${file}'`)) {
    fail(`test file could not be loaded: ${file}`);
  }
}

console.log(`assert-red-contracts: OK controlled RED for ${sentinel} (${files.join(', ')})`);
process.exit(0);
