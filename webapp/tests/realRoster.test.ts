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

  it('leaves time in service at zero rather than fabricating it', () => {
    // Neither extract carries PEBD, so time in service is genuinely unknowable.
    // Inventing it would make retirement eligibility and enlisted RCP look
    // authoritative when they are not.
    for (const s of realRoster) expect(s.yearsOfService).toBe(0)
  })

  it('carries real time in grade for the population the leader extract covered', () => {
    // Date of rank arrived for E7 and above, all warrants, and all officers.
    // Everyone else stays at 0, which the app reads as Unknown.
    const known = realRoster.filter(s => s.timeInGrade > 0)
    expect(known.length).toBeGreaterThan(600)
    expect(known.length).toBeLessThan(realRoster.length)
    for (const s of realRoster) expect(s.timeInGrade).toBeLessThanOrEqual(40)
  })

  it('only knows time in grade for senior grades, never for junior enlisted', () => {
    // A junior soldier showing a real TIG would mean the enrichment joined to
    // the wrong person — the leader extract contains nobody below E7.
    const junior = realRoster.filter(
      s => s.careerCategory === 'Enlisted' && ['E1', 'E2', 'E3', 'E4', 'E5'].includes(s.rank))
    expect(junior.length).toBeGreaterThan(500)
    for (const s of junior) expect(s.timeInGrade).toBe(0)
  })

  it('records the soldier grade, not the billet grade', () => {
    // The previous generation stored MIL_GRADE, the billet's authorized grade,
    // which erased every under- and over-slotted assignment. The tell was that
    // no E1-E3 existed at all, because no billet is authorized below E4.
    const junior = realRoster.filter(s => ['E1', 'E2', 'E3'].includes(s.rank))
    expect(junior.length).toBeGreaterThan(200)
  })

  it('carries PME where the leader extract supplied education level', () => {
    const withPme = realRoster.filter(s => s.pmeComplete.length > 0)
    expect(withPme.length).toBeGreaterThan(600)
    // PME is cumulative: nobody holds SLC without ALC beneath it.
    for (const s of realRoster) {
      if (s.pmeComplete.includes('SLC')) expect(s.pmeComplete).toContain('ALC')
      if (s.pmeComplete.includes('ILE')) expect(s.pmeComplete).toContain('CCC')
    }
  })

  it('gives commissioned service only to commissioned officers', () => {
    for (const s of realRoster) {
      if (s.commissionedYears > 0) expect(s.careerCategory).not.toBe('Enlisted')
    }
  })

  it('is stable across imports', async () => {
    const again = (await import('@/lib/data/realRoster')).realRoster
    expect(again[0].id).toBe(realRoster[0].id)
    expect(again.length).toBe(realRoster.length)
  })
})

describe('data quality catches bulk-stamped assignment dates', () => {
  it('flags a unit whose entire population shows implausibly low time in position', async () => {
    const { analyzeDataQuality } = await import('@/lib/talent/dataQuality')
    const { positions } = await import('@/lib/data/positions')
    const { realRoster } = await import('@/lib/data/realRoster')
    const r = analyzeDataQuality(positions, realRoster, new Map(), [], '2026-06-01')
    const flagged = r.issues.filter(i => i.category === 'Mass-refreshed dates')
    // 1-163 Infantry's dates were reset in the source system.
    expect(flagged.length).toBeGreaterThan(0)
    expect(flagged.some(i => i.entityId.startsWith('WTCP'))).toBe(true)
  })

  it('does not flag units with a genuine spread', async () => {
    const { analyzeDataQuality } = await import('@/lib/talent/dataQuality')
    const { positions } = await import('@/lib/data/positions')
    const { realRoster } = await import('@/lib/data/realRoster')
    const r = analyzeDataQuality(positions, realRoster, new Map(), [], '2026-06-01')
    const flagged = new Set(r.issues.filter(i => i.category === 'Mass-refreshed dates').map(i => i.entityId))
    expect(flagged.has('WPLUAA')).toBe(false)   // 190th — real distribution
  })
})
