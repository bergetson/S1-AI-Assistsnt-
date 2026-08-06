import type { RosterSoldier, PromotionNeed, Candidate, ManningReport, AttritionYear } from './commandTypes'
import type { Position } from './types'
import type { ForceSummary } from './forceAnalytics'
import { RETENTION_SOURCES, commissionedCap } from './data/retention'
import { RANK_NUM } from './scoring'
import { rulesContext, AI_GOVERNANCE } from './rules/aiContext'
import type { RuleReviewInput } from './rules/registry'
import type { TuningOverrides } from './rules/tuning'
import { isDemoFidelity, type DataSource } from './dataSources'

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

  // A 0 in these columns means the source extract carried no PEBD/DOR. Sending
  // the literal 0 tells the model a CW5 has zero years of service, and the
  // "do not invent numbers" rule below then locks it into that reading.
  const tis = s.yearsOfService > 0 ? `${s.yearsOfService}yr TIS` : 'TIS unknown'
  const tig = s.timeInGrade > 0 ? `${s.timeInGrade}yr TIG` : 'TIG unknown'

  return `${s.anonId}: ${s.rank} ${s.mos} (${s.careerCategory}, ${s.componentStatus}) | ` +
    `${tis}, ${tig}, ${s.timeInPosition}yr TIP | ` +
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
  /**
   * What the model is actually looking at. Passing a single isDemo boolean told
   * the model the whole roster was fabricated when only the civilian layer is.
   */
  sources: DataSource[]
  /** Reviewer sign-offs on policy rules, so a verified rule is briefed as verified. */
  reviews?: Record<string, RuleReviewInput>
  /** Local threshold/weight changes. The numbers above already reflect these. */
  overrides?: TuningOverrides
}

/** Tell the model precisely which parts of its input are real. */
function describeSources(sources: DataSource[]): string {
  if (!sources?.length) return ''
  const lines = sources.map(s =>
    `  - ${s.label}: ${isDemoFidelity(s.fidelity) ? 'GENERATED FOR DEMONSTRATION' : 'REAL'} — ${s.statement}` +
    (s.missingFields?.length ? ` Absent from the source: ${s.missingFields.join(', ')} (treat as Unknown).` : ''))
  return `DATA FIDELITY — be precise about this if the commander appears to be making a real decision:\n${lines.join('\n')}\n\n`
}

/**
 * Everything that depends on PEBD and date of rank, stated as known or unknown.
 * These three numbers are all 0 when the extract carried no service clocks, and
 * a bare "Board-eligible now: 0" reads to the model as an empty bench — the
 * opposite of the truth, and unrecoverable once the no-fabrication rule bites.
 */
function describeServiceClocks(s: ForceSummary): string {
  if (s.serviceDatesKnown === 0) {
    return 'Average TIG: UNKNOWN | Board-eligible now: UNKNOWN | Retirement eligible (20+ yr): UNKNOWN\n' +
      '  ^ The source extract contains no PEBD and no date of rank, so time in service and time in ' +
      'grade are absent for every soldier in this formation. Do NOT report these as zero and do NOT ' +
      'conclude that nobody is eligible. Say the data is missing and that promotion and retirement ' +
      'projections cannot be made until DOR and PEBD are loaded.'
  }
  const partial = s.serviceDatesKnown < s.assigned
    ? `  ^ Based on the ${s.serviceDatesKnown} of ${s.assigned} soldiers who have a date of rank and PEBD on ` +
      `file; the other ${s.assigned - s.serviceDatesKnown} are unknown and are excluded, so these are lower bounds.`
    : ''
  return `Average TIG ${s.avgTig} yr | Board-eligible now: ${s.boardEligible} | ` +
    `Retirement eligible (20+ yr): ${s.retirementEligible}${partial ? `\n${partial}` : ''}`
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
${describeSources(ctx.sources)}Assigned ${summary.assigned} of ${summary.authorized} authorized (${summary.fillPct}% fill)
Officers ${summary.officers} | Warrants ${summary.warrants} | Enlisted ${summary.enlisted}
AGR ${summary.agr} | M-Day ${summary.mday}
Average TIP ${summary.avgTip} yr | Over 3yr in seat: ${summary.staleInPosition} | Not MOS-qualified: ${summary.flagged}
${describeServiceClocks(summary)}

== MANNING BY GRADE ==
${gradeLines || '  (no billets in the selected formation)'}

== PROJECTED ATTRITION ${baseYear}–${baseYear + horizonYears} ==
${attritionLines}
Departure triggers modeled: AGR retention control point and officer removal for years of commissioned service (both statutory, counted whole), plus expiring contracts and 20-year retirement eligibility (weighted by historical take-rates, since an ETS is a contract expiring rather than a departure). RCP does not bind M-Day soldiers. Distinguish statutory losses from expected ones when you advise — the commander can influence the second group and not the first.

== PROMOTION REQUIREMENT ${baseYear}–${baseYear + horizonYears} ==
${promoLines}

${rulesContext({ reviews: ctx.reviews, overrides: ctx.overrides })}

Retention source documents: ${RETENTION_SOURCES.join(' · ')}

${AI_GOVERNANCE}

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

/**
 * Statutory removal timeline for commissioned officers.
 *
 * This is the sharpest real signal in the data: commission dates are on file,
 * so 10 USC 14507 removal at 28 years (LTC) and 30 years (COL) is date-certain
 * and computable per officer. The aggregate attrition block flattens it into a
 * yearly count, which loses the thing a commander needs — which grade, which
 * branch, and whether anyone behind them is close.
 */
export function buildSeniorLeaderBlock(
  roster: RosterSoldier[],
  baseYear: number,
  horizonYears = 10
): string {
  const events = roster
    .filter(s => s.commissionedYears > 0)
    .map(s => {
      const cap = commissionedCap(s.rank)
      if (!cap) return null
      return { s, cap, year: Math.max(baseYear, baseYear + Math.ceil(cap.years - s.commissionedYears)) }
    })
    .filter((e): e is { s: RosterSoldier; cap: { years: number; certain: boolean }; year: number } =>
      e !== null && e.year <= baseYear + horizonYears)

  if (events.length === 0) {
    return '\n\n== STATUTORY OFFICER REMOVAL ==\n' +
      '  No commission dates on file, so removal for years of commissioned service cannot be projected.'
  }

  const byYear = new Map<number, typeof events>()
  for (const e of events) byYear.set(e.year, [...(byYear.get(e.year) ?? []), e])

  const lines = [...byYear.keys()].sort().map(y => {
    const g = byYear.get(y)!
    const counts = new Map<string, number>()
    for (const e of g) counts.set(e.s.rank, (counts.get(e.s.rank) ?? 0) + 1)
    const who = g.map(e => `${e.s.anonId} ${e.s.rank}/${e.s.mos}`).join(', ')
    return `  ${y}: ${g.length} — ${[...counts].map(([k, v]) => `${k}:${v}`).join(' ')} — ${who}`
  })

  const certain = events.filter(e => e.cap.certain).length
  return `\n\n== STATUTORY OFFICER REMOVAL, ${baseYear}–${baseYear + horizonYears} (from commission date) ==
${lines.join('\n')}
${certain} of these ${events.length} are O5/O6 under 10 USC 14507 — date-certain, not board outcomes, and not influenceable.
The rest are O4 reaching 20 years commissioned service under 10 USC 14506: a promote-or-separate decision point, NOT a projected loss. An O4 selected for O5 fills a vacancy rather than creating one. Say which of the two you mean whenever you cite these numbers.`
}

/** Grade-by-grade view of who has been sitting still, from real date of rank. */
export function buildStagnationBlock(roster: RosterSoldier[], staleYears: number): string {
  const byGrade = new Map<string, number[]>()
  for (const s of roster) {
    if (s.timeInGrade > 0) byGrade.set(s.rank, [...(byGrade.get(s.rank) ?? []), s.timeInGrade])
  }
  if (byGrade.size === 0) {
    return '\n\n== TIME IN GRADE ==\n  No date of rank on file for this formation — time in grade is Unknown.'
  }
  const lines = [...byGrade.entries()]
    .sort((a, b) => (RANK_NUM[b[0]] ?? 0) - (RANK_NUM[a[0]] ?? 0))
    .map(([g, v]) => {
      const sorted = [...v].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const stale = sorted.filter(x => x >= 6).length
      return `  ${g}: n=${sorted.length} median ${median}yr, longest ${sorted[sorted.length - 1]}yr, ${stale} at 6+ yr in grade`
    })
  return `\n\n== TIME IN GRADE (real, from date of rank) ==
${lines.join('\n')}
Counted only over soldiers whose date of rank is on file. Anyone absent from this list has no DOR recorded and their time in grade is Unknown — never treat their absence as a low value.
A long time in grade is a signal to look, not a verdict: it can mean a soldier is stalled, or that the grade above them has no vacancy. Distinguish the two before recommending anything. Soldiers are due to move after ${staleYears} years in one seat.`
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
