# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `webapp/`:

```bash
npm run dev      # local dev server at localhost:3000
npm run build    # production build (outputs to webapp/out/ for GitHub Pages)
npm run lint     # ESLint
```

There are no tests. Build is the verification step — TypeScript errors surface here. Run `npm run build` after every non-trivial change.

## Architecture

### Deployment model

The app is a **fully static Next.js export** (`output: 'export'`) deployed to GitHub Pages. There is no server. All API calls (Claude, Ask Sage) go directly from the browser. `next.config.ts` detects `GITHUB_PAGES=true` to set `basePath: '/S1-AI-Assistsnt-'` and enable the static export. The GitHub Actions workflow (`deploy.yml`) bakes API keys in as `NEXT_PUBLIC_*` env vars at build time.

For local dev, `GITHUB_PAGES` is unset, so `basePath` is empty and the dev server works normally. Never add a server-side API route — it won't exist at runtime on Pages.

### Data flow

1. **Profile** — `lib/store.ts` (Zustand + `persist`) stores the `SoldierProfile` in `localStorage` under key `mtarng-profile`. Every page reads from this store. `profileComplete` is `true` only when `fullName`, `rank`, `mos`, and `homeCity` are all set.

2. **Position database** — `lib/data/positions.ts` exports `const positions: Position[]` (3,092 records: 2,294 filled / 798 vacant), generated from the current MTARNG MTOE + assignment extract. Split into 7 typed sub-arrays spread-merged at the end to avoid TypeScript's union complexity limit — do not put more than ~600 entries in a single typed array literal.

   **This file is billets only and must stay that way.** No names, no EmplId, no per-soldier dates. The repo is public and deploys to public GitHub Pages; personnel data goes through `/command/import` into localStorage instead. `.gitignore` blocks `*.xlsx` and `*roster*.csv` as a backstop.

   Each record carries the real chain of command (`bde`, `bn`, `paraLine`) and an `authorized` flag. `authorized: false` marks TEMPLET / "Standard Excess" lines (459 of them) — real over-strength soldiers not against an authorized billet. All manning math filters these out of the *authorized* count but keeps them in *assigned*, which is what surfaces over-strength.

3. **Scoring** — `lib/scoring.ts` scores each position 0–100: `gradeScore(35) + mosScore(30) + commuteScore(15) + goalScore(15) + statusScore(5) + vacancyBonus(5)`. Grade scoring applies a `promotionReadiness()` multiplier (0–1) based on `PROMOTION_GATES` data (TIG vs. min/typical and PME gates from AR 600-8-19, NGR 600-101). `scoreAllPositions()` hard-filters by `careerCategory` — officers cannot see enlisted/warrant positions. `scoreAlternatePaths()` shows cross-category positions only when the soldier has expressed interest in changing tracks.

4. **Commute** — `lib/data/cities.ts` has a static bidirectional drive-time matrix for Montana cities. `getCommute(from, to)` looks up both directions. `Fort Harrison` is aliased to `Helena` (5 mi / 10 min). Adding a new duty station city requires adding rows to `rawPairs`.

5. **AI Mentor** — `app/ai-mentor/page.tsx` tries Claude (Haiku 4.5) first via `lib/claude.ts`, falls back to Ask Sage via `lib/asksage.ts`. Both are called directly from the browser. `buildSystemPrompt()` in `asksage.ts` assembles the full context: soldier profile, computed promotion readiness, top-10 position matches, and an inline ARNG promotion timeline reference (AR 600-8-19, AR 135-155, NGR 600-101 data). Claude API key stored in `localStorage` under `claude-api-key`; Ask Sage token under `asksage-access-token`.

### Key types (`lib/types.ts`)

- `SoldierProfile` — everything from rank/MOS to PME booleans to 5/10-year goal strings
- `Position` — the shape of each record in `positions.ts`
- `ScoredPosition extends Position` — adds the five sub-scores, `totalScore`, `matchLabel`, `commuteMins`, `commuteMiles`
- `PromotionRequirement`, `MosTransition` — defined but not yet wired to UI pages
- `PROMOTION_GATES` in `scoring.ts` — the authoritative table of min/typical TIG and PME gates per grade; update this when regulations change

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing / feature overview |
| `/profile` | Soldier profile input form |
| `/matches` | Scored position list with filters (city, match level, vacancy status, status type); per-card action plan + gap analysis |
| `/planner` | Interactive career planner — current grade + future grades, multiple positions per grade, dwell time, PME, OCS/WOCS branching |
| `/reclassification` | MOS reclass pathways (ASVAB, school length, MTARNG slot counts) |
| `/commute` | Drive-time table for all duty stations |
| `/counseling` | Print-ready counseling sheet (now includes the self-built career plan) |
| `/ai-mentor` | Claude / Ask Sage chat with full profile + plan context |

Redirect stubs (consolidated into `/planner`): `/career-path`, `/timeline`. Removed (redirects to `/matches`): `/career-brief`. The planner engine lives in `lib/careerPlanner.ts`; planner state in `lib/plannerStore.ts` (localStorage `mtarng-planner`).

### Commander View (`/command/*`)

A second "hat" for battalion/brigade commanders, separate from the individual-soldier tools. `lib/viewModeStore.ts` (localStorage `mtarng-viewmode`) drives a navbar toggle that swaps the entire nav between the soldier tools and the commander tools; `components/Navbar.tsx` treats the URL as authoritative so deep links into `/command` show commander nav regardless of stored mode.

| Route | Purpose |
|-------|---------|
| `/command` | Unit selection + manning dashboard |
| `/command/roster` | Sortable force roster with TIG/TIP, evals, board eligibility |
| `/command/forecast` | Attrition projection + promotion requirement by grade |
| `/command/succession` | Ranked candidates for a billet + anonymized AI analysis |
| `/command/import` | CSV roster import |

Key modules:
- `lib/commandTypes.ts` — `RosterSoldier` and analytics result types; `rankLabel()` maps pay grade → rank name
- `lib/forceAnalytics.ts` — all pure analytics (manning, attrition, promotion forecast, candidate ranking, unit-name resolution and family grouping)
- `lib/data/retention.ts` — `RETENTION_LIMITS` (RCP / MRD). **Draft values needing S1 verification**, structured like `PROMOTION_GATES`
- `lib/data/realRoster.ts` — the REAL assigned force, de-identified (2,293 soldiers). Real grade/MOS/unit/component/TIP/ETS/MOSQ; identity discarded at generation. `yearsOfService`/`timeInGrade` are 0 = Unknown because the extract lacks PEBD and DOR — never fabricate them.
- `lib/commanderAI.ts` — the anonymization boundary and `buildCommanderPrompt()`
- `lib/rosterImport.ts` — hand-rolled RFC-4180 CSV parser (no new dependency)
- `lib/commandStore.ts` — roster/formation state (localStorage `mtarng-command`)

**Non-obvious constraints learned from the data:**
- `uic` is the join key (58 UICs, 12 battalions, 4 brigades). Unit *families* come from the real `bn` field — never re-infer a hierarchy from UIC prefixes.
- `authorized: false` rows are people without an authorization. Always exclude them from authorized counts; never from assigned.
- Billet location is derived per-UIC from the majority home station of its assigned soldiers, because vacant rows carry no station at all.
- `statusType: 'AGR'` on a billet is inferred from its incumbent's full-time-support code (`FTSP RSN` ∈ GOT/GAT/AIV/ARC/…). It is a property of who is *currently* in the seat, so treat it as a hint, not an authorization.
- Occupancy comes from the roster (`vacantBillets()`), not `Position.vacancyStatus`, which goes stale against an imported roster.
- `RANK_NUM` includes O7/O8 (real MTARNG billets) but `CATEGORY_CEILING.Officer` is still O6, so no planner path reaches them.
- `RANK_NUM` is contiguous across categories (E9=9, W1=10, O1=15), so never compute the next grade as `RANK_NUM + 1` — use `nextGradeFor(grade, category)`.
- An ETS is a contract expiring, not a departure. Attrition weights ETS and 20-year eligibility by take-rate and reports statutory (RCP/MRD) losses separately; counting ETS whole made the entire formation "depart" within one contract cycle.

**Privacy:** the roster lives only in `localStorage` and names never reach an AI provider. `lib/commanderAI.ts` swaps names for stable `S-nnn` pseudonyms at the boundary and `rehydrateNames()` maps replies back in the browser. Eval bullets are excluded unless explicitly opted in.

### Adding positions

Append to the `filled` or `vacant` array in `positions.ts`. Keep each array under ~650 entries or TypeScript hits a union complexity limit. If the array must grow larger, split into more sub-arrays and spread them into the export.

### Updating promotion rules

Edit `PROMOTION_GATES` in `lib/scoring.ts` and the promotion timeline block in `buildSystemPrompt()` in `lib/asksage.ts`. Both must stay in sync — the scoring engine and the AI advisor use separate copies of this data.

### Secrets

| Secret | Where used |
|--------|-----------|
| `Claude_API` | GitHub Actions → `NEXT_PUBLIC_CLAUDE_API_KEY` baked into build |
| `ASKSAGE_API_KEY` | GitHub Actions → `NEXT_PUBLIC_ASKSAGE_API_KEY` baked into build |
| `ASKSAGE_EMAIL` | GitHub Actions → `NEXT_PUBLIC_ASKSAGE_EMAIL` baked into build |

In `.env.local` the variable is `ANTHROPIC_API_KEY` (used by the SDK server-side pattern in the README), but at runtime on Pages the browser reads `NEXT_PUBLIC_CLAUDE_API_KEY` from the build or `localStorage`.

## Talent management layer (added in the prototype expansion)

Four role views, switched by a navbar toggle backed by `lib/viewModeStore.ts`
(`mtarng-viewmode`). `modeForPath()` makes the URL authoritative so deep links
always render the right nav.

| Route | Role | Purpose |
|-------|------|---------|
| `/civilian-profile` | Soldier | Civilian employment, skills, credentials, willingness |
| `/marketplace` | Soldier | Published opportunities, express interest, apply |
| `/skills` | All | Statewide civilian capability search + CSV export |
| `/community-impact` | All | Potential community impact of an activation |
| `/mission-builder` | All | Mission requirements → candidates → 3 deterministic COAs |
| `/talent` | Talent Mgr | Vacancies, people, marketplace, data/policy health |
| `/talent/vacancies` | Talent Mgr | Current + projected vacancies, candidate depth |
| `/talent/marketplace` | Talent Mgr | Slate review, endorsements, status transitions |
| `/talent/data-quality` | Talent Mgr | Detected issues, completeness, CSV export |
| `/talent/rules` | Talent Mgr | Every policy rule with status and authority |
| `/g1-state-view` | G1 | Statewide distribution, FTS balance, gaps, succession, heatmap |

### Pure-logic modules (migration targets)

```
lib/civilian/        types · taxonomy · filters · demoData
lib/communityImpact/ types · calculateImpact
lib/mission/         types · matcher · coa
lib/marketplace/     types · workflow · demoCycle
lib/talent/          statewideAnalytics · succession · dataQuality
lib/rules/           types · registry · aiContext
lib/provenance.ts    lib/recommendation.ts    lib/exports.ts
```

All are framework-free and unit-tested. React components only present them.

### Rules have exactly one source

`lib/rules/registry.ts` wraps `PROMOTION_GATES` (scoring.ts) and
`RETENTION_LIMITS` (data/retention.ts) in policy metadata — authority, status,
citation. `lib/rules/aiContext.ts` **generates** the AI briefing from that same
registry. Never restate a rule in prompt text; the two copies previously drifted.

### Invariants the tests enforce

Run `npm test` (237 tests). The non-obvious ones:

- Missing data must produce `Unknown`, never a favorable default. Commute with no
  route is marked `excluded`, not scored as neutral. This binds the **AI payload**
  too, not just the UI: `tests/provenance.test.ts` asserts the commander prompt
  says `Board-eligible now: UNKNOWN` rather than `0` when the roster carries no
  service clocks. It once said `0`, and the "do not invent numbers" rule then
  locked the model into advising that the bench was empty.
- Community impact never has a negative-weight factor — nothing *reduces* risk.
  Adding people from one employer can only raise it.
- Analytics must be invariant to record order. `analyzeDataQuality` sorts inputs
  canonically because duplicate detection reports the second record it sees.
- Deterministic ranking must not change when a soldier's name changes.
- Statewide totals must equal the sum of formation totals.

### What is real vs synthetic

- **Billets** (`positions.ts`, 3,092): real current MTOE.
- **Soldiers** (`realRoster.ts`, 2,293): real assignments, de-identified. Not demo.
- **Civilian capability** (`civilian/demoData.ts`): synthetic — no real source exists.

Do not label the roster "demo"; it is real data with identity withheld.

**`lib/dataSources.ts` is the single authority on provenance.** Every screen,
export, and AI prompt reads a `DataSource[]` from `useForceData().sources`
(`.all`, `.military`, or one dataset). There is deliberately **no app-wide
`isDemo` boolean** — the billets are real, the roster is real but de-identified,
and the civilian layer is generated, so one flag covering all three is always a
lie about at least one of them. The previous ad-hoc booleans drifted until
`/g1-state-view` claimed data was "imported" while `/command/succession` told
the model the real force was "SYNTHETIC DEMONSTRATION DATA".

Only `fidelity: 'synthetic'` warrants a warning colour — see `isDemoFidelity()`.
Components named for the *thing they say*, not a flag: `RosterSourceBanner`,
`FidelityPill`, `DataSourceBanner`.

`lib/civilian/demoData.ts` uses a seeded mulberry32 PRNG keyed on soldier id and
a fixed `BASE_YEAR`. Never introduce `Math.random()` or `Date.now()` — this is a
static export and nondeterminism becomes a hydration mismatch. Keying on soldier
id means roster reordering cannot shift anyone's profile.

### The org chart (`lib/orgChart/`)

`/command/org`, `/g1-state-view/org`, and `/force-structure` all render
`components/shared/OrgChartView.tsx` with a `mode` prop, so the three audiences
cannot see differently-shaped versions of the same force.

**`commandStructure.ts` is hand-maintained on purpose.** The MTOE extract encodes
accounting rollups, not command relationships: `bde` has four disconnected values
and JFHQ sits *inside* one of them as a peer battalion, so the data contains no
root at all. The top two levels are therefore transcribed from the org chart
MTARNG publishes, and every node built from it carries `fromPublishedChart` so
the UI can draw those edges dashed and say where they came from. Anything the
table fails to place lands under **Unmapped formations** — never filter that node
out, it is the only signal the table has drifted.

Below that everything derives from the data: `bn` → `uic` → MTOE paragraph
prefix → billet. Company identity comes from UIC character 5 (`WTCPA0` = A CO,
`WTCPA1` = DET 1); section labels are inferred from each group's senior billet
and flagged `inferredLabel`.

Traps the tests pin down:
- **TEMPLET lines are keyed on `authorized === false`, not the 9xx paragraph
  convention.** 166 of the 459 unauthorized billets sit on ordinary paragraph
  numbers, so the paragraph is a hint and a wrong rule.
- `(uic, paraLine)` is **not** unique — `WTCPB0` stacks nine `203-01` lines — so
  grouping must never collapse on it. Only `id` is unique.
- `layoutTree` centres a parent over its children's *centres*, not over its own
  span; with uneven subtree widths the two differ visibly.
- The canvas re-fits on mount and re-root only. Re-fitting on every expand yanks
  the view out from under the node the user just clicked.
- Billet tiles are siblings of the card's header button, never children — a
  `<button>` inside a `<button>` is invalid HTML and fails hydration outright.

### The planning epoch (`lib/asOf.ts`)

`AS_OF_ISO` / `AS_OF_YEAR` / `asOfDate()` are the **only** source of "now".
`BASE_YEAR` and `AS_OF` in `useForceData` are re-exports of them.

Never write `new Date()` in render or at module scope. Two reasons, both of
which had already bitten:

1. **Correctness.** Everything derives from a dated extract, so measuring TIG,
   ETS, and board windows against today silently ages the whole force. A soldier
   does not become board-eligible because a tab was left open until January.
2. **Hydration.** Module-scope `new Date()` is evaluated once on the build
   machine and baked into the prerendered HTML, then re-evaluated in the browser.
   Across a New Year boundary they disagree and React reports a mismatch.

When a new extract lands, change those two constants and nothing else.

### Feeding a real roster

`lib/rosterImport.ts` accepts **either** precomputed decimals (`tis`, `tig`) or
the dates a personnel system actually exports (`pebd`, `dor`), and derives the
clocks from the dates via `yearsSince()` against the epoch. Decimals win when
both are present; an unreadable date produces a row warning and stays `Unknown`
rather than becoming 0. Add new header spellings to `HEADER_ALIASES`.

The committed `realRoster.ts` has **neither** PEBD nor DOR, which is why
`summarizeForce().serviceDatesKnown` is 0 on the default formation and every
promotion/retirement number reads `Unknown`. Supplying those two columns is what
turns the forecasting on — nothing else is missing.

### New store keys

`mtarng-civilian` (soldier's own civilian profile), `mtarng-marketplace`
(cycles + applications). Both follow the existing `create<T>()(persist(...))`
shape with `{ name }` only.

### Privacy boundary (unchanged, now enforced more widely)

`lib/commanderAI.ts` is still the only place names cross into an AI payload, and
they do not — `anonymizeSoldier()` emits `S-nnn` and `rehydrateNames()` maps back
in the browser. `AI_GOVERNANCE` in `lib/rules/aiContext.ts` carries the standing
limits (no orders, no invented data, no protected characteristics, self-reported
never presented as verified).
