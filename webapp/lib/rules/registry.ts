import type { PolicyRule } from './types'
import { PROMOTION_GATES } from '../scoring'
import { RETENTION_LIMITS, RETIREMENT_YEARS, MRD_AGE } from '../data/retention'

// ── Rule registry ─────────────────────────────────────────────────────────────
// Wraps the existing PROMOTION_GATES and RETENTION_LIMITS tables in policy
// metadata rather than restating their numbers. The tables stay authoritative
// for the math; this layer adds authority, status, and review provenance so the
// UI can caution the user and the AI can be briefed from the same place.

function promotionRules(): PolicyRule[] {
  return Object.entries(PROMOTION_GATES).map(([grade, gate]) => ({
    id: `promo.${grade}`,
    topic: 'Promotion' as const,
    description:
      `Promotion to ${grade}: minimum ${gate.minTig} yr time in grade, ` +
      `${gate.minTis} yr time in service. Typical competitive TIG ~${gate.typicalTig} yr.` +
      (gate.pmeRequired.length ? ` Required PME: ${gate.pmeRequired.join(', ')}.` : ''),
    sourceAuthority: grade.startsWith('E')
      ? 'AR 600-8-19 / NGR 600-200'
      : grade.startsWith('W')
        ? 'NGR 600-101 / AR 135-155'
        : 'AR 135-155 / 10 USC Ch. 1405',
    citation: gate.notes,
    status: 'Unverified',
    applicability: `${grade.startsWith('E') ? 'Enlisted' : grade.startsWith('W') ? 'Warrant officer' : 'Commissioned officer'} soldiers competing for ${grade}.`,
    params: {
      minTig: gate.minTig,
      typicalTig: gate.typicalTig,
      minTis: gate.minTis,
      pmeRequired: gate.pmeRequired.join(',') || null,
    },
  }))
}

function retentionRules(): PolicyRule[] {
  return Object.values(RETENTION_LIMITS).map(limit => ({
    id: `retention.${limit.grade}`,
    topic: 'Retention' as const,
    description:
      `${limit.grade}: ` +
      (limit.rcpAgr != null ? `AGR retention control point ${limit.rcpAgr} yr TIS. ` : '') +
      (limit.rcpMday != null ? `M-Day RCP ${limit.rcpMday} yr TIS. ` : 'RCP does not bind M-Day/TPU. ') +
      (limit.mrdCommissioned != null ? `Removal at ${limit.mrdCommissioned} yr commissioned service.` : ''),
    sourceAuthority: limit.grade.startsWith('O')
      ? '10 USC 14505 / 14506 / 14507'
      : 'NGB PPOM 16-028 / AR 140-10 / NGR 600-200',
    citation: limit.note,
    // Flagged honestly: RCP tables are revised by PPOM and these were not
    // confirmed against a current publication.
    status: 'Draft',
    applicability: `${limit.grade} soldiers. RCP applies to AGR/Technician only.`,
    params: {
      rcpAgr: limit.rcpAgr,
      rcpMday: limit.rcpMday,
      mrdCommissioned: limit.mrdCommissioned,
    },
    notes: 'Requires S1/G1 verification before use in a real personnel decision.',
  }))
}

const STANDALONE: PolicyRule[] = [
  {
    id: 'retention.nonRegular20',
    topic: 'Retention',
    description: `Non-regular (reserve) retirement eligibility at ${RETIREMENT_YEARS} qualifying years, payable at age 60.`,
    sourceAuthority: '10 USC Ch. 1223',
    status: 'Verified',
    applicability: 'All reserve component soldiers.',
    params: { years: RETIREMENT_YEARS },
    notes: 'Qualifying ("good") years require 50 retirement points. The prototype uses PEBD as a proxy and will be wrong for soldiers with bad years.',
  },
  {
    id: 'retention.mrdAge',
    topic: 'Retention',
    description: `General ARNG mandatory removal age of ${MRD_AGE}.`,
    sourceAuthority: 'NGR 635-100',
    status: 'Unverified',
    applicability: 'ARNG soldiers, with grade- and category-specific exceptions.',
    params: { age: MRD_AGE },
  },
  {
    id: 'promo.ppom24014',
    topic: 'PME',
    description: 'BLC/ALC/SLC/MLC are suspended as hard promotion gates for SGT through MSG. PME remains a board discriminator. SMC is still required for E9.',
    sourceAuthority: 'NGB PPOM 24-014',
    effectiveDate: '2024-06-01',
    status: 'Unverified',
    applicability: 'Enlisted promotions E5–E8.',
    notes: 'If this PPOM has been rescinded, enlisted promotion scoring must be revisited.',
  },
  {
    id: 'attrition.etsSeparation',
    topic: 'Retention',
    description: 'An expiring contract is modeled as a 30% chance of separation rather than a certain loss, because most soldiers reenlist.',
    sourceAuthority: 'Prototype planning assumption',
    status: 'Assumption',
    applicability: 'Attrition forecasting only.',
    params: { separationRate: 0.3 },
    notes: 'Replace with the actual state reenlistment rate when available.',
  },
  {
    id: 'attrition.twentyYearDeparture',
    topic: 'Retention',
    description: 'Reaching 20 qualifying years is modeled as a 25% chance of departure in that year, not an automatic loss.',
    sourceAuthority: 'Prototype planning assumption',
    status: 'Assumption',
    applicability: 'Attrition forecasting only.',
    params: { departureRate: 0.25 },
  },
  {
    id: 'community.noAutoActivation',
    topic: 'Community Impact',
    description: 'Civilian occupation and skill data are decision support only. They never automatically determine activation, assignment, or exemption.',
    sourceAuthority: 'Prototype governance rule',
    status: 'Verified',
    applicability: 'All civilian capability and community impact features.',
    notes: 'Human decision authority is preserved at every step.',
  },
]

let cached: PolicyRule[] | null = null

export function allRules(): PolicyRule[] {
  if (!cached) cached = [...promotionRules(), ...retentionRules(), ...STANDALONE]
  return cached
}

export function rulesByTopic(topic: PolicyRule['topic']): PolicyRule[] {
  return allRules().filter(r => r.topic === topic)
}

export function getRule(id: string): PolicyRule | undefined {
  return allRules().find(r => r.id === id)
}

/** Rules a reviewer should look at first. */
export function rulesNeedingReview(): PolicyRule[] {
  const order = { Superseded: 0, Outdated: 1, Draft: 2, Unverified: 3, Assumption: 4, Verified: 5 }
  return allRules()
    .filter(r => r.status !== 'Verified')
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
}
