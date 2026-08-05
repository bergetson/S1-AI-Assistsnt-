import type {
  MarketplaceApplication, ApplicationStatus, MarketplaceCycle, CommanderEndorsement,
} from './types'
import { canTransition, isTerminal } from './types'

// ── Marketplace workflow ──────────────────────────────────────────────────────
// Pure transition functions. They never mutate the input application — every
// change returns a new object with an appended history entry, so the audit trail
// cannot silently lose a step.

export interface TransitionResult {
  ok: boolean
  application: MarketplaceApplication
  error?: string
}

export function transition(
  app: MarketplaceApplication,
  to: ApplicationStatus,
  at: string,
  opts: { by?: string; note?: string } = {}
): TransitionResult {
  if (app.status === to) {
    return { ok: false, application: app, error: `Application is already ${to}.` }
  }
  if (isTerminal(app.status)) {
    return { ok: false, application: app, error: `${app.status} is a final state and cannot change.` }
  }
  if (!canTransition(app.status, to)) {
    return {
      ok: false, application: app,
      error: `Cannot move from ${app.status} to ${to}.`,
    }
  }
  return {
    ok: true,
    application: {
      ...app,
      status: to,
      updatedAt: at,
      history: [...app.history, { status: to, at, by: opts.by, note: opts.note }],
    },
  }
}

export function createApplication(
  id: string, cycleId: string, soldierId: string, positionId: number, at: string
): MarketplaceApplication {
  return {
    id, cycleId, soldierId, positionId,
    status: 'Interested',
    history: [{ status: 'Interested', at }],
    createdAt: at,
    updatedAt: at,
  }
}

export function recordEndorsement(
  app: MarketplaceApplication,
  endorsement: CommanderEndorsement
): MarketplaceApplication {
  return { ...app, endorsement, updatedAt: endorsement.at }
}

/** Cycle is accepting new soldier interest. */
export function cycleIsOpen(cycle: MarketplaceCycle, asOfIso: string): boolean {
  return cycle.status === 'Open' && cycle.openDate <= asOfIso && asOfIso <= cycle.closeDate
}

export function applicationsFor(
  apps: MarketplaceApplication[],
  filter: { cycleId?: string; soldierId?: string; positionId?: number; status?: ApplicationStatus }
): MarketplaceApplication[] {
  return apps.filter(a =>
    (!filter.cycleId || a.cycleId === filter.cycleId) &&
    (!filter.soldierId || a.soldierId === filter.soldierId) &&
    (filter.positionId == null || a.positionId === filter.positionId) &&
    (!filter.status || a.status === filter.status))
}

export interface SlateEntry {
  application: MarketplaceApplication
  /** Soldier's own ranking of this opportunity, if given. */
  preferenceRank?: number
  endorsed: boolean
}

/**
 * Candidate slate for one billet, ordered so endorsed candidates surface first,
 * then by the soldier's own stated preference.
 */
export function buildSlate(
  apps: MarketplaceApplication[], positionId: number
): SlateEntry[] {
  return applicationsFor(apps, { positionId })
    .filter(a => a.status !== 'Withdrawn')
    .map(a => ({
      application: a,
      preferenceRank: a.preferenceRank,
      endorsed: a.endorsement?.decision.startsWith('Endorsed') ?? false,
    }))
    .sort((x, y) =>
      Number(y.endorsed) - Number(x.endorsed) ||
      (x.preferenceRank ?? 99) - (y.preferenceRank ?? 99) ||
      x.application.id.localeCompare(y.application.id))
}

/** Applications that reference a cycle or position that no longer exists. */
export function orphanedApplications(
  apps: MarketplaceApplication[],
  cycleIds: Set<string>,
  positionIds: Set<number>
): MarketplaceApplication[] {
  return apps.filter(a => !cycleIds.has(a.cycleId) || !positionIds.has(a.positionId))
}
