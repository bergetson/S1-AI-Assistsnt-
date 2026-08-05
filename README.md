# Ask Steeves — MTARNG Talent Management Prototype

A browser-based prototype for Montana Army National Guard career planning, force
management, and talent management. Built to demonstrate concepts, validate
workflows, and gather user feedback **before** successful capabilities are
rebuilt inside Army-approved architecture.

> **This is a prototype.** Nothing in it constitutes assignment authority,
> official orders, or an authoritative personnel record. Every screen says so.

Live demo: https://bergetson.github.io/S1-AI-Assistsnt-

---

## Running it

```bash
cd webapp
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production static export (GitHub Pages) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + invariant tests |
| `npm run verify` | lint → typecheck → test → build |

No backend, no database, no required API key. AI features are optional; every
other capability works without credentials.

---

## The four roles

A toggle in the navbar switches the whole application between four hats. Deep
links win over the stored mode, so `/talent/vacancies` always shows talent nav.

| Role | Purpose | Key routes |
|---|---|---|
| **Soldier** | Own career, own civilian capability, own opportunities | `/profile`, `/civilian-profile`, `/matches`, `/planner`, `/marketplace` |
| **Commander** | One formation: manning, forecast, succession | `/command`, `/command/roster`, `/command/forecast`, `/command/succession` |
| **Talent Manager** | Vacancies, marketplace, data and policy health | `/talent`, `/talent/vacancies`, `/talent/marketplace`, `/talent/data-quality`, `/talent/rules` |
| **G1 State** | Statewide distribution, gaps, succession risk | `/g1-state-view` |

Shared across roles: `/skills`, `/community-impact`, `/mission-builder`.

---

## What it does

### Civilian capability
Soldiers record civilian employment, skills, credentials, languages, leadership
experience, and mission-use preferences at `/civilian-profile`. A 29-category
taxonomy with aliases and search synonyms (`lib/civilian/taxonomy.ts`) keeps
"Master Elec.", "EMT-P", and "CDL-A" mapping onto a stable vocabulary.

`/skills` searches the whole force by capability, proficiency, verification,
county, unit, willingness, and more — with CSV export.

### Community impact
`/community-impact` estimates what civilian capability may leave Montana
communities if a formation activates. It is deliberately a **separate model**
from mission matching: a rural paramedic scores high on both, and conflating them
would hide the exact tradeoff a planner needs.

Two design rules the tests enforce:
- Missing data produces **Unknown**, never Low.
- Selecting more people from one employer can never *reduce* risk.

### Mission Team Builder
`/mission-builder` defines a mission's military and civilian requirements, finds
candidates, and builds three deterministic courses of action (Best Technical Fit,
Lowest Community Impact, Best Balance). Each COA reports requirements filled,
units/employers/counties affected, verification confidence, travel, and explicit
tradeoffs. AI may narrate a COA; it never builds one.

### Talent marketplace
A prototype cycle seeds automatically. Soldiers express interest and apply;
commanders endorse; talent managers move applications through a validated status
flow with full history. Illegal transitions are rejected with a reason.

### Explainable recommendations
`lib/recommendation.ts` replaces single-score output with independent dimensions:
eligibility, readiness, preference fit, organizational need, military
qualification fit, civilian fit, and community impact. Each can be **Unknown**
independently. Missing data is excluded from the score and shown as excluded —
never scored as neutral.

---

## Architecture

Business logic is pure and framework-free so it can migrate to an Army backend.
React components only present it.

```
lib/
  civilian/        types · taxonomy · filters · demoData
  communityImpact/ types · calculateImpact
  mission/         types · matcher · coa
  marketplace/     types · workflow · demoCycle
  talent/          statewideAnalytics · succession · dataQuality
  rules/           types · registry · aiContext
  provenance.ts    recommendation.ts    exports.ts
  forceAnalytics.ts   scoring.ts   careerPlanner.ts
  data/            positions · cities · retention · boards · demoRoster · mosTransitions
```

**Rules have one source.** `lib/rules/registry.ts` wraps `PROMOTION_GATES` and
`RETENTION_LIMITS` in policy metadata, and `lib/rules/aiContext.ts` generates the
AI briefing *from that same registry* — so the model can never be told a
different rule than the math used. Browse them at `/talent/rules`.

### Static-export constraints
- No server routes. All external calls are browser-side.
- State is Zustand + `persist`, split by domain: `mtarng-profile`,
  `mtarng-planner`, `mtarng-command`, `mtarng-civilian`, `mtarng-marketplace`,
  `mtarng-viewmode`.
- Demo data uses seeded PRNGs and fixed base years — never `Math.random()` or
  `Date.now()`, which would cause hydration mismatches.

---

## Data

**Force structure** (`lib/data/positions.ts`): 3,092 real MTARNG billets from the
current MTOE extract, with brigade/battalion/paragraph-line and an `authorized`
flag. **Billets only** — no names, no EmplId, no per-soldier dates.

**Rosters carry PII and are never committed.** Import them at
`/command/import`; they stay in that browser's localStorage. `.gitignore` blocks
`*.xlsx` and `*roster*.csv` as a backstop.

**Demo data** is synthetic, deterministic, and labeled everywhere — a red banner,
a `DEMO` pill on every name, a print watermark, and a comment line on every CSV
export.

### Updating demo data
- Roster: `lib/data/demoRoster.ts` (`DEMO_SEED`, per-unit fill rates, archetypes)
- Civilian profiles: `lib/civilian/demoData.ts` (`ARCHETYPES`, weights)
- Opening formation: `DEMO_DEFAULT_UICS`

Change a seed and every derived screen changes deterministically. Tests assert
that identical input always yields identical output.

### Importing your own data
1. `/command/import` → download the CSV template
2. Paste or upload (paste works on machines that block file pickers)
3. Review accepted rows, errors, and warnings before committing
4. Commit — this replaces the demo roster

Only `rank` and `uic` are required. `uic` is the join key; display names are
never used as one.

---

## Testing

105 tests across four suites, including invariants that encode the product's
promises:

- Completing a qualification never lowers readiness
- Increasing commute never improves commute fit
- Missing information is never treated as verified
- A hard blocker stays visible regardless of total score
- Changing a soldier's name never changes deterministic ranking
- Reordering imported records never changes analytics
- More people from one critical employer never reduces community-impact risk
- A verified credential outranks an identical unverified claim
- Statewide totals equal the sum of formation totals
- Applying a filter never mutates underlying records

---

## Verify before relying on it

Retention control points and several promotion values are **draft or
unverified**. `/talent/rules` lists every rule with its status and authority.
Correct them in `lib/data/retention.ts` and `lib/scoring.ts` — the UI, analytics,
and AI all read from there.

## Privacy

- Rosters live only in the browser and are never uploaded.
- Names never reach an AI provider — `lib/commanderAI.ts` swaps them for stable
  `S-nnn` pseudonyms and maps replies back locally.
- Evaluation bullets are excluded from AI calls unless explicitly opted in.
- Civilian occupation is never an automatic basis for activation or assignment.
- The site is publicly reachable; a real deployment needs authentication before
  real personnel data is used.

## Optional AI

Add a Claude API key or Ask Sage credentials in the ⚙ panel on `/ai-mentor`.
Without credentials every deterministic feature still works — matching,
analytics, COAs, community impact, marketplace, and exports are computed locally.

## Legacy artifacts

`MT_ARNG_Career_Planner.xlsx` and the `build_part*.py` scripts are the original
Excel-based tool that preceded this web app. They are kept for reference and are
not part of the build.
