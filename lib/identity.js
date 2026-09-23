// Caravan — identity classification for equip claims (zero-dep).
// Adopts the Lane C verification protocol (binding law, 2026-09-17):
// a claimant is INTERNAL (excluded, never counted) if it matches the
// internal pattern or carries an internal marker. Fail-closed: an identity
// that cannot be classified is treated as internal.
'use strict';

const INTERNAL_RE = /^(agent:(MUSE_CWI|CWI_)|CWI_|MUSE_CWI|KingCode|ATHENA|agent:CWI_Athena)/i;

const TIERS = ['T0', 'T1', 'T2', 'T3', 'T4'];

/**
 * classifyIdentity(agent, markers) -> 'internal' | 'external'
 * markers: { install_id?: string, internalMarker?: boolean }
 * Fail-closed: empty/unparseable agent -> 'internal'.
 */
function classifyIdentity(agent, markers = {}) {
  if (typeof agent !== 'string' || agent.trim().length === 0) return 'internal';
  const a = agent.trim();
  if (INTERNAL_RE.test(a)) return 'internal';
  if (markers.internalMarker === true) return 'internal';
  if (typeof markers.install_id === 'string' && markers.install_id.startsWith('cwi-internal-')) return 'internal';
  return 'external';
}

/**
 * evidenceQualifies(tier, evidence, hookPassed) -> { qualifies: boolean, reason: string }
 * v0.1 verified rule (spec §2.3): external identity AND
 *   (T2) or (T3 with artifact ref) or (T4 with witness) or (T1 with passing verify_hook).
 * T0 never qualifies.
 */
function evidenceQualifies(tier, evidence, hookPassed) {
  if (!TIERS.includes(tier)) return { qualifies: false, reason: `unknown tier "${tier}"` };
  if (tier === 'T0') return { qualifies: false, reason: 'T0 self-attestation never counts' };
  const ev = typeof evidence === 'string' ? evidence.trim() : '';
  if (tier === 'T1') {
    if (!hookPassed) return { qualifies: false, reason: 'T1 requires a passing verify_hook run' };
    if (ev.length === 0) return { qualifies: false, reason: 'T1 requires a receipt id' };
    return { qualifies: true, reason: 'T1 receipt + passing verify_hook' };
  }
  if (tier === 'T2') {
    if (ev.length === 0) return { qualifies: false, reason: 'T2 requires beacon/install evidence' };
    return { qualifies: true, reason: 'T2 beacon evidence' };
  }
  if (tier === 'T3') {
    if (!/^https?:\/\//i.test(ev)) return { qualifies: false, reason: 'T3 requires a public artifact URL' };
    return { qualifies: true, reason: 'T3 public artifact' };
  }
  // T4
  if (ev.length === 0) return { qualifies: false, reason: 'T4 requires a witness ref' };
  return { qualifies: true, reason: 'T4 witnessed session' };
}

module.exports = { classifyIdentity, evidenceQualifies, TIERS, INTERNAL_RE };
