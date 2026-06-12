# MT ARNG Career Planning & Mentorship System

A comprehensive career planning and mentorship tool for Soldiers in the Montana Army National Guard.

## What It Does

- **Position Matching** — Score all MTARNG positions (0–100) against a Soldier's rank, MOS, career goals, and commute limit
- **Commute Analysis** — Drive time and mileage for every position from the Soldier's home city
- **Career Timeline** — Visual 10–20 year pathway for enlisted, officer, and warrant officer tracks
- **AI Career Mentor** — Streaming Claude-powered advisor with full Soldier profile context
- **Counseling Sheet** — Print-ready one-page senior-rater counseling product

## Quick Start

### Web App

```bash
cd webapp
npm install
cp .env.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### AI Mentor Setup

The AI Mentor feature requires an Anthropic API key:

1. Get a key at [console.anthropic.com](https://console.anthropic.com)
2. Add it to `webapp/.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Restart the dev server

All other features (matching, commute, timeline, counseling sheet) work without an API key.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** for styling
- **Zustand** for client-side profile state (persisted to localStorage)
- **Anthropic SDK** for AI mentor (server-side API route)

## Data

All position data in `webapp/lib/data/positions.ts` is **demo data**. To load real MTARNG positions:

1. Replace the `positions` array in `webapp/lib/data/positions.ts`
2. Match the `Position` type defined in `webapp/lib/types.ts`
3. Rebuild — all scoring and display updates automatically

## Excel Version

The original Excel-based tool is also available:
- `MT_ARNG_Career_Planner.xlsx` — 13-sheet workbook with 80 demo positions
- Run `python3 build_part1_reference.py` + `build_part2_profile_matching.py` + `build_part3_outputs.py` to regenerate

## Structure

```
webapp/
├── app/
│   ├── page.tsx              # Dashboard / Home
│   ├── profile/page.tsx      # Soldier profile input form
│   ├── matches/page.tsx      # Position match results
│   ├── commute/page.tsx      # Drive time analysis
│   ├── timeline/page.tsx     # Career pathway visualization
│   ├── counseling/page.tsx   # Print-ready counseling sheet
│   ├── ai-mentor/page.tsx    # AI chat interface
│   └── api/chat/route.ts     # Claude API endpoint
├── lib/
│   ├── types.ts              # All TypeScript types
│   ├── store.ts              # Zustand profile store
│   ├── scoring.ts            # 0–100 position matching algorithm
│   └── data/
│       ├── positions.ts      # MTARNG position database
│       └── cities.ts         # Montana city distance matrix
└── components/
    └── Navbar.tsx            # Navigation
```
