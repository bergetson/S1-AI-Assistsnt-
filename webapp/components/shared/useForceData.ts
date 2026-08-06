'use client'

import { useMemo } from 'react'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import { getBaseRoster } from '@/components/command/CommandShell'
import { buildCivilianProfiles } from '@/lib/civilian/demoData'
import { useCivilianStore } from '@/lib/civilianStore'
import type { CivilianCapabilityProfile } from '@/lib/civilian/types'
import type { RosterSoldier } from '@/lib/commandTypes'
import {
  BILLET_SOURCE, CIVILIAN_SOURCE, rosterSource, isDemoFidelity, type DataSource,
} from '@/lib/dataSources'
import { AS_OF_ISO, AS_OF_YEAR } from '@/lib/asOf'

// Re-exported from lib/asOf so the many existing importers keep working while
// there stays exactly one definition of the planning epoch.
export const AS_OF = AS_OF_ISO
export const BASE_YEAR = AS_OF_YEAR

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

  // Each dataset describes its own fidelity. There is deliberately no single
  // app-wide "isDemo" boolean: the billets are real, the roster is real but
  // de-identified, and the civilian layer is generated. One flag covering all
  // three is always a lie about at least one of them.
  const sources = useMemo(() => {
    const rs = rosterSource(source === 'imported')
    return {
      billets: BILLET_SOURCE,
      roster: rs,
      civilian: CIVILIAN_SOURCE,
      /** Everything on screen, for a banner or an export header. */
      all: [BILLET_SOURCE, rs, CIVILIAN_SOURCE] as DataSource[],
      /** Just the military picture, for screens with no civilian content. */
      military: [BILLET_SOURCE, rs] as DataSource[],
    }
  }, [source])

  return {
    positions,
    roster: activeRoster,
    civilianProfiles,
    source,
    selectedUics,
    sources,

    /** True only for genuinely generated data. The roster is real. */
    civilianIsSynthetic: isDemoFidelity(CIVILIAN_SOURCE.fidelity),
    rosterIsImported: source === 'imported',
  }
}

/** The signed-in soldier's own civilian profile, merged over the demo view. */
export function useMyCivilianProfile() {
  const { profile } = useCivilianStore()
  return profile
}
