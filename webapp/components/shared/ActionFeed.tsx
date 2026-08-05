'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ActionItem, Severity, Urgency } from '@/lib/actions/types'
import { cn } from '@/lib/utils'

// Answer-first list. The headline is the finding; supporting evidence is behind
// a disclosure so the page stays scannable. Nothing here is a chart for its own
// sake — every row ends in a link to the place the work gets done.

const SEV: Record<Severity, { bar: string; chip: string; label: string }> = {
  critical: { bar: 'bg-red-600', chip: 'bg-red-100 text-red-800 border-red-200', label: 'Critical' },
  high: { bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800 border-amber-200', label: 'High' },
  moderate: { bar: 'bg-blue-500', chip: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Moderate' },
  info: { bar: 'bg-gray-400', chip: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Info' },
}

const URGENCY_CHIP: Record<Urgency, string> = {
  'Act now': 'bg-red-600 text-white',
  'This month': 'bg-amber-500 text-white',
  'This quarter': 'bg-blue-600 text-white',
  Monitor: 'bg-gray-400 text-white',
}

function Row({ item }: { item: ActionItem }) {
  const [open, setOpen] = useState(false)
  const sev = SEV[item.severity]
  const hasDetail = Boolean(item.examples?.length || item.caveat)

  return (
    <li className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex">
        <div className={cn('w-1.5 flex-shrink-0', sev.bar)} aria-hidden />
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={cn('text-[11px] px-2 py-0.5 rounded font-bold tracking-wide', URGENCY_CHIP[item.urgency])}>
                  {item.urgency.toUpperCase()}
                </span>
                {item.count != null && (
                  <span className={cn('text-[11px] px-2 py-0.5 rounded border font-semibold', sev.chip)}>
                    {item.count}
                  </span>
                )}
              </div>
              {/* The headline is the answer — sized to be read first. */}
              <h3 className="font-bold text-gray-900 text-base leading-snug">{item.headline}</h3>
              <p className="text-sm text-gray-600 mt-1">{item.why}</p>
              <p className="text-sm text-gray-900 mt-2">
                <span className="font-semibold">Do this: </span>{item.action}
              </p>
            </div>
            <Link
              href={item.href}
              className="text-sm px-3 py-2 rounded-lg text-white font-medium whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: '#1B4F2A' }}
            >
              {item.linkLabel} →
            </Link>
          </div>

          {hasDetail && (
            <>
              <button
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                {open ? '▲ Hide detail' : '▼ Show detail'}
              </button>
              {open && (
                <div className="mt-2 space-y-2">
                  {item.examples && item.examples.length > 0 && (
                    <ul className="text-xs text-gray-700 space-y-0.5 bg-gray-50 rounded p-2">
                      {item.examples.map((e, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-gray-400">•</span><span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.caveat && (
                    <p className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2">{item.caveat}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

export function ActionFeed({
  items, title = 'What needs your attention', emptyMessage, limit,
}: {
  items: ActionItem[]
  title?: string
  emptyMessage?: string
  limit?: number
}) {
  const [showAll, setShowAll] = useState(false)
  const cap = limit ?? 5
  const shown = showAll ? items : items.slice(0, cap)
  const actNow = items.filter(i => i.urgency === 'Act now').length

  if (items.length === 0) {
    return (
      <section className="bg-white border border-green-200 rounded-xl p-5 text-center">
        <div className="text-3xl mb-2" aria-hidden>✓</div>
        <h2 className="font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">
          {emptyMessage ?? 'Nothing needs immediate attention in this formation.'}
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="action-feed-heading">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 id="action-feed-heading" className="text-lg font-bold text-gray-900">
          {title}
          {actNow > 0 && (
            <span className="ml-2 text-sm font-semibold text-red-700">
              {actNow} need{actNow === 1 ? 's' : ''} action now
            </span>
          )}
        </h2>
        <span className="text-sm text-gray-500">
          {items.length} item{items.length === 1 ? '' : 's'}, most urgent first
        </span>
      </div>

      <ul className="space-y-2">
        {shown.map(item => <Row key={item.id} item={item} />)}
      </ul>

      {items.length > cap && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-sm font-medium text-green-800 underline"
        >
          {showAll ? 'Show less' : `Show ${items.length - cap} more`}
        </button>
      )}
    </section>
  )
}
