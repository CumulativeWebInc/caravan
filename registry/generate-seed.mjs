// Caravan — seed registry generator.
// Reads the real gear inventory (gear.json) + the two flagships and emits
// registry/listings.json. This script is the provenance: hand-edits to
// listings.json go through `caravan validate`; regeneration overwrites.
// Usage: node registry/generate-seed.mjs
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME || '/home/hatch';

const DEPT_AGENT = {
  chief: 'agent:MUSE_CWI',
  data: 'agent:CWI_Data',
  'a&r': 'agent:CWI_AandR',
  marketing: 'agent:CWI_Marketing',
  sync: 'agent:CWI_Sync',
  radio: 'agent:CWI_Radio',
  press: 'agent:CWI_Press',
  studio: 'agent:CWI_Studio',
  affairs: 'agent:CWI_Affairs',
};

// The 3 ClawHub skill packages: install command + verification hook (real, tested).
const CLAW_PACKAGES = {
  'cwi-1-walkman': {
    install: 'clawhub install cwi/signal-boy',
    verify_hook: `${HOME}/workspace/cwi-company/gear-line/skills/cwi-1-walkman/run_install_tests.sh`,
  },
  'gear-ledger': {
    install: 'clawhub install cwi/gear-ledger',
    verify_hook: `${HOME}/workspace/cwi-company/gear-line/skills/gear-ledger/run_install_tests.sh`,
  },
  'chain-of-title-compass': {
    install: 'clawhub install cwi/chain-of-title-compass',
    verify_hook: `${HOME}/workspace/cwi-company/gear-line/skills/chain-of-title-compass/run_install_tests.sh`,
  },
};

const gear = JSON.parse(readFileSync(`${HOME}/workspace/cwi-company/gear-line/gear.json`, 'utf8'));

const listings = gear.items.map((item) => {
  const slug = item.gear;
  const claw = CLAW_PACKAGES[slug];
  const dept = (item.department || '').toLowerCase();
  return {
    id: `cwi/${slug}`,
    name: item.name,
    kind: claw ? 'skill' : 'product',
    seller: DEPT_AGENT[dept] || 'agent:MUSE_CWI',
    version: item.version || '1.0.0',
    description:
      `Agent Deck gear — category: ${item.category || 'utility'}. ` +
      `Item card: ${item.item_card_url || item.product_url || 'see source'}.`,
    install: claw ? claw.install : null,
    source: item.product_url || item.item_card_url || 'https://cumulativeweb.com',
    license: claw ? 'MIT-0' : 'contact:hp@cumulativeweb.com',
    verify_hook: claw ? claw.verify_hook : null,
    created: '2026-09-15',
    updated: item.updated || '2026-09-18',
  };
});

// The two flagships (real, shipped, tested).
listings.push(
  {
    id: 'cwi/kingcode-lens',
    name: 'KingCode Lens',
    kind: 'product',
    seller: 'agent:MUSE_CWI',
    version: '1.0.0',
    description:
      'Web apps for Meta Ray-Ban Display glasses — previewed in the browser, no hardware needed. Simulator lab + conformance-tested adapter stack + voice agent. Tests 117/117, zero dependencies. Live demo on GitHub Pages.',
    install: null,
    source: 'https://github.com/CumulativeWebInc/cwi-kingcode-lens',
    license: 'proprietary: KingCode Lens Software License v1.0 (© 2026 Cumulative Web Inc)',
    verify_hook: null,
    created: '2026-09-18',
    updated: '2026-09-18',
  },
  {
    id: 'cwi/voice-bridge',
    name: 'cwi-voice-bridge',
    kind: 'product',
    seller: 'agent:MUSE_CWI',
    version: '1.0.0',
    description:
      'Voice bridge service — TTS paced queue with generation-tagged cancellation boundary. Apache-2.0 open core. Tests 25/25.',
    install: null,
    source: 'https://github.com/CumulativeWebInc/cwi-voice-bridge',
    license: 'Apache-2.0',
    verify_hook: null,
    created: '2026-09-18',
    updated: '2026-09-18',
  },
);

writeFileSync(resolve(here, 'listings.json'), JSON.stringify(listings, null, 2) + '\n', 'utf8');
console.log(`wrote ${listings.length} listings`);
