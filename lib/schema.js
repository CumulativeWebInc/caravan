// Caravan — listing schema + validator (zero-dep).
// Spec: spec/caravan-spec-v0.1.md §2.1
'use strict';

const KINDS = ['product', 'skill', 'service', 'app'];
const ID_RE = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const REQUIRED_STRING = ['id', 'name', 'seller', 'version', 'description', 'source', 'license'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * validateListing(obj) -> { ok: boolean, errors: string[] }
 * Pure function: no I/O, no state.
 */
function validateListing(obj) {
  const errors = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['listing must be an object'] };
  }
  for (const f of REQUIRED_STRING) {
    if (!isNonEmptyString(obj[f])) errors.push(`"${f}" must be a non-empty string`);
  }
  if (isNonEmptyString(obj.id) && !ID_RE.test(obj.id)) {
    errors.push(`"id" must match <namespace>/<slug> (lowercase, hyphens): got "${obj.id}"`);
  }
  if (obj.kind !== undefined && !KINDS.includes(obj.kind)) {
    errors.push(`"kind" must be one of ${KINDS.join('|')}: got "${obj.kind}"`);
  } else if (obj.kind === undefined) {
    errors.push('"kind" is required');
  }
  if (obj.install !== null && obj.install !== undefined && typeof obj.install !== 'string') {
    errors.push('"install" must be a string or null');
  }
  if (obj.verify_hook !== null && obj.verify_hook !== undefined && typeof obj.verify_hook !== 'string') {
    errors.push('"verify_hook" must be a string path or null');
  }
  for (const f of ['created', 'updated']) {
    if (obj[f] !== undefined && !(typeof obj[f] === 'string' && DATE_RE.test(obj[f]))) {
      errors.push(`"${f}" must be YYYY-MM-DD: got "${obj[f]}"`);
    }
  }
  // No marketing superlatives in descriptions — factual tone is a spec rule.
  if (isNonEmptyString(obj.description)) {
    const hype = /\b(revolutionary|world-class|best-in-class|game-?changing|cutting-edge|ultimate|unparalleled)\b/i;
    if (hype.test(obj.description)) errors.push('"description" must be factual — no marketing superlatives');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * validateRegistry(listings) -> { ok, errors, ids }
 * Also enforces id uniqueness.
 */
function validateRegistry(listings) {
  const errors = [];
  const seen = new Set();
  const items = Array.isArray(listings) ? listings : [];
  if (!Array.isArray(listings)) errors.push('registry must be an array of listings');
  items.forEach((l, i) => {
    const r = validateListing(l);
    for (const e of r.errors) errors.push(`listings[${i}]: ${e}`);
    if (l && typeof l.id === 'string') {
      if (seen.has(l.id)) errors.push(`listings[${i}]: duplicate id "${l.id}"`);
      seen.add(l.id);
    }
  });
  return { ok: errors.length === 0, errors, count: items.length };
}

module.exports = { validateListing, validateRegistry, KINDS };
