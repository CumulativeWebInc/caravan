// Caravan — CLI end-to-end tests (spawns the real CLI with isolated env).
'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = path.join(__dirname, '..');
const CLI = path.join(BASE, 'cli', 'caravan.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'caravan-cli-'));

let env;
beforeEach(() => {
  const n = process.hrtime.bigint().toString();
  const reg = path.join(TMP, `reg-${n}.json`);
  fs.writeFileSync(reg, JSON.stringify([{
    id: 'cwi/widget', name: 'Widget', kind: 'product', seller: 'agent:CWI_Studio',
    version: '1.0.0', description: 'A test widget.', install: null,
    source: 'https://example.com/widget', license: 'MIT-0', verify_hook: null,
    created: '2026-09-20', updated: '2026-09-20',
  }]));
  env = {
    ...process.env,
    CARAVAN_REGISTRY: reg,
    CARAVAN_EQUIPS: path.join(TMP, `eq-${n}.jsonl`),
  };
});

function run(...args) {
  return execFileSync('node', [CLI, ...args], { env, encoding: 'utf8' });
}

function runFail(...args) {
  try {
    execFileSync('node', [CLI, ...args], { env, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    return e.status;
  }
  return 0;
}

test('validate exits 0 on a good registry', () => {
  const out = run('validate');
  assert.match(out, /registry valid: 1 listings/);
});

test('list shows the listing', () => {
  assert.match(run('list'), /cwi\/widget/);
});

test('search finds and misses honestly', () => {
  assert.match(run('search', 'widget'), /cwi\/widget/);
  assert.match(run('search', 'zzz-no-such-thing'), /0 match/);
});

test('show prints the record; unknown id exits non-zero', () => {
  assert.match(run('show', 'cwi/widget'), /"id": "cwi\/widget"/);
  assert.notEqual(runFail('show', 'cwi/nope'), 0);
});

test('equip-claim then equip-verify round trip (external T3)', () => {
  const claimOut = run('equip-claim', '--listing', 'cwi/widget', '--agent', 'vina',
    '--tier', 'T3', '--evidence', 'https://example.com/proof');
  const claim = JSON.parse(claimOut);
  assert.equal(claim.status, 'unverified');
  const verifyOut = run('equip-verify', claim.claim_id, '--no-hook');
  assert.match(verifyOut, /status: verified/);
  assert.match(run('stats'), /verified_external_equips:\s+1/);
});

test('internal claim is rejected by the CLI', () => {
  const claim = JSON.parse(run('equip-claim', '--listing', 'cwi/widget',
    '--agent', 'agent:CWI_Data', '--tier', 'T3', '--evidence', 'https://example.com/x'));
  const out = run('equip-verify', claim.claim_id, '--no-hook');
  assert.match(out, /status: rejected/);
  assert.match(run('stats'), /verified_external_equips:\s+0/);
});

test('equip-claim on unknown listing exits non-zero', () => {
  assert.notEqual(runFail('equip-claim', '--listing', 'cwi/nope', '--agent', 'vina',
    '--tier', 'T3', '--evidence', 'https://x.y'), 0);
});

test('equip-claim rejects bad tier', () => {
  assert.notEqual(runFail('equip-claim', '--listing', 'cwi/widget', '--agent', 'vina',
    '--tier', 'T9', '--evidence', 'x'), 0);
});

test('real seed registry validates through the CLI', () => {
  const out = execFileSync('node', [CLI, 'validate'], {
    env: { ...process.env, CARAVAN_REGISTRY: path.join(BASE, 'registry', 'listings.json') },
    encoding: 'utf8',
  });
  assert.match(out, /registry valid: 31 listings/);
});

test('site-build emits index.html + listings.json + stats.json', () => {
  const outDir = path.join(TMP, 'site-out');
  const out = run('site-build', outDir);
  assert.match(out, /site built in/);
  assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
  const listings = JSON.parse(fs.readFileSync(path.join(outDir, 'listings.json'), 'utf8'));
  assert.equal(listings.length, 1);
  const st = JSON.parse(fs.readFileSync(path.join(outDir, 'stats.json'), 'utf8'));
  assert.equal(st.listings, 1);
  assert.equal(st.verified_external_equips, 0);
});
