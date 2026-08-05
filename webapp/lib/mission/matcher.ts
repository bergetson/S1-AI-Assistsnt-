import type { RosterSoldier } from '../commandTypes'
import type { CivilianCapabilityProfile } from '../civilian/types'
import { VERIFICATION_RANK, PROFICIENCY_RANK, effectiveVerification, isCredentialExpired } from '../civilian/types'
import type { MissionDefinition, CapabilityRequirement, CandidateMatch } from './types'
import { assessSoldierImpact } from '../communityImpact/calculateImpact'
import { getCommute } from '../data/cities'
import { RANK_NUM } from '../scoring'

// ── Mission candidate matching ────────────────────────────────────────────────
// Fully deterministic. AI may narrate the results but never produces them, so a
// planner can defend every candidate on the slate.

function meetsRequirement(
  soldier: RosterSoldier,
  profile: CivilianCapabilityProfile | undefined,
  req: CapabilityRequirement,
  asOfIso: string
): boolean {
  // Military requirement: match on MOS prefix.
  if (req.mos) {
    if (!soldier.mos.toUpperCase().startsWith(req.mos.toUpperCase())) return false
    return true
  }
  if (!profile) return false

  const skills = profile.skills.filter(s =>
    (!req.category || s.category === req.category) &&
    (!req.subcategory || s.subcategory === req.subcategory))
  if (skills.length === 0) return false

  if (req.minProficiency) {
    const floor = PROFICIENCY_RANK[req.minProficiency]
    if (!skills.some(s => PROFICIENCY_RANK[s.proficiency] >= floor)) return false
  }
  if (req.minVerification) {
    const floor = VERIFICATION_RANK[req.minVerification]
    if (!skills.some(s => VERIFICATION_RANK[s.verificationStatus] >= floor)) return false
  }
  if (req.requiredCredential) {
    const target = req.requiredCredential.toLowerCase()
    const held = profile.credentials.filter(c =>
      c.name.toLowerCase().includes(target) && !isCredentialExpired(c, asOfIso))
    if (held.length === 0) return false
  }
  return true
}

export function findCandidates(
  mission: MissionDefinition,
  roster: RosterSoldier[],
  profiles: Map<string, CivilianCapabilityProfile>,
  asOfIso: string
): CandidateMatch[] {
  const activation = {
    durationDays: mission.durationDays,
    noticeDays: mission.noticeDays,
    activationType: 'State Active Duty' as const,
  }
  const out: CandidateMatch[] = []

  for (const soldier of roster) {
    const profile = profiles.get(soldier.id)
    const blockers: string[] = []
    const warnings: string[] = []

    if (mission.constraints.uics?.length && !mission.constraints.uics.includes(soldier.uic)) continue
    if (mission.constraints.componentStatus && soldier.componentStatus !== mission.constraints.componentStatus) continue
    if (mission.constraints.minRank && (RANK_NUM[soldier.rank] ?? 0) < (RANK_NUM[mission.constraints.minRank] ?? 0)) continue
    if (mission.constraints.maxRank && (RANK_NUM[soldier.rank] ?? 0) > (RANK_NUM[mission.constraints.maxRank] ?? 99)) continue

    const satisfies = mission.requirements
      .filter(r => meetsRequirement(soldier, profile, r, asOfIso))
      .map(r => r.id)
    if (satisfies.length === 0) continue

    if (soldier.flagged) blockers.push('Flagged — not eligible for favorable personnel actions.')

    const willingness = profile?.willingness.useCivilianSkillsOnMission ?? 'Ask Me'
    if (mission.constraints.requireWillingness && willingness === 'No') {
      blockers.push('Has declined use of civilian skills on missions.')
    }
    if (willingness === 'Ask Me') warnings.push('Asked to be consulted before civilian skills are used.')
    if (profile?.willingness.supportStateActiveDuty === 'No') {
      warnings.push('Reports not available for state active duty.')
    }

    const commute = getCommute(soldier.city, mission.location)
    const distanceMiles = commute?.miles ?? null
    if (mission.constraints.maxTravelMiles != null && distanceMiles != null &&
        distanceMiles > mission.constraints.maxTravelMiles) {
      blockers.push(`Distance ${distanceMiles} mi exceeds the ${mission.constraints.maxTravelMiles} mi limit.`)
    }
    const maxTravel = profile?.willingness.maxTravelMiles
    if (maxTravel != null && distanceMiles != null && distanceMiles > maxTravel) {
      warnings.push(`Stated travel limit is ${maxTravel} mi; mission is ${distanceMiles} mi away.`)
    }

    // ── Deterministic fit score (sorting aid only) ────────────────────────────
    const factors: CandidateMatch['factors'] = []

    const coverage = Math.round((satisfies.length / Math.max(1, mission.requirements.length)) * 100)
    const coveragePts = Math.min(35, satisfies.length * 18)
    factors.push({ label: 'Requirement coverage', points: coveragePts, max: 35,
      detail: `Satisfies ${satisfies.length} of ${mission.requirements.length} requirements (${coverage}%).` })

    const matched = (profile?.skills ?? []).filter(s =>
      mission.requirements.some(r => (!r.category || r.category === s.category) &&
        (!r.subcategory || r.subcategory === s.subcategory)))
    const bestProf = matched.reduce((m, s) => Math.max(m, PROFICIENCY_RANK[s.proficiency]), 0)
    const profPts = Math.round((bestProf / 5) * 25)
    factors.push({ label: 'Proficiency', points: profPts, max: 25,
      detail: bestProf ? `Highest relevant proficiency rank ${bestProf}/5.` : 'No civilian proficiency recorded for the required capability.' })

    const verification = profile
      ? [...profile.skills.map(s => s.verificationStatus),
         ...profile.credentials.map(c => effectiveVerification(c, asOfIso))]
          .reduce((best, v) => (VERIFICATION_RANK[v] > VERIFICATION_RANK[best] ? v : best), 'Unverified' as const)
      : 'Unverified' as const
    const verPts = Math.round((VERIFICATION_RANK[verification] / 3) * 20)
    factors.push({ label: 'Verification', points: verPts, max: 20,
      detail: `Best available verification: ${verification}.` })
    if (mission.constraints.requireVerifiedSkills && VERIFICATION_RANK[verification] < 2) {
      blockers.push('Mission requires verified skills; this soldier has only self-reported data.')
    }

    let distPts = 0
    let distDetail = 'Distance unknown — excluded from the score.'
    if (distanceMiles != null) {
      distPts = distanceMiles <= 50 ? 10 : distanceMiles <= 150 ? 7 : distanceMiles <= 300 ? 4 : 1
      distDetail = `${distanceMiles} mi from ${mission.location}.`
    }
    factors.push({ label: 'Proximity', points: distPts, max: 10, detail: distDetail })

    const willPts = willingness === 'Yes' ? 10 : willingness === 'Ask Me' ? 5 : 0
    factors.push({ label: 'Stated willingness', points: willPts, max: 10,
      detail: `Use of civilian skills on missions: ${willingness}.` })

    const impact = assessSoldierImpact(profile, activation, asOfIso)
    const fitScore = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)))

    out.push({
      soldierId: soldier.id,
      displayName: `${soldier.lastName}, ${soldier.firstName}`,
      anonId: soldier.anonId,
      rank: soldier.rank, mos: soldier.mos,
      unit: soldier.unitName, uic: soldier.uic, city: soldier.city,
      satisfies, fitScore, factors,
      verification, willingness, distanceMiles,
      communityImpact: impact.level,
      blockers, warnings,
    })
  }

  return out.sort((a, b) =>
    a.blockers.length - b.blockers.length ||
    b.satisfies.length - a.satisfies.length ||
    b.fitScore - a.fitScore ||
    a.soldierId.localeCompare(b.soldierId))
}

/** How well a selected set covers the mission. */
export function computeFills(
  mission: MissionDefinition,
  selected: CandidateMatch[]
) {
  return mission.requirements.map(req => {
    const filledBy = selected.filter(c => c.satisfies.includes(req.id)).map(c => c.soldierId)
    const filled = filledBy.length
    return {
      requirement: req,
      filledBy,
      needed: req.quantity,
      filled,
      unmet: Math.max(0, req.quantity - filled),
      over: Math.max(0, filled - req.quantity),
    }
  })
}
