'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useForceData, AS_OF, BASE_YEAR } from '@/components/shared/useForceData'
import { useMarketplaceStore } from '@/lib/marketplaceStore'
import { isBoardEligible, isStaleInPosition, vacantBillets, earliestDeparture, hasServiceDates } from '@/lib/forceAnalytics'
import { mosGaps, promotionPipeline } from '@/lib/talent/statewideAnalytics'
import { analyzeDataQuality } from '@/lib/talent/dataQuality'
import { isCredentialExpired, isCredentialExpiringSoon } from '@/lib/civilian/types'
import { rulesNeedingReview } from '@/lib/rules/registry'
import { PrototypeNotice, DemoPill } from '@/components/shared/Badges'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'

function Tile({ label, value, href, tone = 'neutral', hint }: {
  label: string; value: number | string; href?: string
  tone?: 'neutral' | 'warn' | 'bad' | 'good'; hint?: string
}) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-600'
    : tone === 'good' ? 'text-green-700' : 'text-gray-900'
  const body = (
    <div className="bg-white rounded-lg px-4 py-3 shadow-sm border h-full hover:shadow-md transition">
      <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default function TalentDashboardPage() {
  const { positions, roster, civilianProfiles, isDemo } = useForceData()
  const { applications, cycles } = useMarketplaceStore()

  const allUics = useMemo(
    () => [...new Set(positions.map(p => p.uic).filter(Boolean) as string[])], [positions])

  const vacancies = useMemo(
    () => vacantBillets(positions, roster, allUics).filter(p => p.authorized !== false),
    [positions, roster, allUics])

  const criticalVacancies = vacancies.filter(v => v.isCommandOrKD)
  const boardEligible = roster.filter(isBoardEligible)
  // No DOR/PEBD anywhere means eligibility is unknown, not zero.
  const serviceDatesMissing = roster.length > 0 && !roster.some(hasServiceDates)
  const stale = roster.filter(isStaleInPosition)
  const projectedLosses = roster.filter(s => earliestDeparture(s, BASE_YEAR, 2) != null)

  const gaps = useMemo(() => mosGaps(positions, roster), [positions, roster])
  const shortages = gaps.filter(g => g.status === 'Shortage' && g.authorized >= 5)
  const overstrength = gaps.filter(g => g.status === 'Overstrength' && g.authorized >= 5)

  const pipeline = useMemo(() => promotionPipeline(positions, roster), [positions, roster])
  const thinPipelines = serviceDatesMissing
    ? []   // without service dates every transition would look Critical
    : pipeline.filter(p => p.status === 'Critical' || p.status === 'No Feeder')

  const dq = useMemo(
    () => analyzeDataQuality(positions, roster, civilianProfiles, applications, AS_OF),
    [positions, roster, civilianProfiles, applications])

  const credentialAlerts = useMemo(() => {
    let expired = 0, soon = 0
    for (const p of civilianProfiles.values()) {
      for (const c of p.credentials) {
        if (isCredentialExpired(c, AS_OF)) expired++
        else if (isCredentialExpiringSoon(c, AS_OF)) soon++
      }
    }
    return { expired, soon }
  }, [civilianProfiles])

  const pendingReview = applications.filter(a =>
    a.status === 'Commander Review' || a.status === 'Talent Manager Review').length
  const rulesToReview = rulesNeedingReview()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="text-2xl font-bold" style={{ color: GREEN }}>
            Talent Management Dashboard {isDemo && <DemoPill />}
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Statewide view for S1/G1 talent managers: where the vacancies are, who is eligible and
            interested, where the pipelines are thin, and where the data cannot yet support a decision.
          </p>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1400px] mx-auto space-y-6">

          <section>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Vacancies</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Open vacancies" value={vacancies.length} href="/talent/vacancies" />
              <Tile label="Critical / KD vacancies" value={criticalVacancies.length} tone="bad" href="/talent/vacancies" />
              <Tile label="Projected losses (2 yr)" value={projectedLosses.length} tone="warn" />
              <Tile label="Positions with no successor" value="See report" href="/command/succession" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">People</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Board eligible now" value={serviceDatesMissing ? 'Unknown' : boardEligible.length}
                tone={serviceDatesMissing ? 'neutral' : 'good'}
                hint={serviceDatesMissing ? 'needs DOR + PEBD' : undefined} />
              <Tile label="3+ years in position" value={stale.length} tone="warn" hint="Due to move" />
              <Tile label="Not MOS-qualified" value={roster.filter(s => s.flagged).length} tone="warn"
                hint="MOSQ status from the extract" />
              <Tile label="Total assigned" value={roster.length} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Marketplace</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Active cycles" value={cycles.filter(c => c.status === 'Open').length} href="/talent/marketplace" />
              <Tile label="Applications" value={applications.length} href="/talent/marketplace" />
              <Tile label="Pending review" value={pendingReview} tone={pendingReview > 0 ? 'warn' : 'neutral'} href="/talent/marketplace" />
              <Tile label="Selected" value={applications.filter(a => a.status === 'Selected').length} tone="good" href="/talent/marketplace" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Data and policy health</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Data errors" value={dq.counts.error} tone={dq.counts.error ? 'bad' : 'good'} href="/talent/data-quality" />
              <Tile label="Data warnings" value={dq.counts.warning} tone="warn" href="/talent/data-quality" />
              <Tile label="Expired credentials" value={credentialAlerts.expired} tone={credentialAlerts.expired ? 'bad' : 'good'} href="/talent/data-quality" />
              <Tile label="Rules needing review" value={rulesToReview.length} tone="warn" href="/talent/rules" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Civilian capability recorded for {dq.completeness.soldiersWithCivilianProfile} of{' '}
              {dq.completeness.soldiersTotal} soldiers ({dq.completeness.civilianCoveragePct}%).
              The rest are Unknown, not zero.
            </p>
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 text-sm mb-2">MOS shortages</h2>
              {shortages.length === 0 ? <p className="text-xs text-gray-400">No significant shortages.</p> : (
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b">
                    <tr><th className="text-left py-1">MOS</th><th className="text-right">Auth</th>
                      <th className="text-right">Asgn</th><th className="text-right">Fill</th></tr>
                  </thead>
                  <tbody>
                    {shortages.slice(0, 10).map(g => (
                      <tr key={g.mos} className="border-b border-gray-100">
                        <td className="py-1 font-mono font-semibold">{g.mos}</td>
                        <td className="text-right">{g.authorized}</td>
                        <td className="text-right">{g.assigned}</td>
                        <td className="text-right font-bold text-red-700">{g.fillPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 text-sm mb-2">Overstrength areas</h2>
              {overstrength.length === 0 ? <p className="text-xs text-gray-400">None.</p> : (
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b">
                    <tr><th className="text-left py-1">MOS</th><th className="text-right">Auth</th>
                      <th className="text-right">Asgn</th><th className="text-right">Fill</th></tr>
                  </thead>
                  <tbody>
                    {overstrength.slice(0, 10).map(g => (
                      <tr key={g.mos} className="border-b border-gray-100">
                        <td className="py-1 font-mono font-semibold">{g.mos}</td>
                        <td className="text-right">{g.authorized}</td>
                        <td className="text-right">{g.assigned}</td>
                        <td className="text-right font-bold text-amber-600">{g.fillPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {thinPipelines.length > 0 && (
            <section className="bg-white rounded-xl border-l-4 border-red-500 border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">Promotion pipeline risk</h2>
              <p className="text-sm text-gray-500 mb-3">
                Grade transitions where the feeder pool cannot cover the open billets.
              </p>
              <div className="flex flex-wrap gap-2">
                {thinPipelines.slice(0, 12).map(p => (
                  <span key={`${p.careerCategory}-${p.fromGrade}-${p.toGrade}`}
                    className="text-xs px-2 py-1 rounded bg-red-50 border border-red-200 text-red-900">
                    <strong>{p.fromGrade}→{p.toGrade}</strong> · {p.openAtTarget} open ·{' '}
                    {p.eligibleNow} eligible · {p.status}
                  </span>
                ))}
              </div>
            </section>
          )}

          <PrototypeNotice />
        </div>
      </div>
    </div>
  )
}
