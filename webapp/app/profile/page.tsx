'use client'

import { useState } from 'react'
import { useProfileStore } from '@/lib/store'
import { MT_CITIES } from '@/lib/data/cities'
import type {
  CareerCategory,
  ComponentStatus,
  PositionType,
  CommuteLimit,
  PrimaryGoal,
} from '@/lib/types'

const ARMY_GREEN = '#1B4F2A'

const RANKS = [
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9',
  'W1', 'W2', 'W3', 'W4', 'W5',
  'O1', 'O2', 'O3', 'O4', 'O5', 'O6',
]

const CAREER_CATEGORIES: CareerCategory[] = ['Enlisted', 'Officer', 'Warrant']

const COMPONENT_STATUSES: ComponentStatus[] = ['M-Day', 'AGR', 'Technician', 'ADOS', 'IRR']

const COMMUTE_LIMITS: CommuteLimit[] = ['30 Minutes', '1 Hour', '1.5 Hours', '2 Hours', '3 Hours', 'No Limit']

const PRIMARY_GOALS: PrimaryGoal[] = [
  'Promote to Next Grade',
  'Switch MOS/Branch',
  'Pursue AGR Full-Time',
  'Pursue Command',
  'Move to Staff',
  'Become Warrant Officer',
  'Pursue Senior Leader Path',
  'Broaden Experience',
  'Retire in Current Grade',
]

const EDUCATION_LEVELS = [
  'High School/GED',
  'Some College',
  "Associate's",
  "Bachelor's",
  "Master's",
  'Doctorate',
]

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-green-700 text-sm'

const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const textareaClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-green-700 text-sm h-24 resize-none'

interface SectionProps {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Section({ title, open, onToggle, children }: SectionProps) {
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex justify-between items-center text-white px-6 py-4 rounded-t-lg cursor-pointer font-semibold text-lg"
        style={{ backgroundColor: ARMY_GREEN }}
      >
        <span>{title}</span>
        <span className="text-xl leading-none">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg px-6 py-6">
          {children}
        </div>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const { profile, setProfile, resetProfile } = useProfileStore()
  const [savedMessage, setSavedMessage] = useState('')

  // Section open/close state
  const [sec1Open, setSec1Open] = useState(true)
  const [sec2Open, setSec2Open] = useState(false)
  const [sec3Open, setSec3Open] = useState(false)
  const [sec4Open, setSec4Open] = useState(false)

  function handleSave() {
    // Changes are already live via onChange -> setProfile.
    // Just show a confirmation flash.
    setSavedMessage('✓ Profile Saved!')
    setTimeout(() => setSavedMessage(''), 2000)
  }

  function handleReset() {
    if (window.confirm('Reset all profile data to defaults?')) {
      resetProfile()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Page Header */}
      <div className="bg-white border-b px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: ARMY_GREEN }}>
            Soldier Career Profile
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete all sections for the most accurate position matching and career guidance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedMessage && (
            <span className="text-green-700 font-medium text-sm">{savedMessage}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 font-medium text-sm transition-colors"
          >
            Save Profile
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Form Body */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">

        {/* ── SECTION 1: Identity & Current Status ─────────────────────── */}
        <Section
          title="1. Identity & Current Status"
          open={sec1Open}
          onToggle={() => setSec1Open((v) => !v)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Full Name */}
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                className={inputClass}
                value={profile.fullName}
                onChange={(e) => setProfile({ fullName: e.target.value })}
                placeholder="e.g. John A. Smith"
              />
            </div>

            {/* Rank */}
            <div>
              <label className={labelClass}>Rank</label>
              <select
                className={inputClass}
                value={profile.rank}
                onChange={(e) => setProfile({ rank: e.target.value })}
              >
                <optgroup label="Enlisted">
                  {RANKS.filter((r) => r.startsWith('E')).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
                <optgroup label="Warrant Officer">
                  {RANKS.filter((r) => r.startsWith('W')).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
                <optgroup label="Officer">
                  {RANKS.filter((r) => r.startsWith('O')).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Career Category */}
            <div>
              <label className={labelClass}>Career Category</label>
              <select
                className={inputClass}
                value={profile.careerCategory}
                onChange={(e) =>
                  setProfile({ careerCategory: e.target.value as CareerCategory })
                }
              >
                {CAREER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Primary MOS */}
            <div>
              <label className={labelClass}>Primary MOS</label>
              <input
                type="text"
                className={inputClass}
                value={profile.mos}
                onChange={(e) => setProfile({ mos: e.target.value })}
                placeholder="e.g. 92Y"
              />
            </div>

            {/* Secondary MOS */}
            <div>
              <label className={labelClass}>Secondary MOS</label>
              <input
                type="text"
                className={inputClass}
                value={profile.secondaryMos}
                onChange={(e) => setProfile({ secondaryMos: e.target.value })}
                placeholder="e.g. 88M"
              />
            </div>

            {/* Branch */}
            <div>
              <label className={labelClass}>Branch</label>
              <input
                type="text"
                className={inputClass}
                value={profile.branch}
                onChange={(e) => setProfile({ branch: e.target.value })}
                placeholder="e.g. LG"
              />
            </div>

            {/* Component Status */}
            <div>
              <label className={labelClass}>Component Status</label>
              <select
                className={inputClass}
                value={profile.componentStatus}
                onChange={(e) =>
                  setProfile({ componentStatus: e.target.value as ComponentStatus })
                }
              >
                {COMPONENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Unit Name */}
            <div>
              <label className={labelClass}>Unit Name</label>
              <input
                type="text"
                className={inputClass}
                value={profile.unitName}
                onChange={(e) => setProfile({ unitName: e.target.value })}
                placeholder="e.g. 495th CSSC"
              />
            </div>

            {/* UIC */}
            <div>
              <label className={labelClass}>UIC</label>
              <input
                type="text"
                className={inputClass}
                value={profile.uic}
                onChange={(e) => setProfile({ uic: e.target.value })}
                placeholder="e.g. W4MMMS"
              />
            </div>

            {/* Duty Title */}
            <div>
              <label className={labelClass}>Duty Title</label>
              <input
                type="text"
                className={inputClass}
                value={profile.dutyTitle}
                onChange={(e) => setProfile({ dutyTitle: e.target.value })}
                placeholder="e.g. Unit Supply Specialist"
              />
            </div>

            {/* Unit City */}
            <div>
              <label className={labelClass}>Unit City</label>
              <select
                className={inputClass}
                value={profile.unitCity}
                onChange={(e) => setProfile({ unitCity: e.target.value })}
              >
                <option value="">-- Select City --</option>
                {MT_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Home City */}
            <div>
              <label className={labelClass}>Home City</label>
              <select
                className={inputClass}
                value={profile.homeCity}
                onChange={(e) => setProfile({ homeCity: e.target.value })}
              >
                <option value="">-- Select City --</option>
                {MT_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Max Commute */}
            <div>
              <label className={labelClass}>Max Commute</label>
              <select
                className={inputClass}
                value={profile.maxCommute}
                onChange={(e) =>
                  setProfile({ maxCommute: e.target.value as CommuteLimit })
                }
              >
                {COMMUTE_LIMITS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Willing to Relocate */}
            <div>
              <label className={labelClass}>Willing to Relocate?</label>
              <select
                className={inputClass}
                value={profile.willingToRelocate}
                onChange={(e) =>
                  setProfile({
                    willingToRelocate: e.target.value as 'Yes' | 'No' | 'Maybe',
                  })
                }
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Maybe">Maybe</option>
              </select>
            </div>

            {/* Years of Service */}
            <div>
              <label className={labelClass}>Years of Service</label>
              <input
                type="number"
                min={0}
                max={40}
                className={inputClass}
                value={profile.yearsOfService}
                onChange={(e) => setProfile({ yearsOfService: Number(e.target.value) })}
              />
            </div>

            {/* Time in Grade */}
            <div>
              <label className={labelClass}>Time in Grade (years)</label>
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                className={inputClass}
                value={profile.timeInGrade}
                onChange={(e) => setProfile({ timeInGrade: Number(e.target.value) })}
              />
            </div>

            {/* Time in Position */}
            <div>
              <label className={labelClass}>Time in Position (years)</label>
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                className={inputClass}
                value={profile.timeInPosition}
                onChange={(e) => setProfile({ timeInPosition: Number(e.target.value) })}
              />
            </div>

            {/* ETS Date */}
            <div>
              <label className={labelClass}>ETS Date</label>
              <input
                type="date"
                className={inputClass}
                value={profile.ets}
                onChange={(e) => setProfile({ ets: e.target.value })}
              />
            </div>

            {/* PEBD Date */}
            <div>
              <label className={labelClass}>PEBD Date</label>
              <input
                type="date"
                className={inputClass}
                value={profile.pebd}
                onChange={(e) => setProfile({ pebd: e.target.value })}
              />
            </div>

          </div>
        </Section>

        {/* ── SECTION 2: PME & Education ───────────────────────────────── */}
        <Section
          title="2. PME & Education"
          open={sec2Open}
          onToggle={() => setSec2Open((v) => !v)}
        >
          {/* Enlisted PME */}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Enlisted PME
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.ssd1Complete}
                onChange={(e) => setProfile({ ssd1Complete: e.target.checked })}
                className="accent-green-700"
              />
              SSD1 / DL Phase 1 Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.blcComplete}
                onChange={(e) => setProfile({ blcComplete: e.target.checked })}
                className="accent-green-700"
              />
              BLC (Basic Leader Course) Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.ssd2Complete}
                onChange={(e) => setProfile({ ssd2Complete: e.target.checked })}
                className="accent-green-700"
              />
              SSD2 / DL Phase 2 Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.alcComplete}
                onChange={(e) => setProfile({ alcComplete: e.target.checked })}
                className="accent-green-700"
              />
              ALC (Advanced Leader Course) Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.slcComplete}
                onChange={(e) => setProfile({ slcComplete: e.target.checked })}
                className="accent-green-700"
              />
              SLC (Senior Leader Course) Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.smcComplete}
                onChange={(e) => setProfile({ smcComplete: e.target.checked })}
                className="accent-green-700"
              />
              SMC (Sergeants Major Course) Complete
            </label>
          </div>

          {/* Officer PME */}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Officer PME
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.bolcComplete}
                onChange={(e) => setProfile({ bolcComplete: e.target.checked })}
                className="accent-green-700"
              />
              BOLC Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.cccComplete}
                onChange={(e) => setProfile({ cccComplete: e.target.checked })}
                className="accent-green-700"
              />
              CCC (Captain&apos;s Career Course) Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.ileComplete}
                onChange={(e) => setProfile({ ileComplete: e.target.checked })}
                className="accent-green-700"
              />
              ILE (Intermediate Level Education) Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.sscComplete}
                onChange={(e) => setProfile({ sscComplete: e.target.checked })}
                className="accent-green-700"
              />
              SSC (Senior Service College) Complete
            </label>
          </div>

          {/* Warrant PME */}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Warrant Officer PME
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.wobcComplete}
                onChange={(e) => setProfile({ wobcComplete: e.target.checked })}
                className="accent-green-700"
              />
              WOBC Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.woacComplete}
                onChange={(e) => setProfile({ woacComplete: e.target.checked })}
                className="accent-green-700"
              />
              WOAC Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.woileComplete}
                onChange={(e) => setProfile({ woileComplete: e.target.checked })}
                className="accent-green-700"
              />
              WOILE Complete
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={profile.wosseComplete}
                onChange={(e) => setProfile({ wosseComplete: e.target.checked })}
                className="accent-green-700"
              />
              WOSSE Complete
            </label>
          </div>

          {/* Education Fields */}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Education
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Education Level</label>
              <select
                className={inputClass}
                value={profile.educationLevel}
                onChange={(e) => setProfile({ educationLevel: e.target.value })}
              >
                <option value="">-- Select --</option>
                {EDUCATION_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Education Field / Major</label>
              <input
                type="text"
                className={inputClass}
                value={profile.educationField}
                onChange={(e) => setProfile({ educationField: e.target.value })}
                placeholder="e.g. Business Administration"
              />
            </div>
          </div>
        </Section>

        {/* ── SECTION 3: Career Goals ──────────────────────────────────── */}
        <Section
          title="3. Career Goals"
          open={sec3Open}
          onToggle={() => setSec3Open((v) => !v)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Target Rank */}
            <div>
              <label className={labelClass}>Target Rank</label>
              <select
                className={inputClass}
                value={profile.targetRank}
                onChange={(e) => setProfile({ targetRank: e.target.value })}
              >
                <option value="">-- Select --</option>
                <optgroup label="Enlisted">
                  {RANKS.filter((r) => r.startsWith('E')).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
                <optgroup label="Warrant Officer">
                  {RANKS.filter((r) => r.startsWith('W')).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
                <optgroup label="Officer">
                  {RANKS.filter((r) => r.startsWith('O')).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Target Timeline */}
            <div>
              <label className={labelClass}>Years to Reach Target Rank</label>
              <input
                type="number"
                min={0}
                max={30}
                className={inputClass}
                value={profile.targetTimeline}
                onChange={(e) => setProfile({ targetTimeline: Number(e.target.value) })}
              />
            </div>

            {/* Primary Goal */}
            <div>
              <label className={labelClass}>Primary Goal</label>
              <select
                className={inputClass}
                value={profile.primaryGoal}
                onChange={(e) =>
                  setProfile({ primaryGoal: e.target.value as PrimaryGoal })
                }
              >
                {PRIMARY_GOALS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Secondary Goal */}
            <div>
              <label className={labelClass}>Secondary Goal</label>
              <input
                type="text"
                className={inputClass}
                value={profile.secondaryGoal}
                onChange={(e) => setProfile({ secondaryGoal: e.target.value })}
                placeholder="e.g. Complete bachelor's degree"
              />
            </div>

            {/* Preferred Status */}
            <div>
              <label className={labelClass}>Preferred Component Status</label>
              <select
                className={inputClass}
                value={profile.preferredStatus}
                onChange={(e) =>
                  setProfile({
                    preferredStatus: e.target.value as ComponentStatus | 'Either',
                  })
                }
              >
                {COMPONENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Either">Either</option>
              </select>
            </div>

            {/* Desired Position Type */}
            <div>
              <label className={labelClass}>Desired Position Type</label>
              <select
                className={inputClass}
                value={profile.desiredPositionType}
                onChange={(e) =>
                  setProfile({
                    desiredPositionType: e.target.value as PositionType | 'Any',
                  })
                }
              >
                {(['Leadership', 'Staff', 'Command', 'Technical', 'Broadening'] as PositionType[]).map(
                  (t) => (
                    <option key={t} value={t}>{t}</option>
                  )
                )}
                <option value="Any">Any</option>
              </select>
            </div>

            {/* Open to Command */}
            <div>
              <label className={labelClass}>Open to Command?</label>
              <select
                className={inputClass}
                value={profile.openToCommand}
                onChange={(e) =>
                  setProfile({
                    openToCommand: e.target.value as 'Yes' | 'No' | 'In a few years',
                  })
                }
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="In a few years">In a few years</option>
              </select>
            </div>

            {/* Want to Switch MOS */}
            <div>
              <label className={labelClass}>Want to Switch MOS?</label>
              <select
                className={inputClass}
                value={profile.wantToSwitchMos}
                onChange={(e) =>
                  setProfile({
                    wantToSwitchMos: e.target.value as 'Yes' | 'No' | 'Considering it',
                  })
                }
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Considering it">Considering it</option>
              </select>
            </div>

            {/* Target MOS if Switching */}
            <div>
              <label className={labelClass}>Target MOS if Switching</label>
              <input
                type="text"
                className={inputClass}
                value={profile.targetMos}
                onChange={(e) => setProfile({ targetMos: e.target.value })}
                placeholder="e.g. 25B"
              />
            </div>

            {/* Warrant Officer Interest */}
            <div>
              <label className={labelClass}>Warrant Officer Interest</label>
              <select
                className={inputClass}
                value={profile.warrantInterest}
                onChange={(e) =>
                  setProfile({
                    warrantInterest: e.target.value as
                      | 'Yes - Active interest'
                      | 'No'
                      | 'Considering it',
                  })
                }
              >
                <option value="Yes - Active interest">Yes - Active interest</option>
                <option value="No">No</option>
                <option value="Considering it">Considering it</option>
              </select>
            </div>

          </div>
        </Section>

        {/* ── SECTION 4: Additional Information ───────────────────────── */}
        <Section
          title="4. Additional Information"
          open={sec4Open}
          onToggle={() => setSec4Open((v) => !v)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Clearance Level */}
            <div>
              <label className={labelClass}>Clearance Level</label>
              <input
                type="text"
                className={inputClass}
                value={profile.clearanceLevel}
                onChange={(e) => setProfile({ clearanceLevel: e.target.value })}
                placeholder="e.g. Secret"
              />
            </div>

            {/* Fitness Status */}
            <div>
              <label className={labelClass}>Fitness Status</label>
              <select
                className={inputClass}
                value={profile.fitessStatus}
                onChange={(e) => setProfile({ fitessStatus: e.target.value })}
              >
                <option value="">-- Select --</option>
                <option value="Passing">Passing</option>
                <option value="Failing">Failing</option>
                <option value="Exempt">Exempt</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            {/* Deployments */}
            <div>
              <label className={labelClass}>Deployments</label>
              <input
                type="text"
                className={inputClass}
                value={profile.deployments}
                onChange={(e) => setProfile({ deployments: e.target.value })}
                placeholder="e.g. 1 deployment (Afghanistan 2021)"
              />
            </div>

            {/* Awards */}
            <div>
              <label className={labelClass}>Awards</label>
              <input
                type="text"
                className={inputClass}
                value={profile.awards}
                onChange={(e) => setProfile({ awards: e.target.value })}
                placeholder="e.g. ARCOM, AAM x2"
              />
            </div>

            {/* Mentor Name */}
            <div>
              <label className={labelClass}>Mentor Name</label>
              <input
                type="text"
                className={inputClass}
                value={profile.mentorName}
                onChange={(e) => setProfile({ mentorName: e.target.value })}
              />
            </div>

            {/* Mentor Role */}
            <div>
              <label className={labelClass}>Mentor Role</label>
              <input
                type="text"
                className={inputClass}
                value={profile.mentorRole}
                onChange={(e) => setProfile({ mentorRole: e.target.value })}
                placeholder="e.g. SGM, Retention NCO"
              />
            </div>

            {/* Senior Rater Name */}
            <div>
              <label className={labelClass}>Senior Rater Name</label>
              <input
                type="text"
                className={inputClass}
                value={profile.seniorRaterName}
                onChange={(e) => setProfile({ seniorRaterName: e.target.value })}
              />
            </div>

            {/* Checkboxes — span both columns on md */}
            <div className="md:col-span-2 flex flex-wrap gap-6 py-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={profile.hasKdPosition}
                  onChange={(e) => setProfile({ hasKdPosition: e.target.checked })}
                  className="accent-green-700"
                />
                Has KD (Key Developmental) Position
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={profile.isPromotable}
                  onChange={(e) => setProfile({ isPromotable: e.target.checked })}
                  className="accent-green-700"
                />
                Is Promotable
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={profile.onPromotionList}
                  onChange={(e) => setProfile({ onPromotionList: e.target.checked })}
                  className="accent-green-700"
                />
                On Promotion List
              </label>
            </div>

            {/* Previous Assignments — full width */}
            <div className="md:col-span-2">
              <label className={labelClass}>Previous Assignments</label>
              <textarea
                className={textareaClass}
                value={profile.previousAssignments}
                onChange={(e) => setProfile({ previousAssignments: e.target.value })}
                placeholder="List prior assignments, positions, and units..."
              />
            </div>

            {/* 5-Year Goal — full width */}
            <div className="md:col-span-2">
              <label className={labelClass}>5-Year Goal</label>
              <textarea
                className={textareaClass}
                value={profile.fiveYearGoal}
                onChange={(e) => setProfile({ fiveYearGoal: e.target.value })}
                placeholder="Where do you want to be in 5 years?"
              />
            </div>

            {/* 10-Year Goal — full width */}
            <div className="md:col-span-2">
              <label className={labelClass}>10-Year Goal</label>
              <textarea
                className={textareaClass}
                value={profile.tenYearGoal}
                onChange={(e) => setProfile({ tenYearGoal: e.target.value })}
                placeholder="Where do you want to be in 10 years?"
              />
            </div>

            {/* Long-term Goal — full width */}
            <div className="md:col-span-2">
              <label className={labelClass}>Long-term Goal</label>
              <textarea
                className={textareaClass}
                value={profile.longTermGoal}
                onChange={(e) => setProfile({ longTermGoal: e.target.value })}
                placeholder="Describe your overall long-term career vision..."
              />
            </div>

          </div>
        </Section>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {savedMessage && (
            <span className="text-green-700 font-medium text-sm">{savedMessage}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 font-medium text-sm transition-colors"
          >
            Save Profile
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            Reset
          </button>
        </div>

      </div>
    </div>
  )
}
