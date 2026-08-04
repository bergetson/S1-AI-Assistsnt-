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

2. **Position database** — `lib/data/positions.ts` exports `const positions: Position[]` (1,184 records). Split into two typed sub-arrays (`filled` + `vacant`) then spread-merged to avoid TypeScript's union complexity limit. Filled positions (559) come from the MTARNG Assignment Detail Report; vacant positions (625) come from the Jun 2026 vacancy report. Do not add more than ~600 positions to a single typed array literal or TypeScript will error.

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
- `lib/data/demoRoster.ts` — deterministic synthetic roster (seeded PRNG, no `Math.random`/`Date.now` — a static export would otherwise mismatch on hydration)
- `lib/commanderAI.ts` — the anonymization boundary and `buildCommanderPrompt()`
- `lib/rosterImport.ts` — hand-rolled RFC-4180 CSV parser (no new dependency)
- `lib/commandStore.ts` — roster/formation state (localStorage `mtarng-command`)

**Non-obvious constraints learned from the data:**
- `uic` is the only reliable join key. The `filled` array sets `unit === uic` (raw codes); `vacant` uses MTOE names. Never render `Position.unit` directly — always `resolveUnitName(uic, nameMap)`.
- `positions.ts` has **zero AGR billets** (`statusType` is only `M-Day`/`Technician`). AGR is a roster-level attribute; never infer it from `Position.statusType`.
- 36 of 53 UICs have **zero** `Filled` billets (the `filled` array is a partial extract), so the demo roster populates across all billets at a per-unit fill rate rather than one-per-filled-billet.
- Occupancy comes from the roster (`vacantBillets()`), not `Position.vacancyStatus`, which goes stale against an imported roster.
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
