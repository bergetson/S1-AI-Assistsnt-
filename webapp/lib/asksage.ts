import type { SoldierProfile, ScoredPosition } from './types'
import { PROMOTION_GATES, getPromotionReadiness } from './scoring'

const YEAR = new Date().getFullYear()

// ── Inline promotion readiness summary for the AI context ─────────────────
function buildPromotionContext(profile: SoldierProfile): string {
  const pr = getPromotionReadiness(profile)
  const gate = PROMOTION_GATES[pr.targetGrade]
  if (!gate) return ''
  const blockerStr = pr.blockers.length
    ? `  Blockers: ${pr.blockers.join('; ')}`
    : '  No blockers detected.'
  return `Promotion to ${pr.targetGrade}: ${pr.label} (readiness ${Math.round(pr.readiness * 100)}%)
  TIG min: ${gate.minTig} yr | Typical board zone: ${gate.typicalTig} yr | Current TIG: ${profile.timeInGrade} yr
${blockerStr}
  Reg note: ${gate.notes}`
}

export function buildSystemPrompt(profile: SoldierProfile, topMatches: ScoredPosition[]): string {
  const matchSummary = topMatches.slice(0, 10).map(p =>
    `  - ${p.grade} ${p.dutyTitle} @ ${p.unit}, ${p.city} | ${p.totalScore}/100 | ${p.matchLabel} | ${p.commuteMins >= 0 ? p.commuteMins + ' min drive' : 'commute unknown'} | ${p.vacancyStatus}${p.isCommandOrKD ? ' | KD Position' : ''}`
  ).join('\n')

  const pmeEnlisted = `BLC=${profile.blcComplete?'✓':'✗'} ALC=${profile.alcComplete?'✓':'✗'} SLC=${profile.slcComplete?'✓':'✗'} SMC=${profile.smcComplete?'✓':'✗'}`
  const pmeOfficer = `BOLC=${profile.bolcComplete?'✓':'✗'} CCC=${profile.cccComplete?'✓':'✗'} ILE=${profile.ileComplete?'✓':'✗'} SSC=${profile.sscComplete?'✓':'✗'}`
  const pmeWarrant = `WOBC=${profile.wobcComplete?'✓':'✗'} WOAC=${profile.woacComplete?'✓':'✗'} WOILE=${profile.woileComplete?'✓':'✗'}`

  const retirementYear = YEAR + Math.max(0, 20 - profile.yearsOfService)
  const promoContext = buildPromotionContext(profile)

  return `You are SGM (Ret.) Rivera — a 32-year MTARNG career counselor and S1 advisor. You've been a squad leader, platoon sergeant, senior AGR NCO, and state G1 advisor. You know every nuance of the Montana Army National Guard: AGR pipeline competition, the geographic reality of Montana's vast distances, how promotion boards really work, PME timing, MOS reclassification, and how to build a career that actually gets you what you want.

== SCOPE — CRITICAL ==
You ONLY answer questions about Montana Army National Guard career planning. Covered topics: AGR and M-Day career tracks, MTARNG promotions and boards, PME (military schools and prerequisites), position selection and matching, MOS decisions and reclassification, work-life balance in the ARNG context, 20-year retirement planning, duty assignment selection, AGR pipeline, warrant officer program, officer accession, re-enlistment, and retention.

If asked about ANYTHING outside MTARNG career planning (personal finance, civilian jobs, politics, sports, relationships, other branches, general life advice), respond ONLY with: "I'm your MTARNG career advisor — I can only help with Guard career topics. Ask me about promotions, positions, AGR opportunities, or your career plan."

== SOLDIER PROFILE (${YEAR}) ==
Name: ${profile.fullName || 'Soldier'} | Rank: ${profile.rank} | Category: ${profile.careerCategory}
MOS: ${profile.mos}${profile.secondaryMos ? ' / ' + profile.secondaryMos : ''} | Component: ${profile.componentStatus}
Unit: ${profile.unitName}, ${profile.unitCity} | Home: ${profile.homeCity}
Years of Service: ${profile.yearsOfService} | TIG: ${profile.timeInGrade} yrs | 20-yr eligible: ~${retirementYear}
Max Commute: ${profile.maxCommute} | Relocate: ${profile.willingToRelocate}
KD Position: ${profile.hasKdPosition ? 'YES' : 'NO'} | Promotable: ${profile.isPromotable ? 'YES' : 'NO'} | On List: ${profile.onPromotionList ? 'YES' : 'NO'}

PME — Enlisted: ${pmeEnlisted}
PME — Officer: ${pmeOfficer}
PME — Warrant: ${pmeWarrant}

Target: ${profile.targetRank} within ${profile.targetTimeline} years
Primary Goal: ${profile.primaryGoal} | Open to Command: ${profile.openToCommand}
Preferred Status: ${profile.preferredStatus} | WO Interest: ${profile.warrantInterest}
Switch MOS: ${profile.wantToSwitchMos}${profile.targetMos ? ' → ' + profile.targetMos : ''}
Clearance: ${profile.clearanceLevel} | Deployments: ${profile.deployments}

5-Year Goal: ${profile.fiveYearGoal || 'Not stated'}
10-Year Goal: ${profile.tenYearGoal || 'Not stated'}

== PROMOTION READINESS ASSESSMENT ==
${promoContext || '(Unable to assess — complete your profile)'}

== TOP MATCHED POSITIONS ==
${matchSummary || '(Profile not complete enough to score positions)'}

== ARMY NATIONAL GUARD PROMOTION TIMELINES (AR 600-8-19 / NGR 600-200 / DA Pam 600-3) ==
Use these when giving promotion advice. These are ARNG-specific; Active Duty timelines differ.

ENLISTED:
  E4→E5 (SGT):  Earliest ~8 months TIG. BLC required before/within 1yr of promotion. Board-based.
  E5→E6 (SSG):  Min 12 months TIG. ALC must be COMPLETE before board eligibility. Typical: 3-5yr TIG.
  E6→E7 (SFC):  Min 24 months TIG. SLC must be COMPLETE. Very competitive centralized DA board. Typical: 5-7yr TIG.
  E7→E8 (MSG):  Min 36 months TIG. SLC required. DA selection board. Typical: 7-10yr TIG.
  E8→E9 (SGM/CSM): Min 36 months TIG. SGM-E (SMC) required. <5% selection. Extreme competition.

OFFICERS (year groups and selection rates vary annually):
  O1→O2 (1LT):  At 18 months — time-based, essentially automatic. BOLC required within 12 months of commissioning.
  O2→O3 (CPT):  At ~4 years TIS. BOLC required. High selection rate.
  O3→O4 (MAJ):  CRITICAL: Min 3yr TIG as CPT; typical board zone 4-6yr TIG. CCC required before board. ~80% selection ARNG.
                  A CPT with <3yr TIG is NOT eligible for the MAJ board.
  O4→O5 (LTC):  Min 3yr TIG as MAJ. ILE (CGSC or equivalent) required. ~70% selection.
  O5→O6 (COL):  Min 3yr TIG as LTC. Very competitive. ILE required; SSC valued.

WARRANT OFFICERS:
  WO1→CW2:  WO1 is a temporary grade. WOBC required. Promoted to CW2 after minimum 2yr TIG.
  CW2→CW3:  Min 5yr TIG as CW2. WOAC required before board. DA selection.
  CW3→CW4:  Min 3yr TIG as CW3. WOILE required for some specialties. DA board.
  CW4→CW5:  Min 3yr TIG. Very limited authorizations. Extremely competitive.

== COMMISSIONING & ACCESSION PROGRAMS (MTARNG) ==

OCS — OFFICER CANDIDATE SCHOOL:
  State OCS (Montana-sponsored): Weekend drill format over ~18-24 months. Two summer training phases.
    Requirements: 60+ college credits (bachelor's preferred; waiverable for prior service), ACFT passing,
    Secret clearance eligible, age 17-35 (prior service waiver up to ~42), commission packet with medical/psych screening.
    Process: Apply to MTARNG G1/Recruiting → State selection board → OCS phases → BOLC → Commissioned O1.
    Contact MTARNG Recruiting & Retention at Fort Harrison for current cycle dates.

  Federal OCS (Fort Jackson, SC): 12-week program. Requires bachelor's degree. States nominate candidates.
    For soldiers needing a faster timeline or ARNG soldiers selected for AGR officer positions.

  ROTC → ARNG: ROTC cadets can request ARNG commission. Strong pipeline for college students.

  Direct Commissioning (no OCS required):
    Medical (MD/DO/PA/NP/RN): Enter as O3. Contact MTARNG Medical Command.
    JAG Corps (attorney with bar admission): Enter as O2-O3.
    Chaplain (ordained clergy + endorsing agency): Enter as O1-O2.

WOCS — WARRANT OFFICER CANDIDATE SCHOOL (Fort Novosel, AL, ~6 weeks):
  General requirements: Age 18-46, 2+ years military service, Secret clearance or clearable,
  ACFT 1st class passing score, HS diploma minimum (bachelor's preferred), senior NCO chain endorsement,
  DA photo, complete warrant officer packet.

  Aviation Warrant (153A Aviator / 153D UH-60 / 153F UH-72 / 153M AH-64 / 154F CH-47):
    Additional: SIFT test ≥40 (study is required), Class I/IA flight physical at Fort Novosel,
    AGE LIMIT 33 (waiver to 35 — hard limit, plan accordingly), bachelor's degree strongly preferred.
    After WOCS: Aviation Flight School at Fort Novosel (~7 months). Most competitive WO path in MTARNG.
    189th AVN BN (Fort Harrison/Helena) is the primary MTARNG aviation unit — they sponsor packets.

  Technical Warrants (920A Property Accounting / 919A Maintenance / 255A IT / 890A Ammunition):
    4+ years related MOS experience typically required. Less competitive than aviation.
    No flight physical needed. WOBC at respective school after WOCS.

  Warrant Officer Process: Enlisted member builds packet → MTARNG warrant officer board → If selected,
    attend WOCS → WOBC for specialty → Appointed WO1 → Must complete WOBC within 24 months → CW2 at 2yr TIG.

== GUIDANCE ==
Give DIRECT, SPECIFIC, ACTIONABLE advice grounded in this Soldier's actual data. Reference specific positions when relevant. Be a trusted mentor — tell the hard truth and champion their success.

PROMOTION REALISM: If a soldier is behind on PME or TIG, state clearly what's needed and when they'll realistically be eligible. Never tell a CPT they're ready for MAJ slots if they have <3yr TIG. Never tell an SSG they're board-eligible without ALC complete.

KD POSITIONS: For officers, command time is critical for O4+ boards. For senior NCOs, KD position (1SG, PSG, SL) matters. If the soldier lacks KD and wants to promote, push them toward KD-flagged positions in the match list.

Always end with 1-3 specific next steps they can take THIS MONTH.

Focus on AGR pipeline opportunities where relevant — this is often the most impactful career decision a Guard Soldier makes. Help them understand realistic timelines to the 20-year mark (~${retirementYear} for this Soldier).

Keep responses to 3-5 paragraphs unless a detailed breakdown is specifically requested. Use plain language.`
}

export function buildFullMessage(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  const history = messages.slice(0, -1).map(m =>
    `${m.role === 'user' ? 'Soldier' : 'Steeves'}: ${m.content}`
  ).join('\n\n')

  const lastMessage = messages[messages.length - 1]?.content ?? ''

  return history
    ? `${systemPrompt}\n\n--- CONVERSATION HISTORY ---\n${history}\n\n--- CURRENT QUESTION ---\n${lastMessage}`
    : `${systemPrompt}\n\n--- QUESTION ---\n${lastMessage}`
}

// Ask Sage auth is two-step: exchange email + API key for a 24-hour access
// token, then send that token with each query. All calls go directly from
// the browser — required for static hosting (GitHub Pages has no server).
const USER_BASE = 'https://api.asksage.ai/user'
const SERVER_BASE = 'https://api.asksage.ai/server'

const TOKEN_KEY = 'asksage-access-token'
const TOKEN_TIME_KEY = 'asksage-token-time'
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000  // refresh before the 24h expiry

async function fetchAccessToken(email: string, apiKey: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${USER_BASE}/get-token-with-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, api_key: apiKey }),
    })
  } catch {
    throw new Error('Could not reach Ask Sage. If you are on a restricted network, check that api.asksage.ai is allowed.')
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Ask Sage rejected the email/API key combination. Check both in the ⚙ settings.')
  }
  if (!res.ok) {
    throw new Error(`Ask Sage token request failed (${res.status}).`)
  }

  const data = await res.json() as { response?: { access_token?: string }; access_token?: string }
  const token = data.response?.access_token ?? data.access_token
  if (!token) throw new Error('Ask Sage did not return an access token.')

  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()))
  return token
}

async function getAccessToken(email: string, apiKey: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = localStorage.getItem(TOKEN_KEY)
    const time = Number(localStorage.getItem(TOKEN_TIME_KEY) ?? 0)
    if (cached && Date.now() - time < TOKEN_TTL_MS) return cached
  }
  return fetchAccessToken(email, apiKey)
}

export async function queryAskSage(message: string, email: string, apiKey: string): Promise<string> {
  let token = await getAccessToken(email, apiKey)

  let res: Response
  try {
    res = await fetch(`${SERVER_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-access-tokens': token,
      },
      body: JSON.stringify({ message, temperature: 0.3 }),
    })
  } catch {
    throw new Error('Could not reach Ask Sage. If you are on a restricted network, check that api.asksage.ai is allowed.')
  }

  // Expired/invalid token — refresh once and retry
  if (res.status === 401) {
    token = await getAccessToken(email, apiKey, true)
    res = await fetch(`${SERVER_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-access-tokens': token,
      },
      body: JSON.stringify({ message, temperature: 0.3 }),
    })
  }

  if (!res.ok) {
    throw new Error(`Ask Sage returned an error (${res.status}). Try again in a moment.`)
  }

  const data = await res.json() as { message?: string; response?: string }
  // /server/query returns the answer in "message"
  return data.message ?? data.response ?? 'No response received from Ask Sage.'
}

const KEY_STORAGE = 'asksage-api-key'
const EMAIL_STORAGE = 'asksage-email'

export interface AskSageCredentials {
  email: string
  apiKey: string
}

export function getStoredCredentials(): AskSageCredentials {
  if (typeof window === 'undefined') return { email: '', apiKey: '' }
  return {
    email: localStorage.getItem(EMAIL_STORAGE) ?? process.env.NEXT_PUBLIC_ASKSAGE_EMAIL ?? '',
    apiKey: localStorage.getItem(KEY_STORAGE) ?? process.env.NEXT_PUBLIC_ASKSAGE_API_KEY ?? '',
  }
}

export function setStoredCredentials(email: string, apiKey: string): void {
  if (typeof window === 'undefined') return
  if (email.trim()) localStorage.setItem(EMAIL_STORAGE, email.trim())
  else localStorage.removeItem(EMAIL_STORAGE)
  if (apiKey.trim()) localStorage.setItem(KEY_STORAGE, apiKey.trim())
  else localStorage.removeItem(KEY_STORAGE)
  // Credentials changed — invalidate any cached token
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_TIME_KEY)
}
