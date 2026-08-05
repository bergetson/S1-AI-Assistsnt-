import type { Position } from '../types'
import type { RosterSoldier } from '../commandTypes'
import type { CivilianCapabilityProfile } from '../civilian/types'
import { isCredentialExpired, isCredentialExpiringSoon } from '../civilian/types'
import type { MarketplaceApplication } from '../marketplace/types'
import { RANK_NUM } from '../scoring'
import { MT_CITIES } from '../data/cities'
import { countyForCity } from '../communityImpact/types'
import { isStale } from '../provenance'

// ── Data quality detection ────────────────────────────────────────────────────
// Missing data is a first-class finding, not a silent default. Everything here
// is deterministic so the same import always produces the same issue list.

export type IssueSeverity = 'Error' | 'Warning' | 'Info'

export interface DataQualityIssue {
  id: string
  severity: IssueSeverity
  category: string
  entity: 'Soldier' | 'Position' | 'Civilian Profile' | 'Marketplace'
  entityId: string
  label: string
  detail: string
  recommendedAction: string
}

export interface DataQualityReport {
  issues: DataQualityIssue[]
  counts: { error: number; warning: number; info: number }
  byCategory: Array<{ category: string; count: number }>
  completeness: {
    soldiersTotal: number
    soldiersWithCivilianProfile: number
    soldiersWithWillingness: number
    civilianCoveragePct: number
  }
}

const VALID_CITIES = new Set(MT_CITIES)

export function analyzeDataQuality(
  positions: Position[],
  roster: RosterSoldier[],
  civilian: Map<string, CivilianCapabilityProfile>,
  applications: MarketplaceApplication[],
  asOfIso: string
): DataQualityReport {
  const issues: DataQualityIssue[] = []
  const positionIds = new Set(positions.map(p => p.id))
  const validUics = new Set(positions.map(p => p.uic).filter(Boolean) as string[])
  const push = (i: Omit<DataQualityIssue, 'id'>) =>
    issues.push({ ...i, id: `${i.entity}:${i.entityId}:${i.category}` })

  // Scan in a canonical order. Duplicate detection reports the SECOND record it
  // sees, so without this the same import produces different findings depending
  // on row order — the analytics have to be invariant to that.
  const orderedPositions = [...positions].sort((a, b) => a.id - b.id)
  const orderedRoster = [...roster].sort((a, b) => a.id.localeCompare(b.id))

  // ── Positions ───────────────────────────────────────────────────────────────
  const seenBillet = new Map<string, number>()
  for (const p of orderedPositions) {
    if (!p.uic) {
      push({ severity: 'Error', category: 'Missing UIC', entity: 'Position', entityId: String(p.id),
        label: p.dutyTitle, detail: 'Billet has no UIC, so it cannot be joined to a unit.',
        recommendedAction: 'Add the UIC in the source extract and re-import.' })
    }
    if (!p.mos) {
      push({ severity: 'Warning', category: 'Missing MOS', entity: 'Position', entityId: String(p.id),
        label: p.dutyTitle, detail: 'Billet has no MOS, so qualification matching is not possible.',
        recommendedAction: 'Populate POSCO/MOS in the source data.' })
    }
    if (!RANK_NUM[p.grade]) {
      push({ severity: 'Error', category: 'Unsupported grade', entity: 'Position', entityId: String(p.id),
        label: p.dutyTitle, detail: `Grade "${p.grade}" is not a recognized pay grade.`,
        recommendedAction: 'Correct the grade value in the source data.' })
    }
    if (p.city && !VALID_CITIES.has(p.city)) {
      push({ severity: 'Warning', category: 'Unknown city', entity: 'Position', entityId: String(p.id),
        label: p.dutyTitle, detail: `City "${p.city}" has no commute data.`,
        recommendedAction: 'Add the city to lib/data/cities.ts or correct the source value.' })
    }
    const key = `${p.uic}|${p.paraLine ?? ''}|${p.grade}|${p.mos}`
    if (p.paraLine) {
      const prev = seenBillet.get(key)
      if (prev != null) {
        push({ severity: 'Warning', category: 'Duplicate billet', entity: 'Position', entityId: String(p.id),
          label: p.dutyTitle, detail: `Same UIC, paragraph-line, grade, and MOS as position ${prev}.`,
          recommendedAction: 'Confirm whether these are genuinely two authorizations.' })
      } else seenBillet.set(key, p.id)
    }
  }

  // ── Soldiers ────────────────────────────────────────────────────────────────
  const seenSoldier = new Map<string, string>()
  for (const s of orderedRoster) {
    const label = `${s.lastName}, ${s.firstName}`.trim() || s.id
    if (!s.uic) {
      push({ severity: 'Error', category: 'Missing UIC', entity: 'Soldier', entityId: s.id, label,
        detail: 'Soldier has no UIC and is excluded from all unit analytics.',
        recommendedAction: 'Supply the UIC column on import.' })
    } else if (!validUics.has(s.uic)) {
      push({ severity: 'Warning', category: 'Unknown unit', entity: 'Soldier', entityId: s.id, label,
        detail: `UIC ${s.uic} does not exist in the force-structure file.`,
        recommendedAction: 'Verify the UIC or update the force structure.' })
    }
    if (!s.mos) {
      push({ severity: 'Warning', category: 'Missing MOS', entity: 'Soldier', entityId: s.id, label,
        detail: 'No MOS recorded; qualification matching will be weak.',
        recommendedAction: 'Add PMOS on the next import.' })
    }
    if (!RANK_NUM[s.rank]) {
      push({ severity: 'Error', category: 'Unsupported rank', entity: 'Soldier', entityId: s.id, label,
        detail: `Rank "${s.rank}" is not recognized.`, recommendedAction: 'Correct the rank value.' })
    }
    if (s.timeInGrade > s.yearsOfService && s.yearsOfService > 0) {
      push({ severity: 'Error', category: 'Impossible dates', entity: 'Soldier', entityId: s.id, label,
        detail: `TIG (${s.timeInGrade}) exceeds TIS (${s.yearsOfService}).`,
        recommendedAction: 'Correct DOR or PEBD in the source system.' })
    }
    if (s.timeInPosition > s.timeInGrade && s.timeInGrade > 0) {
      push({ severity: 'Warning', category: 'Impossible dates', entity: 'Soldier', entityId: s.id, label,
        detail: `TIP (${s.timeInPosition}) exceeds TIG (${s.timeInGrade}).`,
        recommendedAction: 'Verify date arrived station.' })
    }
    if (s.yearsOfService === 0 && s.timeInGrade === 0) {
      push({ severity: 'Info', category: 'Missing service dates', entity: 'Soldier', entityId: s.id, label,
        detail: 'No TIS or TIG recorded — promotion and retention analysis will read as Unknown.',
        recommendedAction: 'Import DOR and PEBD to enable board eligibility.' })
    }
    if (!s.ets) {
      push({ severity: 'Info', category: 'Missing ETS', entity: 'Soldier', entityId: s.id, label,
        detail: 'No ETS date; this soldier is excluded from contract-based attrition.',
        recommendedAction: 'Add the ETS column on import.' })
    }
    if (s.positionId != null && !positionIds.has(s.positionId)) {
      push({ severity: 'Warning', category: 'Orphaned assignment', entity: 'Soldier', entityId: s.id, label,
        detail: `Assigned to position ${s.positionId}, which does not exist.`,
        recommendedAction: 'Re-import positions or clear the assignment.' })
    }
    const dupKey = `${s.lastName}|${s.firstName}|${s.uic}`.toLowerCase()
    const prev = seenSoldier.get(dupKey)
    if (prev && s.lastName) {
      push({ severity: 'Warning', category: 'Duplicate soldier', entity: 'Soldier', entityId: s.id, label,
        detail: `Same name and UIC as record ${prev}.`,
        recommendedAction: 'Confirm these are two people, not a double import.' })
    } else if (s.lastName) seenSoldier.set(dupKey, s.id)

    if (!countyForCity(s.city)) {
      push({ severity: 'Info', category: 'Unknown county', entity: 'Soldier', entityId: s.id, label,
        detail: `No county mapping for "${s.city}"; geographic analysis will skip this soldier.`,
        recommendedAction: 'Add the city to the county map.' })
    }
  }

  // ── Civilian profiles ───────────────────────────────────────────────────────
  let withWillingness = 0
  for (const [soldierId, prof] of civilian) {
    const s = roster.find(r => r.id === soldierId)
    const label = s ? `${s.lastName}, ${s.firstName}` : soldierId
    if (prof.willingness.useCivilianSkillsOnMission !== 'Ask Me') withWillingness++

    if (!prof.employment) {
      push({ severity: 'Info', category: 'Missing civilian occupation', entity: 'Civilian Profile', entityId: soldierId,
        label, detail: 'Skills recorded but no civilian employment; community-impact analysis is limited.',
        recommendedAction: 'Ask the soldier to complete the employment section.' })
    } else if (!prof.employment.workCounty && !countyForCity(prof.employment.workCity)) {
      push({ severity: 'Info', category: 'Missing civilian county', entity: 'Civilian Profile', entityId: soldierId,
        label, detail: 'Work county unknown; geographic concentration cannot be assessed.',
        recommendedAction: 'Capture the civilian work county.' })
    }
    for (const c of prof.credentials) {
      if (isCredentialExpired(c, asOfIso)) {
        push({ severity: 'Warning', category: 'Expired credential', entity: 'Civilian Profile', entityId: soldierId,
          label, detail: `${c.name} expired ${c.expirationDate ?? '(date unknown)'}.`,
          recommendedAction: 'Ask the soldier to renew and re-verify.' })
      } else if (isCredentialExpiringSoon(c, asOfIso)) {
        push({ severity: 'Info', category: 'Expiring credential', entity: 'Civilian Profile', entityId: soldierId,
          label, detail: `${c.name} expires ${c.expirationDate}.`,
          recommendedAction: 'Flag for renewal.' })
      }
    }
    const unverified = prof.skills.filter(sk => sk.verificationStatus === 'Unverified' || sk.verificationStatus === 'Self Reported')
    if (unverified.length === prof.skills.length && prof.skills.length > 0) {
      push({ severity: 'Info', category: 'Unverified skills', entity: 'Civilian Profile', entityId: soldierId,
        label, detail: `All ${prof.skills.length} skills are self-reported or unverified.`,
        recommendedAction: 'Leader review or document verification would raise confidence.' })
    }
    if (isStale(prof.provenance, asOfIso)) {
      push({ severity: 'Info', category: 'Stale data', entity: 'Civilian Profile', entityId: soldierId,
        label, detail: `Civilian data last sourced ${prof.provenance.sourceDate}.`,
        recommendedAction: 'Ask the soldier to review and confirm.' })
    }
  }

  // ── Marketplace ─────────────────────────────────────────────────────────────
  for (const a of applications) {
    if (!positionIds.has(a.positionId)) {
      push({ severity: 'Warning', category: 'Orphaned application', entity: 'Marketplace', entityId: a.id,
        label: `Application ${a.id}`, detail: `References position ${a.positionId}, which no longer exists.`,
        recommendedAction: 'Close the application or restore the billet.' })
    }
    if (!roster.some(r => r.id === a.soldierId)) {
      push({ severity: 'Warning', category: 'Orphaned application', entity: 'Marketplace', entityId: a.id,
        label: `Application ${a.id}`, detail: `References soldier ${a.soldierId}, who is not on the roster.`,
        recommendedAction: 'Close the application or re-import the roster.' })
    }
  }

  const counts = {
    error: issues.filter(i => i.severity === 'Error').length,
    warning: issues.filter(i => i.severity === 'Warning').length,
    info: issues.filter(i => i.severity === 'Info').length,
  }
  const catMap = new Map<string, number>()
  for (const i of issues) catMap.set(i.category, (catMap.get(i.category) ?? 0) + 1)

  return {
    issues,
    counts,
    byCategory: [...catMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    completeness: {
      soldiersTotal: roster.length,
      soldiersWithCivilianProfile: civilian.size,
      soldiersWithWillingness: withWillingness,
      civilianCoveragePct: roster.length ? Math.round((civilian.size / roster.length) * 100) : 0,
    },
  }
}
