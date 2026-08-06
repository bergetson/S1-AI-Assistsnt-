'use client'

import { useMemo, useState } from 'react'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import { useRulesStore } from '@/lib/rulesStore'
import { useForceData, BASE_YEAR } from '@/components/shared/useForceData'
import {
  rosterInFormation, computeManning, summarizeForce, projectAttrition, projectPromotions,
  buildUnitFamilies, vacantBillets, tipStaleYears,
} from '@/lib/forceAnalytics'
import {
  buildCommanderPrompt, buildRosterBlock, buildSeniorLeaderBlock, buildStagnationBlock,
} from '@/lib/commanderAI'
import { commissionedCap } from '@/lib/data/retention'
import { ForceChat } from '@/components/shared/ForceChat'
import { DataSourceBanner, PrototypeNotice } from '@/components/shared/Badges'
import { cn } from '@/lib/utils'

const ARMY_GREEN = '#1B4F2A'

/** How much of the roster to put in front of the model. */
type Depth = 'summary' | 'roster'

/**
 * The commander and G1 ask the same kinds of question of the same data; only
 * the scope differs. One component, two routes, so the two roles can never
 * drift into being briefed differently about the same force.
 */
export function ForceAsk({ scope }: { scope: 'formation' | 'state' }) {
  const { roster, sources } = useForceData()
  const { selectedUics, horizonYears, shareEvalBullets, setShareEvalBullets } = useCommandStore()
  const { reviews, overrides, version } = useRulesStore()
  const [depth, setDepth] = useState<Depth>('summary')

  // Statewide means every UIC that exists, not "no filter" — the analytics
  // functions treat an empty selection as an empty formation.
  const uics = useMemo(
    () => (scope === 'state'
      ? [...new Set(positions.map(p => p.uic).filter((u): u is string => Boolean(u)))]
      : selectedUics),
    [scope, selectedUics]
  )

  const people = useMemo(() => rosterInFormation(roster, uics), [roster, uics])

  const formationName = useMemo(() => {
    if (scope === 'state') return 'Montana Army National Guard (statewide)'
    const fams = buildUnitFamilies(positions, roster)
      .filter(f => f.uics.some(u => uics.includes(u)))
      .map(f => f.name)
    return fams.slice(0, 4).join(', ') || 'Selected formation'
  }, [scope, roster, uics])

  /* eslint-disable react-hooks/exhaustive-deps */
  // version is load-bearing: retuning a gate mutates the analytics tables in
  // place, which React cannot observe.
  const systemPrompt = useMemo(() => {
    if (uics.length === 0) return ''
    const base = buildCommanderPrompt({
      formationName,
      summary: summarizeForce(positions, roster, uics),
      manning: computeManning(positions, roster, uics),
      attrition: projectAttrition(people, BASE_YEAR, horizonYears),
      promotions: projectPromotions(positions, roster, uics, BASE_YEAR, horizonYears),
      baseYear: BASE_YEAR,
      horizonYears,
      sources: sources.military,
      reviews,
      overrides,
    })
    // A ten-year window regardless of the dashboard horizon: officer removal
    // dates are the one thing in this data that reaches that far reliably.
    const senior = buildSeniorLeaderBlock(people, BASE_YEAR, 10)
    const stagnation = buildStagnationBlock(people, tipStaleYears())
    const detail = depth === 'roster' ? buildRosterBlock(people, shareEvalBullets, 120) : ''
    return base + senior + stagnation + detail
  }, [formationName, roster, uics, people, horizonYears, sources, reviews, overrides, version, depth, shareEvalBullets])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Suggestions are generated from what this formation actually shows, so they
  // never invite a question the data cannot answer.
  const suggestions = useMemo(() => {
    const out: string[] = []
    const summary = uics.length ? summarizeForce(positions, roster, uics) : null
    const seniorDepart = people.filter(s => {
      const cap = commissionedCap(s.rank)
      return cap && s.commissionedYears > 0 &&
        BASE_YEAR + Math.ceil(cap.years - s.commissionedYears) <= BASE_YEAR + 10
    })
    const certain = seniorDepart.filter(s => ['O5', 'O6'].includes(s.rank))
    if (certain.length > 0) {
      out.push(`${certain.length} O5/O6 reach mandatory removal within 10 years. Walk me through the succession risk grade by grade.`)
    }
    const stale = people.filter(s => s.timeInGrade >= 6)
    if (stale.length > 0) {
      out.push(`${stale.length} soldiers are at 6+ years in grade. Which of those is a stalled career versus no vacancy above them?`)
    }
    const vac = vacantBillets(positions, roster, uics).filter(p => p.isCommandOrKD)
    if (vac.length > 0) {
      out.push(`${vac.length} command or key-developmental billets are unfilled. Which should I fill first and why?`)
    }
    if (summary && summary.serviceDatesKnown < summary.assigned) {
      out.push('What can you not tell me because of missing data, and what would change if we loaded PEBD?')
    }
    out.push('Which MOS or branch has the thinnest bench relative to the billets it has to fill?')
    out.push(
      scope === 'state'
        ? 'Where is full-time support concentrated, and does that match where the readiness burden falls?'
        : 'If I lose my most senior NCO tomorrow, who realistically replaces them and what does that cost me elsewhere?'
    )
    return out
  }, [people, roster, uics, scope])

  const noFormation = uics.length === 0

  return (
    <div className="px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: ARMY_GREEN }}>
            {scope === 'state' ? 'Ask the State Force Picture' : 'Ask About My Formation'}
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            A conversation with the same numbers the dashboards show. Every figure the model sees is
            computed locally first — it explains and challenges the analysis, it does not produce it.
            Where the data cannot answer, it is told to say so rather than estimate.
          </p>
        </div>

        <DataSourceBanner sources={sources.military} positionCount={positions.length} />

        {noFormation ? (
          <div className="rounded-xl border border-gray-300 bg-white p-8 text-center">
            <p className="text-gray-600">Select a formation first — the conversation is scoped to it.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap gap-6 items-center">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Scope</div>
                <div className="text-sm text-gray-800">
                  {formationName} · <strong>{people.length}</strong> soldiers
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Detail sent</div>
                <div className="flex gap-1">
                  {([['summary', 'Aggregates only'], ['roster', 'Include roster detail']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setDepth(k)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border',
                        depth === k
                          ? 'border-green-700 bg-green-50 text-green-900'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                  Roster detail lets it reason about individuals, as pseudonyms. It also sends far more data.
                </p>
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-700 max-w-xs">
                <input type="checkbox" checked={shareEvalBullets}
                  onChange={e => setShareEvalBullets(e.target.checked)} className="mt-0.5" />
                <span>
                  Include evaluation narrative. Off by default — bullets are free text and can carry
                  more than you intend.
                </span>
              </label>
            </div>

            <ForceChat
              systemPrompt={systemPrompt}
              roster={people}
              suggestions={suggestions}
              scopeLabel={scope === 'state' ? 'the state force' : 'this formation'}
              emptyHint="Start with one of the questions below, or ask your own. Follow-ups keep the thread."
            />
          </>
        )}

        <PrototypeNotice scope="This conversation" />
      </div>
    </div>
  )
}
