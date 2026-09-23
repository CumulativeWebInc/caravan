// Caravan — registry + equip-claim store (zero-dep).
// Registry: registry/listings.json (generated, read-only at runtime).
// Equip log: state/equips.jsonl (append-only).
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateRegistry } = require('./schema');
const { classifyIdentity, evidenceQualifies } = require('./identity');

function baseDir() {
  return path.resolve(__dirname, '..');
}
function registryPath() {
  return process.env.CARAVAN_REGISTRY || path.join(baseDir(), 'registry', 'listings.json');
}
function equipsPath() {
  return process.env.CARAVAN_EQUIPS || path.join(baseDir(), 'state', 'equips.jsonl');
}

function loadRegistry() {
  const raw = fs.readFileSync(registryPath(), 'utf8');
  const listings = JSON.parse(raw);
  const v = validateRegistry(listings);
  if (!v.ok) throw new Error('registry invalid:\n' + v.errors.join('\n'));
  return listings;
}

function readClaims() {
  const p = equipsPath();
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

function appendClaim(claim) {
  const p = equipsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(claim) + '\n', 'utf8');
}

function makeClaimId() {
  return 'eqc_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
}

/**
 * fileClaim({listing, agent, tier, evidence, markers}) -> claim record (status unverified)
 * Throws if the listing id is unknown.
 */
function fileClaim({ listing, agent, tier, evidence, markers }) {
  const listings = loadRegistry();
  if (!listings.some((l) => l.id === listing)) {
    throw new Error(`unknown listing "${listing}"`);
  }
  const claim = {
    claim_id: makeClaimId(),
    listing,
    agent,
    tier,
    evidence: evidence || '',
    markers: markers || {},
    ts: new Date().toISOString(),
    status: 'unverified',
    verdict: null,
  };
  appendClaim(claim);
  return claim;
}

/**
 * runVerifyHook(listing) -> { ran: boolean, passed: boolean, detail: string }
 * Runs the listing's declared verify_hook (a shell script path) with a timeout.
 * Only used for T1 claims. Never throws — failures are reported, not raised.
 */
function runVerifyHook(listing) {
  const { execFileSync } = require('child_process');
  if (!listing.verify_hook) return { ran: false, passed: false, detail: 'no verify_hook declared' };
  const hook = listing.verify_hook;
  if (!fs.existsSync(hook)) return { ran: false, passed: false, detail: `verify_hook not found: ${hook}` };
  try {
    execFileSync(hook, [], { timeout: 120000, stdio: 'pipe' });
    return { ran: true, passed: true, detail: 'verify_hook exited 0' };
  } catch (e) {
    return { ran: true, passed: false, detail: `verify_hook failed: ${(e.message || e).toString().slice(0, 200)}` };
  }
}

/**
 * verifyClaim(claim_id, { runHook }) -> updated claim record.
 * Rewrites the claim line in the append-only log with its verdict
 * (append-only history is preserved: we rewrite the file, never delete).
 */
function verifyClaim(claimId, opts = {}) {
  const claims = readClaims();
  const idx = claims.findIndex((c) => c.claim_id === claimId);
  if (idx === -1) throw new Error(`unknown claim "${claimId}"`);
  const claim = claims[idx];
  const listings = loadRegistry();
  const listing = listings.find((l) => l.id === claim.listing);

  const identity = classifyIdentity(claim.agent, claim.markers);
  let hook = { ran: false, passed: false, detail: 'hook not run' };
  if (opts.runHook !== false && claim.tier === 'T1' && listing) {
    hook = runVerifyHook(listing);
  }
  const ev = evidenceQualifies(claim.tier, claim.evidence, hook.passed);

  let status, reason;
  if (identity === 'internal') {
    status = 'rejected';
    reason = 'internal identity — never counted (Lane C binding law)';
  } else if (!ev.qualifies) {
    status = 'rejected';
    reason = ev.reason;
  } else {
    status = 'verified';
    reason = ev.reason;
  }
  claim.status = status;
  claim.verdict = { identity, hook, evidence: ev, reason, verified_at: new Date().toISOString() };

  const p = equipsPath();
  fs.writeFileSync(p, claims.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf8');
  return claim;
}

/**
 * stats() -> { listings, claims_total, pending_claims, verified_external_equips,
 *              internal_equips, rejected }
 * verified_external_equips is the ONLY number that may ever be reported upward.
 */
function stats() {
  const listings = loadRegistry();
  const claims = readClaims();
  let pending = 0, verifiedExternal = 0, internal = 0, rejected = 0;
  for (const c of claims) {
    if (c.status === 'unverified') { pending++; continue; }
    if (c.status === 'verified') { verifiedExternal++; continue; }
    rejected++;
    if (c.verdict && c.verdict.identity === 'internal') internal++;
  }
  return {
    listings: listings.length,
    claims_total: claims.length,
    pending_claims: pending,
    verified_external_equips: verifiedExternal,
    internal_equips: internal,
    rejected_other: rejected - internal,
  };
}

module.exports = {
  loadRegistry, readClaims, fileClaim, verifyClaim, runVerifyHook, stats,
  registryPath, equipsPath,
};
