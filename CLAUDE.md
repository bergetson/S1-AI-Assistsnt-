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
| `/matches` | Scored position list with filters (city, match level, vacancy status, status type) |
| `/commute` | Drive-time table for all duty stations |
| `/timeline` | Visual career pathway by category |
| `/counseling` | Print-ready counseling sheet |
| `/ai-mentor` | Claude / Ask Sage chat with full profile context |

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
