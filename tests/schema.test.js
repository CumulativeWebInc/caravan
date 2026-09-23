// Caravan — schema validator tests.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateListing, validateRegistry } = require('../lib/schema');

function goodListing() {
  return {
    id: 'cwi/signal-boy',
    name: 'Signal Boy',
    kind: 'skill',
    seller: 'agent:CWI_Studio',
    version: '2.0.0',
    description: 'Agent Deck gear — category: agent-wearable-devices.',
    install: 'clawhub install cwi/signal-boy',
    source: 'https://github.com/CumulativeWebInc/cwi-learn',
    license: 'MIT-0',
    verify_hook: null,
    created: '2026-09-15',
    updated: '2026-09-19',
  };
}

test('valid listing passes', () => {
  const r = validateListing(goodListing());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('missing required field fails', () => {
  const l = goodListing(); delete l.name;
  const r = validateListing(l);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /"name"/);
});

test('bad id format fails', () => {
  const l = goodListing(); l.id = 'Signal Boy!!';
  assert.equal(validateListing(l).ok, false);
});

test('bad kind fails', () => {
  const l = goodListing(); l.kind = 'nft';
  assert.equal(validateListing(l).ok, false);
});

test('missing kind fails', () => {
  const l = goodListing(); delete l.kind;
  assert.equal(validateListing(l).ok, false);
});

test('marketing superlative in description fails', () => {
  const l = goodListing(); l.description = 'A revolutionary game-changing product.';
  const r = validateListing(l);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /factual/);
});

test('non-object fails', () => {
  assert.equal(validateListing(null).ok, false);
  assert.equal(validateListing([goodListing()]).ok, false);
});

test('duplicate ids fail registry validation', () => {
  const r = validateRegistry([goodListing(), goodListing()]);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /duplicate id/);
});

test('non-array registry fails', () => {
  assert.equal(validateRegistry({}).ok, false);
});

test('generated seed registry validates', () => {
  const fs = require('fs');
  const path = require('path');
  const listings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'registry', 'listings.json'), 'utf8'));
  const r = validateRegistry(listings);
  assert.equal(r.ok, true, JSON.stringify(r.errors.slice(0, 5)));
  assert.ok(listings.length >= 3, 'supply kill rule: at least 3 real products seedable');
});
