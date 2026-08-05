'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SoldierProfile } from './types'
import { defaultProfile } from './types'

interface ProfileStore {
  profile: SoldierProfile
  profileComplete: boolean
  setProfile: (p: Partial<SoldierProfile>) => void
  resetProfile: () => void
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      profileComplete: false,
      setProfile: (p) => {
        const next = { ...get().profile, ...p }
        set({
          profile: next,
          // Name is only needed for the printed counseling sheet — nothing scores
          // on it. Requiring it to see position matches is friction with no payoff.
          profileComplete: !!(next.rank && next.mos && next.homeCity),
        })
      },
      resetProfile: () => set({ profile: defaultProfile, profileComplete: false }),
    }),
    { name: 'mtarng-profile' }
  )
)
