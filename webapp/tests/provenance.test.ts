import { describe, it, expect } from 'vitest'
import { soldier, position } from './fixtures'
import {
  BILLET_SOURCE, BASELINE_ROSTER_SOURCE, IMPORTED_ROSTER_SOURCE, CIVILIAN_SOURCE,
  rosterSource, isDemoFidelity, exportBanner, FIDELITY_LABEL,
} from '@/lib/dataSources'
import { AS_OF_ISO, AS_OF_YEAR, asOfDate } from '@/lib/asOf'
import { summarizeForce, computeManning, boardEligibility } from '@/lib/forceAnalytics'
import { buildCommanderPrompt, anonymizeSoldier, buildNameMap, rehydrateNames } from '@/lib/commanderAI'
import { importRosterCsv, yearsSince } from '@/lib/rosterImport'

// These tests exist because every bug they cover actually shipped. The theme is
// one rule: a number that is absent from the source must never be rendered as a
// number, to a commander or to a model. Zero is an answer; missing is not.

describe('the planning epoch', () => {
  it('derives the year from the same string the filters use', () => {
    // Two constants that can drift are a bug waiting to happen: the commander
    // view counted from 2026 while the planner counted from new Date().
    expect(AS_OF_YEAR).toBe(Number(AS_OF_ISO.slice(0, 4)))
  })

  it('hands out a fresh Date so a caller mutating it cannot corrupt the next', () => {
    const a = asOfDate()
    a.setFullYear(1999)
    expect(asOfDate().getFullYear()).toBe(AS_OF_YEAR)
  })

  it('is a fixed instant, not wall-clock time', () => {
    // A static export bakes module-scope dates into prerendered HTML. If this
    // ever tracks "now" the page will disagree with itself after hydration.
    expect(asOfDate().toISOString().slice(0, 10)).toBe(AS_OF_ISO)
  })
})

describe('data source model', () => {
  it('marks only generated data as demo', () => {
    expect(isDemoFidelity(CIVILIAN_SOURCE.fidelity)).toBe(true)
    for (const s of [BILLET_SOURCE, BASELINE_ROSTER_SOURCE, IMPORTED_ROSTER_SOURCE]) {
      expect(isDemoFidelity(s.fidelity)).toBe(false)
    }
  })

  it('never labels the de-identified real roster as demo', () => {
    // The regression: one screen told the AI the real force was synthetic.
    const s = rosterSource(false)
    expect(s).toBe(BASELINE_ROSTER_SOURCE)
    expect(FIDELITY_LABEL[s.fidelity]).not.toMatch(/demo/i)
  })

  it('switches to the imported source once a commander loads their own file', () => {
    expect(rosterSource(true)).toBe(IMPORTED_ROSTER_SOURCE)
  })

  it('states the roster is missing the service clocks', () => {
    const missing = (BASELINE_ROSTER_SOURCE.missingFields ?? []).join(' ')
    expect(missing).toMatch(/date of rank/i)
    expect(missing).toMatch(/PEBD/i)
  })

  it('does not claim names are withheld from a roster the user imported', () => {
    expect(BASELINE_ROSTER_SOURCE.statement).toMatch(/withheld/i)
    expect(IMPORTED_ROSTER_SOURCE.statement).not.toMatch(/withheld/i)
  })

  it('names both the real and the synthetic parts in an export banner', () => {
    const b = exportBanner([BILLET_SOURCE, BASELINE_ROSTER_SOURCE, CIVILIAN_SOURCE])
    expect(b).toMatch(/REAL:/)
    expect(b).toMatch(/DEMO\/SYNTHETIC:/)
    expect(b).toMatch(/civilian capability/i)
    // A file that leaves the app must still disclaim authority.
    expect(b).toMatch(/not assignment authority/i)
  })

  it('omits the demo half when nothing on the screen is generated', () => {
    const b = exportBanner([BILLET_SOURCE, BASELINE_ROSTER_SOURCE])
    expect(b).not.toMatch(/DEMO/)
  })
})

describe('summarizeForce distinguishes absent clocks from zero', () => {
  const uics = ['WTCPT0']
  const billets = [position({ id: 1 }), position({ id: 2 })]

  it('counts how many records carry a date of rank', () => {
    const people = [
      soldier({ uic: 'WTCPT0', yearsOfService: 0, timeInGrade: 0 }),
      soldier({ uic: 'WTCPT0', yearsOfService: 0, timeInGrade: 0 }),
      soldier({ uic: 'WTCPT0', yearsOfService: 12, timeInGrade: 4 }),
    ]
    expect(summarizeForce(billets, people, uics).serviceDatesKnown).toBe(1)
  })

  it('reports zero known when the whole extract lacks PEBD and DOR', () => {
    const people = [
      soldier({ uic: 'WTCPT0', yearsOfService: 0, timeInGrade: 0 }),
      soldier({ uic: 'WTCPT0', yearsOfService: 0, timeInGrade: 0 }),
    ]
    const s = summarizeForce(billets, people, uics)
    expect(s.serviceDatesKnown).toBe(0)
    expect(s.boardEligible).toBe(0)
    expect(s.retirementEligible).toBe(0)
  })

  it('averages time in grade over the records that have it, not the whole formation', () => {
    // Dividing by everyone drags the mean toward zero in proportion to how much
    // data is missing, which reads as "this unit is junior" rather than
    // "we don't know".
    const people = [
      soldier({ uic: 'WTCPT0', yearsOfService: 0, timeInGrade: 0 }),
      soldier({ uic: 'WTCPT0', yearsOfService: 0, timeInGrade: 0 }),
      soldier({ uic: 'WTCPT0', yearsOfService: 12, timeInGrade: 4 }),
    ]
    expect(summarizeForce(billets, people, uics).avgTig).toBe(4)
  })

  it('still excludes unauthorized over-strength lines from the authorized count', () => {
    const mixed = [position({ id: 1 }), position({ id: 2, authorized: false })]
    const people = [soldier({ uic: 'WTCPT0' }), soldier({ uic: 'WTCPT0' })]
    const s = summarizeForce(mixed, people, uics)
    expect(s.authorized).toBe(1)
    expect(s.assigned).toBe(2)   // over-strength must surface, not be hidden
    expect(computeManning(mixed, people, uics).byGrade.length).toBeGreaterThan(0)
  })
})

describe('what the commander prompt is allowed to assert', () => {
  const uics = ['WTCPT0']
  const billets = [position({ id: 1 }), position({ id: 2 })]

  function promptFor(people: ReturnType<typeof soldier>[]) {
    return buildCommanderPrompt({
      formationName: 'Test BN',
      summary: summarizeForce(billets, people, uics),
      manning: computeManning(billets, people, uics),
      attrition: [],
      promotions: [],
      baseYear: AS_OF_YEAR,
      horizonYears: 3,
      sources: [BILLET_SOURCE, BASELINE_ROSTER_SOURCE],
    })
  }

  const noDates = [
    soldier({ uic: 'WTCPT0', rank: 'W5', yearsOfService: 0, timeInGrade: 0 }),
    soldier({ uic: 'WTCPT0', rank: 'E7', yearsOfService: 0, timeInGrade: 0 }),
  ]

  it('says UNKNOWN rather than 0 when no service clocks exist', () => {
    // The shipped bug: the model was told "Board-eligible now: 0" and then told
    // not to invent numbers, locking it into advising that the bench is empty.
    const p = promptFor(noDates)
    expect(p).toMatch(/Board-eligible now: UNKNOWN/)
    expect(p).toMatch(/Average TIG: UNKNOWN/)
    expect(p).toMatch(/Retirement eligible \(20\+ yr\): UNKNOWN/)
    expect(p).not.toMatch(/Board-eligible now: 0\b/)
    expect(p).not.toMatch(/Average TIG 0 yr/)
  })

  it('tells the model explicitly not to read the absence as zero', () => {
    const p = promptFor(noDates)
    expect(p).toMatch(/do NOT report these as zero/i)
    expect(p).toMatch(/no PEBD and no date of rank/i)
  })

  it('reports real numbers, marked as lower bounds, on a partially dated roster', () => {
    const p = promptFor([
      ...noDates,
      soldier({ uic: 'WTCPT0', rank: 'E6', yearsOfService: 14, timeInGrade: 5 }),
    ])
    expect(p).toMatch(/Average TIG 5 yr/)
    expect(p).toMatch(/lower bounds/i)
    expect(p).toMatch(/2 are unknown/)
  })

  it('reports plain numbers when every record is dated', () => {
    const p = promptFor([
      soldier({ uic: 'WTCPT0', yearsOfService: 14, timeInGrade: 5 }),
      soldier({ uic: 'WTCPT0', yearsOfService: 10, timeInGrade: 3 }),
    ])
    expect(p).toMatch(/Average TIG 4 yr/)
    expect(p).not.toMatch(/UNKNOWN/)
    expect(p).not.toMatch(/lower bounds/i)
  })

  it('describes each dataset it was given as real or generated', () => {
    const p = promptFor(noDates)
    expect(p).toMatch(/DATA FIDELITY/)
    expect(p).toMatch(/Force structure: REAL/)
    expect(p).toMatch(/Roster: REAL/)
    expect(p).not.toMatch(/GENERATED FOR DEMONSTRATION/)
  })

  it('calls generated data generated', () => {
    const p = buildCommanderPrompt({
      formationName: 'Test BN',
      summary: summarizeForce(billets, noDates, uics),
      manning: computeManning(billets, noDates, uics),
      attrition: [], promotions: [], baseYear: AS_OF_YEAR, horizonYears: 3,
      sources: [CIVILIAN_SOURCE],
    })
    expect(p).toMatch(/Civilian capability: GENERATED FOR DEMONSTRATION/)
  })
})

describe('the anonymization boundary', () => {
  it('never emits a name', () => {
    const s = soldier({ lastName: 'Rodriguez', firstName: 'Maria', anonId: 'S-042' })
    const line = anonymizeSoldier(s, true)
    expect(line).not.toMatch(/Rodriguez/)
    expect(line).not.toMatch(/Maria/)
    expect(line).toMatch(/^S-042:/)
  })

  it('withholds eval bullets unless explicitly opted in', () => {
    const s = soldier({ evalBullets: 'Selected for a sensitive assignment' })
    expect(anonymizeSoldier(s, false)).not.toMatch(/sensitive assignment/)
    expect(anonymizeSoldier(s, true)).toMatch(/sensitive assignment/)
  })

  it('writes unknown, not 0, for a soldier with no service clocks', () => {
    const s = soldier({ rank: 'W5', yearsOfService: 0, timeInGrade: 0, timeInPosition: 0.5 })
    const line = anonymizeSoldier(s, false)
    expect(line).toMatch(/TIS unknown/)
    expect(line).toMatch(/TIG unknown/)
    expect(line).not.toMatch(/0yr TIS/)
    expect(line).not.toMatch(/0yr TIG/)
  })

  it('still writes real clocks when they are present', () => {
    const line = anonymizeSoldier(soldier({ yearsOfService: 14, timeInGrade: 5 }), false)
    expect(line).toMatch(/14yr TIS/)
    expect(line).toMatch(/5yr TIG/)
  })

  it('maps pseudonyms back to names only in the browser', () => {
    const s = soldier({ lastName: 'Rodriguez', firstName: 'Maria', anonId: 'S-042' })
    const out = rehydrateNames('Recommend S-042 for the billet.', buildNameMap([s]))
    expect(out).toBe('Recommend Rodriguez, Maria (S-042) for the billet.')
  })

  it('leaves an unrecognized pseudonym untouched rather than guessing', () => {
    const out = rehydrateNames('Recommend S-999.', buildNameMap([soldier({ anonId: 'S-042' })]))
    expect(out).toBe('Recommend S-999.')
  })
})

describe('roster import derives the service clocks from dates', () => {
  // The reason this matters: personnel systems export PEBD and DOR as dates.
  // Before this, only precomputed decimal columns were read, so a straight
  // extract imported as TIS 0 / TIG 0 for every soldier and the whole app
  // correctly — but uselessly — reported the formation as Unknown.
  const head = 'last_name,rank,uic,mos,pebd,dor,ets'

  it('computes time in service and time in grade from PEBD and DOR', () => {
    const r = importRosterCsv(`${head}\nDoe,SSG,WTCPT0,92Y,2016-06-01,2023-06-01,2028-01-01`)
    expect(r.errors).toEqual([])
    expect(r.soldiers[0].yearsOfService).toBe(10)
    expect(r.soldiers[0].timeInGrade).toBe(3)
  })

  it('accepts the date formats personnel exports actually emit', () => {
    for (const d of ['2016-06-01', '06/01/2016', '01-JUN-2016']) {
      expect(yearsSince(d)).toBe(10)
    }
  })

  it('leaves the clock Unknown rather than guessing when the date is unreadable', () => {
    expect(yearsSince('not a date')).toBeNull()
    expect(yearsSince('')).toBeNull()
    expect(yearsSince(undefined)).toBeNull()
  })

  it('rejects a future date and an implausible career length as bad data', () => {
    expect(yearsSince('2099-01-01')).toBeNull()
    expect(yearsSince('1940-01-01')).toBeNull()
  })

  it('warns, and stays Unknown, when a date column is present but unparseable', () => {
    const r = importRosterCsv(`${head}\nDoe,SSG,WTCPT0,92Y,garbage,garbage,2028-01-01`)
    expect(r.soldiers[0].yearsOfService).toBe(0)
    expect(r.soldiers[0].timeInGrade).toBe(0)
    expect(r.warnings.some(w => /PEBD/.test(w.message))).toBe(true)
    expect(r.warnings.some(w => /date of rank/.test(w.message))).toBe(true)
  })

  it('lets an explicit decimal column win over the derived date', () => {
    const r = importRosterCsv(
      `last_name,rank,uic,pebd,dor,tis,tig\nDoe,SSG,WTCPT0,2016-06-01,2023-06-01,14.5,5.5`)
    expect(r.soldiers[0].yearsOfService).toBe(14.5)
    expect(r.soldiers[0].timeInGrade).toBe(5.5)
  })

  it('still imports with neither, leaving the clocks Unknown', () => {
    const r = importRosterCsv(`last_name,rank,uic\nDoe,SSG,WTCPT0`)
    expect(r.errors).toEqual([])
    expect(r.soldiers[0].yearsOfService).toBe(0)
    expect(r.soldiers[0].timeInGrade).toBe(0)
  })

  it('measures against the extract date, not wall-clock time', () => {
    // Same guarantee as the epoch tests: this result must not change tomorrow.
    expect(yearsSince('2020-06-01')).toBe(6)
  })
})

describe('eligibility never turns an unknown clock into a verdict', () => {
  // Regression: when date of rank arrived but PEBD had not, a soldier who
  // cleared the TIG gate was failed on the TIS gate and reported "Not
  // Eligible" — a confident answer derived from a value nobody recorded.
  const s = (o: Parameters<typeof soldier>[0]) => soldier({ rank: 'E6', ...o })

  it('says Unknown when time in grade clears but time in service is absent', () => {
    expect(boardEligibility(s({ timeInGrade: 9, yearsOfService: 0 }))).toBe('Unknown')
  })

  it('still says Not Eligible when time in grade alone disqualifies', () => {
    // No PEBD needed: falling short of the TIG gate settles it on its own.
    expect(boardEligibility(s({ timeInGrade: 0.2, yearsOfService: 0 }))).toBe('Not Eligible')
  })

  it('says Unknown when neither clock is on file', () => {
    expect(boardEligibility(s({ timeInGrade: 0, yearsOfService: 0 }))).toBe('Unknown')
  })

  it('answers properly once both clocks are present', () => {
    expect(boardEligibility(s({ timeInGrade: 9, yearsOfService: 14 }))).toBe('Eligible')
    expect(boardEligibility(s({ timeInGrade: 9, yearsOfService: 2 }))).toBe('Not Eligible')
  })
})
