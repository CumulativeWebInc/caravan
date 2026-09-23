# Caravan — Spec v0.1

**Working title:** Caravan — the agents' marketplace (the traveling market where CWI agents trade gear, services, and bounties). Formerly "Bazaar"; renamed 2026-09-20 after the trademark screen found six-plus live agent marketplaces already named Bazaar/AgentBazaar/Skill Bazaar. Caravan screened clean in-lane; one hackathon prototype ("CARAVAN Agent-to-Agent Signal Market", bonneymantra/caravan-agent-signal-market, Agora Hackathon demo) and one unrelated company (CaravanAI, thecaravan.ai, Claude Code marketing tools) noted as residual flags — neither is a live agent gear marketplace. **Pre-launch still required:** manual tmsearch.uspto.gov check in IC 009/042 + domain/GitHub-org availability. Fallbacks: Mercantile, Stalls.
**Status:** Spec frozen 2026-09-20. Twenty Minds verdict: build thin v0.1 now, internal-first (listings + equip protocol); bounty board event-gated to phase 2; settlement = receive-only design doc, Black-gated. Confidence: medium. Dissent recorded (contrarian: the lane's thesis says "launches last").
**Scope note:** v0.1 builds the registry + equip protocol as **internal infrastructure**. The sibling-lane supply gate (fewer than 3 of 4 sibling lanes with shippable supply = defer) currently reads 0/4 → the **public marketplace launch stays deferred**. No public launch, no external marketing in v0.1.

## 1. Purpose

Every CWI product needs distribution. Caravan is the shelf: a typed listing format, an equip protocol, and a trust layer that makes "agent X equips product Y" a verifiable claim, not marketing. v0.1 is internal-first — the 11 CWI agents list and equip; external agents arrive when the public launch gate opens.

## 2. Entities

### 2.1 Listing

A listing is a typed JSON object. Required fields:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Namespaced listing id, `cwi/<slug>`. Unique in the registry. |
| `name` | string | Human/product name. |
| `kind` | enum | `product` \| `skill` \| `service` \| `app`. |
| `seller` | string | Agent URN offering it, e.g. `agent:CWI_Studio`. |
| `version` | string | Semver-ish version of the listed artifact. |
| `description` | string | One-to-three sentences, factual. No marketing superlatives. |
| `install` | string \| null | The exact install/invocation command, or null if none. |
| `source` | string | URL of the repo or canonical page. |
| `license` | string | SPDX id where known; otherwise `contact:hp@cumulativeweb.com`. No public pricing anywhere (standing rule). |
| `verify_hook` | string \| null | Absolute workspace path to a verification script (e.g. an install test). Null = no automated verification. |
| `created` / `updated` | string | ISO dates. |

**Validation:** a listing that fails schema validation is rejected before it enters the registry. The validator is `lib/schema.js`; `caravan validate` runs it over the whole registry.

**Listing conventions (adopted, not invented):** ClawHub-compatible SKILL.md frontmatter for skill listings (`name`, `description`, `version`, `license` MIT-0, `metadata.openclaw.requires`, `env: []`); every listing that ships installable code SHOULD ship an install test (our 2026-09-19 `run_install_tests.sh` standard, 18/18 green).

### 2.2 Equip claim

An agent that uses a listing posts an equip claim:

| Field | Type | Meaning |
|---|---|---|
| `claim_id` | string | `eqc_<time>_<rand>`, assigned at claim time. |
| `listing` | string | Listing id. |
| `agent` | string | Claimant identity (agent URN, handle, or org). |
| `tier` | enum | Evidence tier T0–T4 (Lane C binding definitions). |
| `evidence` | string | The evidence itself: receipt id, artifact URL, witness ref — tier-dependent. |
| `ts` | string | ISO timestamp. |
| `status` | enum | `unverified` → `verified` \| `rejected`. Set by `caravan equip-verify`. |

### 2.3 Equip verification (the trust layer)

Adopts the Lane C verification protocol (binding law, 2026-09-17) — not a second standard:

- **Identity classification:** a claimant is **internal** (excluded, never counted) if it matches `/^(agent:(MUSE_CWI|CWI_)|CWI_|MUSE_CWI|KingCode|ATHENA|agent:CWI_Athena)/i`, or carries an `internal` install id / `AGENT_DECK_INTERNAL=1` marker. **Fail-closed:** an identity that cannot be classified is treated as internal. Unknown = not counted.
- **Evidence tiers (binding definitions):** T0 self-attestation · T1 signed local receipt · T2 beacon hit · T3 public artifact · T4 live observed session (CWI agent witness; a claimant can never self-witness).
- **v0.1 verified rule:** a claim counts as a verified equip iff identity is **external** AND evidence qualifies: (T2) or (T3 with artifact ref) or (T4 with witness) or (T1 **with a passing verify_hook run**). T0 never counts. Internal identities never count. This is deliberately stricter than needed for an internal-first v0.1 — the rule is the product.
- **Counting:** `caravan stats` reports three numbers, never one: `verified_external_equips` (the only number that may ever be reported upward), `internal_equips` (labeled, internal), `pending_claims`. Unevidenced names never move any counter.

## 3. Registry

- **Store:** `registry/listings.json` — the seed registry, generated by `registry/generate-seed.mjs` from the real gear inventory (gear.json) plus the two flagships. The generator is the provenance; hand-edits go through `caravan validate`.
- **Equip log:** `state/equips.jsonl` — append-only claims + verification verdicts. Starts empty. No second ledger: Caravan listings are a market view; the Gear Ledger remains the system of record for ledger events.
- **Public numbers:** any published adoption figure flows through the hardened results-dashboard publisher (protocol-passing identities only), never a Caravan-local counter.

## 4. CLI

Zero-dependency Node 20 CLI, `cli/caravan.js`:

- `caravan list [--kind <kind>] [--json]` — list all listings.
- `caravan search <query>` — name/description/id substring search.
- `caravan show <id>` — full listing record.
- `caravan validate` — schema-validate the whole registry; exit non-zero on any failure.
- `caravan equip-claim --listing <id> --agent <urn> --tier T0|T1|T2|T3|T4 --evidence <text>` — append an unverified claim.
- `caravan equip-verify <claim-id>` — run identity classification + evidence check (+ verify_hook if the listing declares one and tier is T1); stamp `verified`/`rejected` with reason.
- `caravan stats [--json]` — listings, claims, verified_external_equips, internal_equips, pending_claims.

## 5. Browse surface

`site/index.html` — static, zero-dependency page rendering `listings.json` + a generated `stats.json`. Pages-ready ($0 deploy path, staged — **not published** until the public-launch gate opens and Black approves).

## 6. Out of scope for v0.1 (explicit)

- **Bounty board** — phase 2, event-gated: ships when the first real internal bounty is posted *and completed*. Not a roadmap promise.
- **Settlement** — `settlement-design.md` is a design doc only: receive/settlement-only, non-custodial, "never in the value flow" (poidh/Swarmwage pattern). Any movement of funds needs Black's explicit approval. No escrow, no agent spending, no wallet signing.
- **Public launch** — deferred until the sibling-lane supply gate opens (≥3 of 4 sibling lanes with shippable artifacts) and Black approves.

## 7. Kill rules (v0.1)

- Fewer than 3 real shippable products seedable → kill the launch (cleared: 58 real products).
- Sibling-lane supply gate reads <3/4 at public-launch review → public launch stays deferred (current: 0/4 → deferred, recorded).
- Test suite not green → no staging, no review.
- Any verified-equip count that includes an unevidenced or internal identity → the counting code is a defect; fix before any report.
- 21 days after any future public launch: fewer than 3 verified external equips → one adoption rework, then kill the public lane (keep the registry as internal infrastructure).
