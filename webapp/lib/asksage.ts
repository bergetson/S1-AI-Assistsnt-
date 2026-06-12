import type { SoldierProfile, ScoredPosition } from './types'

const YEAR = new Date().getFullYear()

export function buildSystemPrompt(profile: SoldierProfile, topMatches: ScoredPosition[]): string {
  const matchSummary = topMatches.slice(0, 8).map(p =>
    `  - ${p.grade} ${p.dutyTitle} @ ${p.unit}, ${p.city} | Score: ${p.totalScore}/100 | ${p.matchLabel} | ${p.commuteMins >= 0 ? p.commuteMins + ' min drive' : 'commute unknown'} | ${p.vacancyStatus}`
  ).join('\n')

  const pmeEnlisted = `BLC=${profile.blcComplete?'✓':'✗'} ALC=${profile.alcComplete?'✓':'✗'} SLC=${profile.slcComplete?'✓':'✗'} SMC=${profile.smcComplete?'✓':'✗'}`
  const pmeOfficer = `BOLC=${profile.bolcComplete?'✓':'✗'} CCC=${profile.cccComplete?'✓':'✗'} ILE=${profile.ileComplete?'✓':'✗'} SSC=${profile.sscComplete?'✓':'✗'}`
  const pmeWarrant = `WOBC=${profile.wobcComplete?'✓':'✗'} WOAC=${profile.woacComplete?'✓':'✗'} WOILE=${profile.woileComplete?'✓':'✗'}`

  const retirementYear = YEAR + Math.max(0, 20 - profile.yearsOfService)

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

== TOP MATCHED POSITIONS ==
${matchSummary || '(Profile not complete enough to score positions)'}

== GUIDANCE ==
Give DIRECT, SPECIFIC, ACTIONABLE advice grounded in this Soldier's actual data. Reference specific positions when relevant. Be a trusted mentor — tell the hard truth and champion their success. If they're behind on PME, say so. If a goal is unrealistic, say what IS realistic instead.

Always end with 1-3 specific next steps they can take THIS MONTH.

Focus on AGR pipeline opportunities where relevant — this is often the most impactful career decision a Guard Soldier makes. Help them understand realistic timelines to the 20-year mark (${retirementYear} for this Soldier).

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
