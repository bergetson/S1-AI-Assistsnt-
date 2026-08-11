'use client'

import { memo, useMemo, useState } from 'react'
import type { OrgNode, OrgTree } from '@/lib/orgChart/types'
import { walk } from '@/lib/orgChart/build'
import { cn } from '@/lib/utils'

// The fast path. The canvas is for seeing shape; this is for reaching a named
// unit in two keystrokes without hunting across a 12,000px row.

interface RowProps {
  node: OrgNode
  depth: number
  expanded: Set<string>
  selectedId?: string | null
  onToggle: (id: string) => void
  onSelect: (n: OrgNode) => void
}

// Hoisted: a component defined inside render is a new type on every keystroke,
// which remounts the rows and drops focus from the search box.
const Row = memo(function Row({
  node, depth, expanded, selectedId, onToggle, onSelect,
}: RowProps) {
  const open = expanded.has(node.id)
  const hasKids = node.children.length > 0
  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 rounded text-[12px] hover:bg-gray-100',
          selectedId === node.id && 'bg-green-50 ring-1 ring-green-700',
        )}
        style={{ paddingLeft: depth * 11 }}
      >
        <button
          onClick={() => hasKids && onToggle(node.id)}
          className={cn('w-4 flex-shrink-0 text-gray-400', !hasKids && 'invisible')}
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={hasKids ? open : undefined}
        >
          {open ? '▾' : '▸'}
        </button>
        <button
          onClick={() => onSelect(node)}
          className="flex-1 min-w-0 text-left py-1 flex items-baseline gap-1.5"
        >
          <span className="truncate text-gray-800">{node.label}</span>
          <span className="ml-auto flex-shrink-0 text-[10.5px] tabular-nums text-gray-500">
            {node.assigned}/{node.authorized || '—'}
          </span>
        </button>
      </div>
      {open && node.children.map(c => (
        <Row key={c.id} node={c} depth={depth + 1} expanded={expanded}
          selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </>
  )
})

export function OrgSidebar({
  tree, expanded, selectedId, onToggle, onSelect, onReveal,
}: {
  tree: OrgTree
  expanded: Set<string>
  selectedId?: string | null
  onToggle: (id: string) => void
  onSelect: (n: OrgNode) => void
  /** Expand every ancestor and centre the canvas on this node. */
  onReveal: (n: OrgNode) => void
}) {
  const [q, setQ] = useState('')

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle.length < 2) return null
    const out: OrgNode[] = []
    walk(tree.root, n => {
      if (out.length >= 40) return
      if (n.label.toLowerCase().includes(needle) ||
          n.uic?.toLowerCase().includes(needle) ||
          n.city?.toLowerCase().includes(needle)) out.push(n)
    })
    return out
  }, [q, tree])

  return (
    <aside className="w-72 flex-shrink-0 border-r bg-white flex flex-col">
      <div className="p-3 border-b">
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Find a unit, UIC, or town…"
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {matches ? (
          matches.length === 0 ? (
            <p className="text-xs text-gray-500 p-2">Nothing matches “{q}”.</p>
          ) : (
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-semibold text-gray-400 px-1 pb-1">
                {matches.length} match{matches.length === 1 ? '' : 'es'}
              </p>
              {matches.map(n => (
                <button
                  key={n.id}
                  onClick={() => onReveal(n)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-green-50 text-[12px]"
                >
                  <div className="font-medium text-gray-800 truncate">{n.label}</div>
                  <div className="text-[10.5px] text-gray-500 truncate">
                    {[n.uic, n.city, `${n.assigned}/${n.authorized || '—'}`].filter(Boolean).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <Row node={tree.root} depth={0} expanded={expanded}
            selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />
        )}
      </div>
    </aside>
  )
}
