'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CivilianCapabilityProfile, CivilianSkill, CivilianCredential, CivilianEmployment,
} from './civilian/types'
import { emptyCivilianProfile } from './civilian/types'

// Split by domain rather than piled into one global store: the soldier's own
// civilian profile has a different lifecycle and privacy weight than the
// commander's roster, and they should be able to migrate separately.

interface CivilianStore {
  profile: CivilianCapabilityProfile
  setEmployment: (e: CivilianEmployment | undefined) => void
  addSkill: (s: CivilianSkill) => void
  updateSkill: (id: string, patch: Partial<CivilianSkill>) => void
  removeSkill: (id: string) => void
  addCredential: (c: CivilianCredential) => void
  updateCredential: (id: string, patch: Partial<CivilianCredential>) => void
  removeCredential: (id: string) => void
  setLanguages: (l: string[]) => void
  setEducationFields: (f: string[]) => void
  setProjectManagement: (p: CivilianCapabilityProfile['projectManagementExperience']) => void
  setWillingness: (w: Partial<CivilianCapabilityProfile['willingness']>) => void
  resetCivilian: () => void
}

const initial = emptyCivilianProfile('self', {
  source: 'Self Reported',
  verified: false,
  notes: 'Entered by the soldier in this browser.',
})

export const useCivilianStore = create<CivilianStore>()(
  persist(
    (set, get) => ({
      profile: initial,

      setEmployment: (employment) =>
        set({ profile: { ...get().profile, employment } }),
      addSkill: (s) =>
        set({ profile: { ...get().profile, skills: [...get().profile.skills, s] } }),
      updateSkill: (id, patch) =>
        set({ profile: { ...get().profile, skills: get().profile.skills.map(s => s.id === id ? { ...s, ...patch } : s) } }),
      removeSkill: (id) =>
        set({ profile: { ...get().profile, skills: get().profile.skills.filter(s => s.id !== id) } }),
      addCredential: (c) =>
        set({ profile: { ...get().profile, credentials: [...get().profile.credentials, c] } }),
      updateCredential: (id, patch) =>
        set({ profile: { ...get().profile, credentials: get().profile.credentials.map(c => c.id === id ? { ...c, ...patch } : c) } }),
      removeCredential: (id) =>
        set({ profile: { ...get().profile, credentials: get().profile.credentials.filter(c => c.id !== id) } }),
      setLanguages: (languages) => set({ profile: { ...get().profile, languages } }),
      setEducationFields: (educationFields) => set({ profile: { ...get().profile, educationFields } }),
      setProjectManagement: (projectManagementExperience) =>
        set({ profile: { ...get().profile, projectManagementExperience } }),
      setWillingness: (w) =>
        set({ profile: { ...get().profile, willingness: { ...get().profile.willingness, ...w } } }),
      resetCivilian: () => set({ profile: initial }),
    }),
    { name: 'mtarng-civilian' }
  )
)
