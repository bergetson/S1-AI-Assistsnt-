'use client'

import { useEffect } from 'react'
import { useRulesStore } from '@/lib/rulesStore'
import { applyTuning } from '@/lib/rules/tuning'

/**
 * The single place local rule tuning is pushed into the analytics tables.
 *
 * It has to be an effect, not a render-time call. This app is a static export:
 * the HTML is generated at build time with the shipped defaults, and if the
 * tables were mutated while rendering, the browser's first paint would disagree
 * with that HTML and React would report a hydration mismatch. Running in an
 * effect means the first paint matches the build, and the retuned numbers land
 * one tick later — the same pattern the roster already uses.
 *
 * Mounted once in the root layout. Anything that recomputes from these tables
 * must include useRulesStore().version in its dependencies; the mutation is
 * invisible to React on its own.
 */
export function TuningBoot() {
  const overrides = useRulesStore(s => s.overrides)

  useEffect(() => {
    applyTuning(overrides)
  }, [overrides])

  return null
}
