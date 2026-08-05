import { describe, it, expect } from 'vitest'
import { realRoster } from '@/lib/data/realRoster'
import { positions } from '@/lib/data/positions'
import { RANK_NUM } from '@/lib/scoring'

describe('real de-identified roster', () => {
  it('carries the full assigned force', () => {
    expect(realRoster.length).toBeGreaterThan(2000)
  })

  it('contains no identity fields', () => {
    // Every display name must be the pseudonym, and no free-text name may leak.
    for (const s of realRoster) {
      expect(s.lastName).toMatch(/^S-\d{4}$/)
      expect(s.firstName).toBe('')
      expect(s.anonId).toMatch(/^S-\d{4}$/)
      expect(s.evalBullets).toBe('')
      expect(s.notes).toBe('')
    }
  })

  it('uses unique stable ids and pseudonyms', () => {
    expect(new Set(realRoster.map(s => s.id)).size).toBe(realRoster.length)
    expect(new Set(realRoster.map(s => s.anonId)).size).toBe(realRoster.length)
  })

  it('has valid grades and career categories', () => {
    for (const s of realRoster) {
      expect(RANK_NUM[s.rank], `bad rank ${s.rank}`).toBeGreaterThan(0)
      expect(['Enlisted', 'Warrant', 'Officer']).toContain(s.careerCategory)
    }
  })

  it('links every soldier to a real billet', () => {
    const ids = new Set(positions.map(p => p.id))
    for (const s of realRoster) {
      expect(s.positionId).not.toBeNull()
      expect(ids.has(s.positionId as number), `orphan positionId ${s.positionId}`).toBe(true)
    }
  })

  it('assigns every soldier to a UIC that exists in the force structure', () => {
    const uics = new Set(positions.map(p => p.uic).filter(Boolean))
    for (const s of realRoster) expect(uics.has(s.uic), `unknown uic ${s.uic}`).toBe(true)
  })

  it('never double-books a billet', () => {
    const seen = new Set<number>()
    for (const s of realRoster) {
      const id = s.positionId as number
      expect(seen.has(id), `position ${id} assigned twice`).toBe(false)
      seen.add(id)
    }
  })

  it('carries real component status including AGR', () => {
    const agr = realRoster.filter(s => s.componentStatus === 'AGR').length
    expect(agr).toBeGreaterThan(100)
    expect(agr).toBeLessThan(realRoster.length / 2)
  })

  it('carries real ETS dates', () => {
    const withEts = realRoster.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.ets))
    expect(withEts.length).toBeGreaterThan(realRoster.length * 0.9)
  })

  it('carries real time in position', () => {
    const withTip = realRoster.filter(s => s.timeInPosition > 0)
    expect(withTip.length).toBeGreaterThan(realRoster.length * 0.8)
    for (const s of realRoster) expect(s.timeInPosition).toBeLessThanOrEqual(40)
  })

  it('leaves TIS and TIG at zero rather than fabricating them', () => {
    // The source extract has neither PEBD nor DOR. Inventing values would make
    // promotion eligibility look authoritative when it is not knowable.
    for (const s of realRoster) {
      expect(s.yearsOfService).toBe(0)
      expect(s.timeInGrade).toBe(0)
    }
  })

  it('is stable across imports', async () => {
    const again = (await import('@/lib/data/realRoster')).realRoster
    expect(again[0].id).toBe(realRoster[0].id)
    expect(again.length).toBe(realRoster.length)
  })
})
