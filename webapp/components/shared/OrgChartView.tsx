'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Position } from '@/lib/types'
import type { OrgNode } from '@/lib/orgChart/types'
import { buildOrgTree, pathTo } from '@/lib/orgChart/build'
import { layoutTree, defaultExpanded, ancestorsOf, NODE_W } from '@/lib/orgChart/layout'
import {
  buildOverlayContext, nodeMetric, OVERLAYS, UNIT_TYPE_COLOR, rampColor,
  type OverlayMetric,
} from '@/lib/orgChart/overlays'
import { mosCountsByNode, mosOptions, EMPTY_MOS_COUNT } from '@/lib/orgChart/mos'
import { useForceData, BASE_YEAR } from '@/components/shared/useForceData'
import { useRulesStore } from '@/lib/rulesStore'
import { useProfileStore } from '@/lib/store'
import { usePlannerStore } from '@/lib/plannerStore'
import { OrgCanvas } from '@/components/orgchart/OrgCanvas'
import { OrgNodeCard } from '@/components/orgchart/OrgNodeCard'
import { OrgSidebar } from '@/components/orgchart/OrgSidebar'
import { OrgDetailPanel, type DetailTarget } from '@/components/orgchart/OrgDetailPanel'
import { TileLegend } from '@/components/orgchart/BilletTiles'
import { DataSourceBanner, PrototypeNotice } from '@/components/shared/Badges'

const ARMY_GREEN = '#1B4F2A'

/**
 * One component behind three routes, so the commander, the G1, and the soldier
 * can never end up looking at differently-shaped versions of the same force.
 * Mode changes what a billet click answers and what gets highlighted, not the
 * structure itself.
 */
export function OrgChartView({ mode }: { mode: 'manager' | 'soldier' }) {
  const { positions, roster, sources } = useForceData()
  const rulesVersion = useRulesStore(s => s.version)
  const { profile, profileComplete } = useProfileStore()
  const { phasePicks } = usePlannerStore()

  const [rootId, setRootId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string> | null>(null)
  const [metric, setMetric] = useState<OverlayMetric>('unitType')
  const [selectedMos, setSelectedMos] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [showTiles, setShowTiles] = useState(true)

  const tree = useMemo(() => buildOrgTree(positions, roster), [positions, roster])

  // The visible root — re-rooting is how a big formation opens without a
  // 12,000px row, matching the published chart's "Click to Cont.".
  const viewRoot = (rootId && tree.byId.get(rootId)) || tree.root
  const openSet = expanded ?? defaultExpanded(viewRoot)

  const byId = tree.byId
  const positionById = useMemo(() => {
    const m = new Map<number, Position>()
    for (const p of positions) m.set(p.id, p)
    return m
  }, [positions])

  const occupied = useMemo(() => {
    const s = new Set<number>()
    for (const r of roster) if (r.positionId != null) s.add(r.positionId)
    return s
  }, [roster])

  /* eslint-disable react-hooks/exhaustive-deps */
  // rulesVersion is load-bearing: retuning mutates the analytics tables in
  // place, which React cannot observe.
  const overlayCtx = useMemo(
    () => buildOverlayContext(roster, BASE_YEAR), [roster, rulesVersion])
  /* eslint-enable react-hooks/exhaustive-deps */

  const mosCounts = useMemo(
    () => (selectedMos ? mosCountsByNode(tree.root, roster, selectedMos) : null),
    [selectedMos, tree, roster])

  const mosList = useMemo(() => mosOptions(tree.root).slice(0, 40), [tree])

  // Soldier mode: the units holding a billet on their own career plan.
  // Single return path — an early `return` inside a useMemo defeats the React
  // Compiler's memoization analysis.
  // Gated on profileComplete, not merely on `mos` being set: the store seeds a
  // default profile that already carries an MOS, so keying off the field alone
  // rings a unit for every soldier who has never filled anything in — which
  // makes the highlight meaningless rather than helpful.
  const myMos = profileComplete ? (profile?.mos ?? '') : ''
  const plannedUnits = useMemo(() => {
    const uics = new Set<string>()
    if (mode === 'soldier') {
      for (const pick of Object.values(phasePicks).flat()) {
        const p = pick.positionId == null ? undefined : positionById.get(pick.positionId)
        if (p?.uic) uics.add(p.uic)
      }
      // No plan yet, but a real profile — fall back to where their own MOS
      // lives. Still a useful answer, and it does not leave the page blank.
      if (uics.size === 0 && myMos) {
        for (const p of positions) if (p.mos === myMos && p.uic) uics.add(p.uic)
      }
    }
    return uics
  }, [mode, phasePicks, positionById, myMos, positions])

  const layout = useMemo(
    () => layoutTree(viewRoot, openSet, { tilesFor: n => showTiles && n.billets.length > 0 }),
    [viewRoot, openSet, showTiles])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev ?? defaultExpanded(viewRoot))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [viewRoot])

  const openAsRoot = useCallback((id: string) => {
    setRootId(id)
    const n = byId.get(id)
    setExpanded(n ? defaultExpanded(n) : null)
    setFocusId(null)
  }, [byId])

  const reveal = useCallback((n: OrgNode) => {
    const inCurrent = pathTo(tree, n.id).some(a => a.id === viewRoot.id)
    if (!inCurrent) setRootId(null)
    setExpanded(prev => {
      const next = new Set(prev ?? defaultExpanded(viewRoot))
      for (const a of ancestorsOf(inCurrent ? viewRoot : tree.root, n.id)) next.add(a)
      return next
    })
    setFocusId(n.id)
  }, [tree, viewRoot])

  const nodeCenter = useCallback((id: string) => {
    const p = layout.nodes.find(n => n.node.id === id)
    return p ? { x: p.x + NODE_W / 2, y: p.y } : null
  }, [layout])

  const crumbs = rootId ? pathTo(tree, rootId) : [tree.root]

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold" style={{ color: ARMY_GREEN }}>
              {mode === 'soldier' ? 'Force Structure' : 'Organization Chart'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">
              {mode === 'soldier'
                ? 'The whole Montana Army National Guard, from JFHQ to the individual billet. Units holding a job on your career plan are ringed in gold.'
                : 'Every unit and every billet, live against real manning. Click a billet to see who could fill it, or a MOS to light up every unit that holds one.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={showTiles} onChange={e => setShowTiles(e.target.checked)} />
              Billet mosaic
            </label>
            {mode === 'manager' && (
              <select
                value={metric}
                onChange={e => setMetric(e.target.value as OverlayMetric)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                aria-label="Colour by"
              >
                {OVERLAYS.map(o => <option key={o.id} value={o.id}>Colour: {o.label}</option>)}
              </select>
            )}
            <select
              value={selectedMos ?? ''}
              onChange={e => setSelectedMos(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white"
              aria-label="Highlight an MOS"
            >
              <option value="">Highlight an MOS…</option>
              {mosList.map(m => (
                <option key={m.mos} value={m.mos}>{m.mos} — {m.total} billets, {m.units} units</option>
              ))}
            </select>
            {selectedMos && (
              <button onClick={() => setSelectedMos(null)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-green-800 text-white font-medium">
                Clear {selectedMos} ✕
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb — only meaningful once you have drilled in. */}
        {rootId && (
          <nav className="flex items-center gap-1 mt-2 text-xs" aria-label="Breadcrumb">
            <button onClick={() => { setRootId(null); setExpanded(null) }}
              className="text-green-800 hover:underline font-medium">
              {tree.root.label}
            </button>
            {crumbs.slice(1).map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                <span className="text-gray-400">›</span>
                {i === crumbs.length - 2 ? (
                  <span className="text-gray-700 font-semibold">{c.label}</span>
                ) : (
                  <button onClick={() => openAsRoot(c.id)} className="text-green-800 hover:underline">
                    {c.label}
                  </button>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        <OrgSidebar
          tree={tree}
          expanded={openSet}
          selectedId={detail?.node.id ?? null}
          onToggle={toggle}
          onSelect={n => setDetail({ node: n })}
          onReveal={reveal}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <OrgCanvas layout={layout} className="flex-1" focusId={focusId}
            nodeCenter={nodeCenter} resetKey={viewRoot.id}>
            {layout.nodes.map(placed => {
              const n = placed.node
              const count = mosCounts?.get(n.id) ?? EMPTY_MOS_COUNT
              return (
                <div key={n.id} data-node-card>
                  <OrgNodeCard
                    placed={placed}
                    metric={mode === 'soldier' ? 'unitType' : metric}
                    result={nodeMetric(n, mode === 'soldier' ? 'unitType' : metric, overlayCtx)}
                    mosCount={mosCounts ? count : undefined}
                    dimmed={Boolean(mosCounts) && count.total === 0}
                    selected={detail?.node.id === n.id}
                    onPlan={mode === 'soldier' && n.uics.some(u => plannedUnits.has(u))}
                    tiles={showTiles && n.billets.length
                      ? n.billets.map(b => ({ position: b, filled: occupied.has(b.id) }))
                      : undefined}
                    highlightMos={selectedMos}
                    onToggle={toggle}
                    onOpen={openAsRoot}
                    onSelect={node => setDetail({ node })}
                    onPickBillet={id => {
                      const p = positionById.get(id)
                      if (p) setDetail({ node: n, billet: p })
                    }}
                  />
                </div>
              )
            })}
          </OrgCanvas>

          {/* Legend */}
          <div className="px-5 py-2 bg-white border-t flex items-center gap-5 flex-wrap text-[11px] text-gray-600 flex-shrink-0">
            {(mode === 'manager' ? metric : 'unitType') === 'unitType' ? (
              <div className="flex items-center gap-3">
                {(Object.entries(UNIT_TYPE_COLOR) as [keyof typeof UNIT_TYPE_COLOR, { ring: string }][])
                  .map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1.5 capitalize">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: v.ring }} />{k}
                    </span>
                  ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{OVERLAYS.find(o => o.id === metric)?.hint}</span>
                <span className="flex items-center gap-0.5">
                  {[0, 0.25, 0.5, 0.75, 1].map(t => (
                    <span key={t} className="w-5 h-3" style={{ backgroundColor: rampColor(t) }} />
                  ))}
                </span>
              </div>
            )}
            {showTiles && <TileLegend />}
            <span className="flex items-center gap-1.5">
              <svg width="26" height="8" aria-hidden>
                <line x1="0" y1="4" x2="26" y2="4" stroke="#B9A375" strokeWidth="1.5" strokeDasharray="5 4" />
              </svg>
              command relationship from the published chart, not the MTOE extract
            </span>
          </div>
        </div>
      </div>

      {/* Provenance and soldier prompts sit below the fold, out of the way. */}
      <div className="px-6 py-3 bg-white border-t flex-shrink-0 space-y-2">
        {mode === 'soldier' && !profileComplete && (
          <p className="text-xs text-gray-600">
            <Link href="/profile" className="text-green-800 underline font-medium">Build your profile</Link>
            {' '}and{' '}
            <Link href="/planner" className="text-green-800 underline font-medium">map a plan</Link>
            {' '}to see where the jobs on your path physically exist and whether you qualify today.
          </p>
        )}
        <DataSourceBanner sources={sources.military} positionCount={positions.length} />
        <PrototypeNotice scope="This chart" />
      </div>

      <OrgDetailPanel
        target={detail}
        roster={roster}
        mode={mode}
        profile={profileComplete ? profile : null}
        onClose={() => setDetail(null)}
        onPickMos={m => { setSelectedMos(m); setDetail(null) }}
        onPickBillet={p => setDetail(d => (d ? { ...d, billet: p } : null))}
      />
    </div>
  )
}
