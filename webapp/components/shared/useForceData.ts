'use client'

import { useMemo } from 'react'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import { getDemoRoster } from '@/components/command/CommandShell'
import { buildCivilianProfiles } from '@/lib/civilian/demoData'
import { useCivilianStore } from '@/lib/civilianStore'
import type { CivilianCapabilityProfile } from '@/lib/civilian/types'
import type { RosterSoldier } from '@/lib/commandTypes'

export const AS_OF = '2026-06-01'
export const BASE_YEAR = 2026

/**
 * The one place that resolves "which roster and which civilian profiles are in
 * play". Built once and memoized so the Skills Explorer, Mission Builder,
 * Community Impact, Talent, and G1 views all agree on the same population.
 */
let civCache: { key: RosterSoldier[]; map: Map<string, CivilianCapabilityProfile> } | null = null

function civilianFor(roster: RosterSoldier[]): Map<string, CivilianCapabilityProfile> {
  if (civCache && civCache.key === roster) return civCache.map
  const map = buildCivilianProfiles(roster)
  civCache = { key: roster, map }
  return map
}

export function useForceData() {
  const { roster, source, selectedUics } = useCommandStore()
  const activeRoster = useMemo(
    () => (source === 'demo' ? getDemoRoster() : roster),
    [roster, source]
  )
  const civilianProfiles = useMemo(() => civilianFor(activeRoster), [activeRoster])

  return {
    positions,
    roster: activeRoster,
    civilianProfiles,
    source,
    selectedUics,
    isDemo: source === 'demo',
  }
}

/** The signed-in soldier's own civilian profile, merged over the demo view. */
export function useMyCivilianProfile() {
  const { profile } = useCivilianStore()
  return profile
}
