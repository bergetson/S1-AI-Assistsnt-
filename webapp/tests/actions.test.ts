import { describe, it, expect } from 'vitest'
import { buildActions } from '@/lib/actions/build'
import { actionsForRole, sortActions, URGENCY_ORDER } from '@/lib/actions/types'
import { soldier, position, AS_OF } from './fixtures'

const base = {
  civilian: new Map(),
  applications: [],
  baseYear: 2026,
  asOfIso: AS_OF,
}

describe('action feed', () => {
  it('returns nothing when the formation is empty', () => {
    expect(buildActions({ ...base, positions: [position()], roster: [], uics: ['U'] })).toEqual([])
  })

  it('leads with the most urgent item', () => {
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E7', isCommandOrKD: true, vacancyStatus: 'Vacant' }),
      position({ id: 2, uic: 'U', grade: 'E5' }),
    ]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', positionId: 2 })]
    const items = buildActions({ ...base, positions, roster, uics: ['U'] })
    expect(items.length).toBeGreaterThan(0)
    // Sorted by urgency first.
    for (let i = 1; i < items.length; i++) {
      expect(URGENCY_ORDER[items[i].urgency]).toBeGreaterThanOrEqual(URGENCY_ORDER[items[i - 1].urgency])
    }
  })

  it('every item carries an answer, a reason, an action, and a destination', () => {
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E7', isCommandOrKD: true }),
      position({ id: 2, uic: 'U', grade: 'E5' }),
    ]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', timeInPosition: 5, flagged: true })]
    for (const i of buildActions({ ...base, positions, roster, uics: ['U'] })) {
      expect(i.headline.length).toBeGreaterThan(0)
      expect(i.why.length).toBeGreaterThan(0)
      expect(i.action.length).toBeGreaterThan(0)
      expect(i.href.startsWith('/')).toBe(true)
      expect(i.linkLabel.length).toBeGreaterThan(0)
      expect(i.roles.length).toBeGreaterThan(0)
    }
  })

  it('surfaces an empty command billet as act-now', () => {
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E9', isCommandOrKD: true, dutyTitle: 'CSM' }),
      position({ id: 2, uic: 'U', grade: 'E5' }),
    ]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', positionId: 2 })]
    const items = buildActions({ ...base, positions, roster, uics: ['U'] })
    const v = items.find(i => i.id === 'vacancy.critical')
    expect(v?.urgency).toBe('Act now')
    expect(v?.severity).toBe('critical')
  })

  it('tells the user which columns are missing rather than hiding the gap', () => {
    const positions = [position({ id: 1, uic: 'U', grade: 'E5' })]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', yearsOfService: 0, timeInGrade: 0 })]
    const items = buildActions({ ...base, positions, roster, uics: ['U'] })
    const gap = items.find(i => i.id === 'data.serviceDates')
    expect(gap).toBeDefined()
    expect(gap!.action).toMatch(/DOR and PEBD/)
  })

  it('does not raise the service-date gap once the dates exist', () => {
    const positions = [position({ id: 1, uic: 'U', grade: 'E5' })]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', yearsOfService: 9, timeInGrade: 3 })]
    const items = buildActions({ ...base, positions, roster, uics: ['U'] })
    expect(items.find(i => i.id === 'data.serviceDates')).toBeUndefined()
  })

  it('scopes items to the right roles', () => {
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E7', isCommandOrKD: true }),
      position({ id: 2, uic: 'U', grade: 'E5' }),
    ]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', timeInPosition: 5 })]
    const items = buildActions({ ...base, positions, roster, uics: ['U'] })
    for (const r of ['commander', 'talent', 'g1'] as const) {
      for (const i of actionsForRole(items, r)) expect(i.roles).toContain(r)
    }
  })

  it('is deterministic and order-independent', () => {
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E7', isCommandOrKD: true }),
      position({ id: 2, uic: 'U', grade: 'E5' }),
    ]
    const roster = [
      soldier({ id: 'a', uic: 'U', rank: 'E5', timeInPosition: 5 }),
      soldier({ id: 'b', uic: 'U', rank: 'E6', flagged: true }),
    ]
    const one = buildActions({ ...base, positions, roster, uics: ['U'] }).map(i => i.id)
    const two = buildActions({ ...base, positions, roster: [...roster].reverse(), uics: ['U'] }).map(i => i.id)
    expect(one).toEqual(two)
  })

  it('keeps ids unique so React keys are stable', () => {
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E7', isCommandOrKD: true }),
      position({ id: 2, uic: 'U', grade: 'E5' }),
    ]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', timeInPosition: 5, flagged: true })]
    const ids = buildActions({ ...base, positions, roster, uics: ['U'] }).map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('sortActions is stable for equal priority', () => {
    const mk = (id: string) => ({
      id, roles: ['commander' as const], urgency: 'Monitor' as const, severity: 'info' as const,
      headline: id, why: 'x', action: 'y', href: '/', linkLabel: 'go',
    })
    expect(sortActions([mk('b'), mk('a')]).map(i => i.id)).toEqual(['a', 'b'])
  })
})
