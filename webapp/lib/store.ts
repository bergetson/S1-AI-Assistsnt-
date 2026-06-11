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
          profileComplete: !!(next.fullName && next.rank && next.mos && next.homeCity),
        })
      },
      resetProfile: () => set({ profile: defaultProfile, profileComplete: false }),
    }),
    { name: 'mtarng-profile' }
  )
)
