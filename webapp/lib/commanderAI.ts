import type { RosterSoldier, PromotionNeed, Candidate, ManningReport, AttritionYear } from './commandTypes'
import type { Position } from './types'
import type { ForceSummary } from './forceAnalytics'
import { RETENTION_SOURCES } from './data/retention'

// ── The anonymization boundary ────────────────────────────────────────────────
// Everything above this line may hold real names. Nothing below it ever does.
//
// The app is a static site whose Claude key is baked into a public bundle, and a
// roster carries names alongside evaluation content. So names never leave the
// browser: the AI reasons over stable pseudonyms ("S-142") and the reply is
// mapped back to real names locally before it is rendered.
//
// Fields deliberately NOT transmitted: lastName, firstName, pebd, ets (exact
// dates are identifying), notes. Eval bullets are opt-in and off by default.

export interface NameMap {
  /** anonId → display name, used only in the browser to rehydrate AI output. */
  toName: Map<string, string>
}

export function buildNameMap(roster: RosterSoldier[]): NameMap {
  const toName = new Map<string, string>()
  for (const s of roster) {
    const name = [s.lastName, s.firstName].filter(Boolean).join(', ')
    toName.set(s.anonId, name || s.anonId)
  }
  return { toName }
}

/** One roster soldier reduced to the fields that are safe to transmit. */
export function anonymizeSoldier(s: RosterSoldier, includeBullets: boolean): string {
  const evalStr =
    s.careerCategory === 'Enlisted'
      ? `NCOER ${s.ncoerBox || 'unrated'}`
      : `SR ${s.srBox || 'unrated'}${s.raterBox ? `, rater ${s.raterBox}` : ''}`
  const pme = s.pmeComplete.length ? s.pmeComplete.join('/') : 'none'
  const bullets = includeBullets && s.evalBullets ? ` | eval: "${s.evalBullets}"` : ''
  const flags = [
    s.isPromotable ? 'promotable' : '',
    s.flagged ? 'FLAGGED' : '',
  ].filter(Boolean).join(', ')

  return `${s.anonId}: ${s.rank} ${s.mos} (${s.careerCategory}, ${s.componentStatus}) | ` +
    `${s.yearsOfService}yr TIS, ${s.timeInGrade}yr TIG, ${s.timeInPosition}yr TIP | ` +
    `${s.dutyTitle} @ ${s.city} | ${evalStr} | PME: ${pme}` +
    `${flags ? ` | ${flags}` : ''}${bullets}`
}

/** Replace "S-142" tokens in AI output with real names, in the browser only. */
export function rehydrateNames(text: string, map: NameMap): string {
  return text.replace(/\bS-\d{3,}\b/g, token => {
    const name = map.toName.get(token)
    return name ? `${name} (${token})` : token
  })
}

// ── Commander prompt builder ──────────────────────────────────────────────────
// A sibling to buildSystemPrompt() in lib/asksage.ts, NOT a modification of it.
// That prompt carries a hard scope guard written for an individual soldier's
// career questions and would refuse force-management analysis outright.

export interface CommanderContext {
  formationName: string
  summary: ForceSummary
  manning: ManningReport
  attrition: AttritionYear[]
  promotions: PromotionNeed[]
  baseYear: number
  horizonYears: number
  isDemo: boolean
}

export function buildCommanderPrompt(ctx: CommanderContext): string {
  const { summary, manning, attrition, promotions, baseYear, horizonYears } = ctx

  const gradeLines = manning.byGrade
    .map(r => `  ${r.key}: ${r.assigned}/${r.authorized} assigned (${r.fillPct}%${r.delta < 0 ? `, short ${-r.delta}` : r.delta > 0 ? `, over ${r.delta}` : ''})`)
    .join('\n')

  const attritionLines = attrition
    .filter(y => y.atRisk > 0)
    .map(y => `  ${y.year}: ~${y.expected} expected losses (${y.hard} statutory, ${y.atRisk} at risk) — O:${y.byCategory.Officer} W:${y.byCategory.Warrant} E:${y.byCategory.Enlisted}`)
    .join('\n') || '  No projected departures in the window.'

  const promoLines = promotions
    .filter(p => p.promotionsNeeded > 0 || p.feederStrength > 0)
    .map(p => {
      const head = `  ${p.fromGrade}→${p.toGrade} (${p.category}): need ${p.promotionsNeeded} ` +
        `(${Math.max(0, p.authorizedAtTarget - p.filledAtTarget)} open + ${p.projectedLosses} expected losses)`
      if (p.accessionDriven) {
        return `${head}; NO feeder grade in this formation → must be filled by accession (OCS/ROTC/direct appointment) or lateral transfer, NOT internal promotion`
      }
      return `${head}; feeder pool ${p.feederStrength}, eligible by ${baseYear + horizonYears}: ${p.eligibleByHorizon}` +
        `${p.gap > 0 ? ` → SHORTFALL of ${p.gap}` : p.gap < 0 ? ` → surplus of ${-p.gap}` : ' → balanced'}`
    })
    .join('\n') || '  No grade transitions to plan in this formation.'

  return `You are Steeves, a senior personnel advisor (former State Command Sergeant Major and G1 planner) supporting a Montana Army National Guard commander with FORCE MANAGEMENT — not individual career counseling.

== SCOPE ==
Answer questions about manning, talent management, succession, promotion planning, attrition, and readiness for the formation described below. If asked something unrelated to force management or Army personnel policy, say: "That's outside what I can help with here — I'm focused on managing your formation."

== PRIVACY — THIS IS NOT OPTIONAL ==
Soldiers are identified ONLY by pseudonymous IDs like S-014. You do not know their names and must never guess, invent, or ask for them. Always refer to individuals by their ID exactly as given (e.g. "S-014"); the commander's browser maps IDs back to names locally.

== FORMATION: ${ctx.formationName} ==
${ctx.isDemo ? 'NOTE: This is SYNTHETIC DEMONSTRATION DATA, not a real roster. Say so if the commander appears to be making an actual decision from it.\n' : ''}Assigned ${summary.assigned} of ${summary.authorized} authorized (${summary.fillPct}% fill)
Officers ${summary.officers} | Warrants ${summary.warrants} | Enlisted ${summary.enlisted}
AGR ${summary.agr} | M-Day ${summary.mday}
Average TIG ${summary.avgTig} yr | Average TIP ${summary.avgTip} yr
Board-eligible now: ${summary.boardEligible} | Over ${3}yr in seat: ${summary.staleInPosition} | Flagged: ${summary.flagged}
Already retirement eligible (20+ yr): ${summary.retirementEligible}

== MANNING BY GRADE ==
${gradeLines || '  (no billets in the selected formation)'}

== PROJECTED ATTRITION ${baseYear}–${baseYear + horizonYears} ==
${attritionLines}
Departure triggers modeled: AGR retention control point and officer removal for years of commissioned service (both statutory, counted whole), plus expiring contracts and 20-year retirement eligibility (weighted by historical take-rates, since an ETS is a contract expiring rather than a departure). RCP does not bind M-Day soldiers. Distinguish statutory losses from expected ones when you advise — the commander can influence the second group and not the first.

== PROMOTION REQUIREMENT ${baseYear}–${baseYear + horizonYears} ==
${promoLines}

== POLICY BASIS ==
${RETENTION_SOURCES.map(s => `  - ${s}`).join('\n')}
Promotion gates come from AR 600-8-19, AR 135-155, and NGR 600-101. PPOM 24-014 (Jun 2024) suspended BLC/ALC/SLC/MLC as hard promotion gates for SGT through MSG; SMC is still required for E9.

== GUIDANCE ==
- Lead with the answer, then the reasoning. Commanders read the first line and decide whether to keep going.
- Be specific and quantitative. Cite the actual numbers above rather than speaking generally.
- When you flag a shortfall, say what the commander can actually do about it: lateral transfer, reclassification, recruiting emphasis, early board packet, or accepting risk in a specific billet.
- Name the tradeoff. If filling one gap creates another, say so.
- Keep it under 350 words unless asked to expand. Prefer short paragraphs and tight bullets.
- Do not fabricate soldiers, billets, or numbers that are not in the data above. If something isn't there, say what you'd need.
- Never speculate about a named individual's medical, family, or disciplinary circumstances.`
}

/** Roster detail block, appended only when the question is about specific people. */
export function buildRosterBlock(
  roster: RosterSoldier[],
  includeBullets: boolean,
  limit = 60
): string {
  if (roster.length === 0) return ''
  const shown = roster.slice(0, limit)
  const truncated = roster.length > limit
    ? `\n(${roster.length - limit} more not shown — narrow the formation for full detail)`
    : ''
  return `\n\n== ROSTER DETAIL (pseudonymous) ==\n` +
    shown.map(s => anonymizeSoldier(s, includeBullets)).join('\n') + truncated
}

/** Candidate slate for a specific billet, already scored deterministically. */
export function buildCandidateBlock(target: Position, candidates: Candidate[]): string {
  if (candidates.length === 0) return ''
  return `\n\n== BILLET UNDER CONSIDERATION ==\n` +
    `${target.dutyTitle} — ${target.grade} ${target.mos}, ${target.city} (${target.statusType}, ${target.vacancyStatus})\n` +
    `\n== DETERMINISTICALLY RANKED CANDIDATES ==\n` +
    `These scores were computed locally from grade, MOS, TIG/TIS gates, evaluations, time in seat, and drive time. Explain and challenge them; do not recompute them.\n` +
    candidates.map((c, i) =>
      `${i + 1}. ${c.soldier.anonId} — ${c.score}/100, ${c.readiness}\n` +
      c.factors.map(f => `     ${f.label}: ${f.points}/${f.max} — ${f.detail}`).join('\n') +
      (c.blockers.length ? `\n     BLOCKERS: ${c.blockers.join('; ')}` : '')
    ).join('\n')
}
