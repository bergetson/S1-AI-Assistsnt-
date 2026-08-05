import type { Position } from '../types'
import type { RosterSoldier } from '../commandTypes'
import { vacantBillets } from '../forceAnalytics'
import type { MarketplaceCycle } from './types'

/**
 * A deterministic demonstration cycle so the marketplace is walkable without
 * anyone having to author one first. Picks the highest-leverage vacancies
 * (command/KD first, then senior grades) by a stable ordering.
 */
export function buildDemoCycle(
  positions: Position[],
  roster: RosterSoldier[],
  uics: string[],
  limit = 24
): MarketplaceCycle {
  const vacancies = vacantBillets(positions, roster, uics)
    .filter(p => p.authorized !== false)
    .sort((a, b) =>
      Number(b.isCommandOrKD) - Number(a.isCommandOrKD) ||
      b.grade.localeCompare(a.grade) ||
      a.id - b.id)
    .slice(0, limit)

  return {
    id: 'cycle-demo-2026',
    name: 'FY26 Demonstration Marketplace Cycle',
    description:
      'Sample cycle built from currently vacant authorized billets so the workflow can be walked end to end. Not an official announcement.',
    status: 'Open',
    openDate: '2026-01-01',
    closeDate: '2026-12-31',
    reportWindow: 'Negotiable with gaining unit',
    vacancyIds: vacancies.map(v => v.id),
    createdBy: 'Prototype demo',
  }
}
