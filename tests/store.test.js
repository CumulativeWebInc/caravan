// Caravan — store tests (claim lifecycle + counting rules).
// Isolated: CARAVAN_REGISTRY / CARAVAN_EQUIPS point at /tmp fixtures.
'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'caravan-test-'));

function fixtureRegistry() {
  const listings = [
    {
      id: 'cwi/widget', name: 'Widget', kind: 'product', seller: 'agent:CWI_Studio',
      version: '1.0.0', description: 'A test widget.', install: null,
      source: 'https://example.com/widget', license: 'MIT-0', verify_hook: null,
      created: '2026-09-20', updated: '2026-09-20',
    },
    {
      id: 'cwi/gadget', name: 'Gadget', kind: 'skill', seller: 'agent:CWI_Data',
      version: '0.2.0', description: 'A test gadget with a hook.',
      install: 'clawhub install cwi/gadget', source: 'https://example.com/gadget',
      license: 'MIT-0', verify_hook: path.join(TMP, 'hook-ok.sh'),
      created: '2026-09-20', updated: '2026-09-20',
    },
  ];
  fs.writeFileSync(path.join(TMP, 'hook-ok.sh'), '#!/bin/sh\nexit 0\n');
  fs.chmodSync(path.join(TMP, 'hook-ok.sh'), 0o755);
  return listings;
}

beforeEach(() => {
  const reg = path.join(TMP, `reg-${process.hrtime.bigint()}.json`);
  fs.writeFileSync(reg, JSON.stringify(fixtureRegistry()));
  process.env.CARAVAN_REGISTRY = reg;
  process.env.CARAVAN_EQUIPS = path.join(TMP, `eq-${process.hrtime.bigint()}.jsonl`);
  delete require.cache[require.resolve('../lib/store')];
});

function store() {
  delete require.cache[require.resolve('../lib/store')];
  return require('../lib/store');
}

test('fileClaim rejects unknown listing', () => {
  assert.throws(() => store().fileClaim({ listing: 'cwi/nope', agent: 'vina', tier: 'T3', evidence: 'https://x.y' }), /unknown listing/);
});

test('fileClaim creates an unverified claim', () => {
  const c = store().fileClaim({ listing: 'cwi/widget', agent: 'vina', tier: 'T3', evidence: 'https://example.com/used-it' });
  assert.equal(c.status, 'unverified');
  assert.match(c.claim_id, /^eqc_/);
});

test('internal agent claim is rejected and never counted', () => {
  const s = store();
  const c = s.fileClaim({ listing: 'cwi/widget', agent: 'agent:CWI_Marketing', tier: 'T3', evidence: 'https://example.com/x' });
  const v = s.verifyClaim(c.claim_id, { runHook: false });
  assert.equal(v.status, 'rejected');
  assert.match(v.verdict.reason, /internal identity/);
  const st = s.stats();
  assert.equal(st.verified_external_equips, 0);
  assert.equal(st.internal_equips, 1);
});

test('T0 claim is rejected', () => {
  const s = store();
  const c = s.fileClaim({ listing: 'cwi/widget', agent: 'vina', tier: 'T0', evidence: 'trust me' });
  const v = s.verifyClaim(c.claim_id, { runHook: false });
  assert.equal(v.status, 'rejected');
  assert.equal(s.stats().verified_external_equips, 0);
});

test('external T3 claim with artifact URL verifies', () => {
  const s = store();
  const c = s.fileClaim({ listing: 'cwi/widget', agent: 'diviner', tier: 'T3', evidence: 'https://moltbook.example/post/1' });
  const v = s.verifyClaim(c.claim_id, { runHook: false });
  assert.equal(v.status, 'verified');
  assert.equal(s.stats().verified_external_equips, 1);
});

test('external T1 claim verifies only with a passing hook', () => {
  const s = store();
  const c1 = s.fileClaim({ listing: 'cwi/widget', agent: 'vina', tier: 'T1', evidence: 'rcpt_1' });
  assert.equal(s.verifyClaim(c1.claim_id, { runHook: false }).status, 'rejected'); // no hook declared
  const c2 = s.fileClaim({ listing: 'cwi/gadget', agent: 'vina', tier: 'T1', evidence: 'rcpt_2' });
  const v2 = s.verifyClaim(c2.claim_id); // hook runs (exit 0)
  assert.equal(v2.status, 'verified');
  assert.equal(v2.verdict.hook.passed, true);
  assert.equal(s.stats().verified_external_equips, 1);
});

test('failing verify_hook rejects the T1 claim', () => {
  const s = store();
  const badHook = path.join(TMP, 'hook-bad.sh');
  fs.writeFileSync(badHook, '#!/bin/sh\nexit 3\n');
  fs.chmodSync(badHook, 0o755);
  const listings = JSON.parse(fs.readFileSync(process.env.CARAVAN_REGISTRY, 'utf8'));
  listings[1].verify_hook = badHook;
  fs.writeFileSync(process.env.CARAVAN_REGISTRY, JSON.stringify(listings));
  const c = s.fileClaim({ listing: 'cwi/gadget', agent: 'vina', tier: 'T1', evidence: 'rcpt_9' });
  const v = s.verifyClaim(c.claim_id);
  assert.equal(v.status, 'rejected');
  assert.equal(v.verdict.hook.passed, false);
});

test('stats separate the three numbers honestly', () => {
  const s = store();
  const a = s.fileClaim({ listing: 'cwi/widget', agent: 'diviner', tier: 'T3', evidence: 'https://x.y/1' });
  const b = s.fileClaim({ listing: 'cwi/widget', agent: 'agent:CWI_Data', tier: 'T3', evidence: 'https://x.y/2' });
  s.fileClaim({ listing: 'cwi/widget', agent: 'vina', tier: 'T0', evidence: 'meh' }); // stays pending
  s.verifyClaim(a.claim_id, { runHook: false });
  s.verifyClaim(b.claim_id, { runHook: false });
  const st = s.stats();
  assert.equal(st.verified_external_equips, 1);
  assert.equal(st.internal_equips, 1);
  assert.equal(st.pending_claims, 1);
  assert.equal(st.claims_total, 3);
});

test('verifyClaim on unknown id throws', () => {
  assert.throws(() => store().verifyClaim('eqc_nope', { runHook: false }), /unknown claim/);
});
