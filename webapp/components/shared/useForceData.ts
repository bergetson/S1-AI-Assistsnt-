'use client'

import { useMemo } from 'react'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import { getBaseRoster } from '@/components/command/CommandShell'
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
    () => (source === 'imported' ? roster : getBaseRoster()),
    [roster, source]
  )
  const civilianProfiles = useMemo(() => civilianFor(activeRoster), [activeRoster])

  // The baseline roster is real force data, de-identified — not synthetic.
  const rosterIsDemo = false

  return {
    positions,
    roster: activeRoster,
    civilianProfiles,
    source,
    selectedUics,

    /**
     * The BILLETS are always real current MTARNG force structure. Only the
     * people and their civilian profiles can be synthetic, so the two are
     * flagged separately — importing a real roster must not make synthetic
     * civilian data start rendering as though it were real.
     */
    positionsAreReal: true as const,
    rosterIsDemo,
    /** No real civilian capability data exists yet; it is generated in all modes. */
    civilianIsSynthetic: true as const,

    /** Legacy alias — refers to the roster. Prefer the specific flags above. */
    isDemo: rosterIsDemo,
  }
}

/** The signed-in soldier's own civilian profile, merged over the demo view. */
export function useMyCivilianProfile() {
  const { profile } = useCivilianStore()
  return profile
}
