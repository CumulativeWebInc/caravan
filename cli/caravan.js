#!/usr/bin/env node
// Caravan — zero-dependency CLI for the agents' marketplace (v0.1).
// Spec: spec/caravan-spec-v0.1.md
'use strict';

const path = require('path');
const { loadRegistry, fileClaim, verifyClaim, readClaims, stats } = require('../lib/store');
const { validateRegistry } = require('../lib/schema');
const { TIERS } = require('../lib/identity');

function usage() {
  return `caravan — the agents' marketplace (v0.1, internal-first)

  list [--kind <kind>] [--json]        list all listings
  search <query>                       search name/description/id
  show <id>                            show one listing
  validate                             schema-validate the registry
  equip-claim --listing <id> --agent <urn> --tier T0|T1|T2|T3|T4 --evidence <text>
                                       file an equip claim (starts unverified)
  equip-verify <claim-id> [--no-hook]  verify a claim (identity + evidence + hook)
  stats [--json]                       registry + equip counters
  site-build <dir>                      build the static browse site into <dir>

verified_external_equips is the only number that may ever be reported upward.`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (k === 'no-hook') { args['no-hook'] = true; continue; }
      args[k] = argv[++i];
    } else args._.push(a);
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(usage());
    return 0;
  }
  switch (cmd) {
    case 'list': {
      const listings = loadRegistry();
      const kind = args.kind;
      const rows = kind ? listings.filter((l) => l.kind === kind) : listings;
      if (args.json) { console.log(JSON.stringify(rows, null, 2)); break; }
      for (const l of rows) console.log(`${l.id}\t${l.kind}\t${l.name} (${l.version})`);
      console.log(`${rows.length}/${listings.length} listings`);
      break;
    }
    case 'search': {
      const q = (args._[1] || '').toLowerCase();
      if (!q) { console.error('search needs a query'); return 2; }
      const rows = loadRegistry().filter((l) =>
        (l.id + ' ' + l.name + ' ' + l.description).toLowerCase().includes(q));
      for (const l of rows) console.log(`${l.id}\t${l.kind}\t${l.name}`);
      console.log(`${rows.length} match(es)`);
      break;
    }
    case 'show': {
      const id = args._[1];
      const l = loadRegistry().find((x) => x.id === id);
      if (!l) { console.error(`unknown listing "${id}"`); return 2; }
      console.log(JSON.stringify(l, null, 2));
      break;
    }
    case 'validate': {
      const fs = require('fs');
      const raw = fs.readFileSync(process.env.CARAVAN_REGISTRY || path.join(__dirname, '..', 'registry', 'listings.json'), 'utf8');
      const r = validateRegistry(JSON.parse(raw));
      if (r.ok) { console.log(`registry valid: ${r.count} listings`); return 0; }
      for (const e of r.errors) console.error('INVALID: ' + e);
      return 1;
    }
    case 'equip-claim': {
      for (const f of ['listing', 'agent', 'tier', 'evidence']) {
        if (!args[f]) { console.error(`equip-claim needs --${f}`); return 2; }
      }
      if (!TIERS.includes(args.tier)) { console.error(`tier must be one of ${TIERS.join('|')}`); return 2; }
      const claim = fileClaim({ listing: args.listing, agent: args.agent, tier: args.tier, evidence: args.evidence });
      console.log(JSON.stringify(claim, null, 2));
      console.error('claim filed as unverified — run equip-verify to adjudicate');
      break;
    }
    case 'equip-verify': {
      const id = args._[1];
      if (!id) { console.error('equip-verify needs a claim id'); return 2; }
      const claim = verifyClaim(id, { runHook: !args['no-hook'] });
      console.log(JSON.stringify(claim.verdict, null, 2));
      console.log(`status: ${claim.status}`);
      break;
    }
    case 'stats': {
      const s = stats();
      if (args.json) { console.log(JSON.stringify(s, null, 2)); break; }
      console.log(`listings:                  ${s.listings}`);
      console.log(`claims_total:              ${s.claims_total}`);
      console.log(`pending_claims:            ${s.pending_claims}`);
      console.log(`verified_external_equips:  ${s.verified_external_equips}   <-- the only reportable number`);
      console.log(`internal_equips (excluded): ${s.internal_equips}`);
      console.log(`rejected_other:            ${s.rejected_other}`);
      break;
    }
    case 'site-build': {
      const outDir = args._[1];
      if (!outDir) { console.error('site-build needs an output directory'); return 2; }
      const fs = require('fs');
      const srcSite = path.join(__dirname, '..', 'site', 'index.html');
      fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(srcSite, path.join(outDir, 'index.html'));
      fs.copyFileSync(process.env.CARAVAN_REGISTRY || path.join(__dirname, '..', 'registry', 'listings.json'),
        path.join(outDir, 'listings.json'));
      fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(stats(), null, 2) + '\n');
      console.log(`site built in ${outDir}`);
      break;
    }
    default:
      console.error(`unknown command "${cmd}"\n` + usage());
      return 2;
  }
  return 0;
}

// Entry-point guard: importable by tests without running main().
if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
module.exports = { main };
