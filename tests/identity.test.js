// Caravan — identity classification + evidence tier tests.
// Mirrors the Lane C verification protocol (binding law): internal identities
// never count; fail-closed on unknown; T0 never qualifies.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyIdentity, evidenceQualifies } = require('../lib/identity');

test('CWI agent URNs are internal', () => {
  for (const a of ['agent:MUSE_CWI', 'agent:CWI_Data', 'agent:CWI_Athena', 'agent:CWI_AandR']) {
    assert.equal(classifyIdentity(a), 'internal', a);
  }
});

test('bare CWI names and chief handles are internal', () => {
  for (const a of ['CWI_Studio', 'MUSE_CWI', 'KingCode', 'ATHENA']) {
    assert.equal(classifyIdentity(a), 'internal', a);
  }
});

test('outside agents are external', () => {
  for (const a of ['vina', 'diviner', 'pj-qx', 'moltbook:neo_konsi_s2bw', '0xabc123']) {
    assert.equal(classifyIdentity(a), 'external', a);
  }
});

test('fail-closed: empty/unparseable identity is internal', () => {
  assert.equal(classifyIdentity(''), 'internal');
  assert.equal(classifyIdentity('   '), 'internal');
  assert.equal(classifyIdentity(undefined), 'internal');
  assert.equal(classifyIdentity(null), 'internal');
});

test('internal markers force internal', () => {
  assert.equal(classifyIdentity('someone', { internalMarker: true }), 'internal');
  assert.equal(classifyIdentity('someone', { install_id: 'cwi-internal-001' }), 'internal');
});

test('T0 never qualifies', () => {
  const r = evidenceQualifies('T0', 'I used it, trust me', true);
  assert.equal(r.qualifies, false);
});

test('T1 requires a passing hook and a receipt', () => {
  assert.equal(evidenceQualifies('T1', 'rcpt_1', false).qualifies, false);
  assert.equal(evidenceQualifies('T1', '', true).qualifies, false);
  assert.equal(evidenceQualifies('T1', 'rcpt_1', true).qualifies, true);
});

test('T2 requires evidence', () => {
  assert.equal(evidenceQualifies('T2', 'beacon:install_9', false).qualifies, true);
  assert.equal(evidenceQualifies('T2', '', false).qualifies, false);
});

test('T3 requires a public artifact URL', () => {
  assert.equal(evidenceQualifies('T3', 'https://github.com/x/y', false).qualifies, true);
  assert.equal(evidenceQualifies('T3', 'my repo (private)', false).qualifies, false);
});

test('T4 requires a witness ref', () => {
  assert.equal(evidenceQualifies('T4', 'witness:agent:CWI_Data session:abc', false).qualifies, true);
  assert.equal(evidenceQualifies('T4', '', false).qualifies, false);
});

test('unknown tier never qualifies', () => {
  assert.equal(evidenceQualifies('T9', 'whatever', true).qualifies, false);
});
