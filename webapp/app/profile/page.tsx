'use client'

import { useState } from 'react'
import { useProfileStore } from '@/lib/store'
import { MT_CITIES } from '@/lib/data/cities'
import type { CareerCategory, ComponentStatus, PositionType, CommuteLimit, PrimaryGoal } from '@/lib/types'

const ARMY_GREEN = '#1B4F2A'

const RANKS = {
  Enlisted: ['E1','E2','E3','E4','E5','E6','E7','E8','E9'],
  Warrant:  ['W1','W2','W3','W4','W5'],
  Officer:  ['O1','O2','O3','O4','O5','O6'],
}

const ALL_RANKS = [...RANKS.Enlisted, ...RANKS.Warrant, ...RANKS.Officer]

const COMPONENT_STATUSES: ComponentStatus[] = ['M-Day', 'AGR', 'Technician', 'ADOS', 'IRR']
const COMMUTE_LIMITS: CommuteLimit[] = ['30 Minutes', '1 Hour', '1.5 Hours', '2 Hours', '3 Hours', 'No Limit']
const EDUCATION_LEVELS = ["High School/GED","Some College","Associate's","Bachelor's","Master's","Doctorate"]

const ALL_PRIMARY_GOALS: PrimaryGoal[] = [
  'Promote to Next Grade','Switch MOS/Branch','Pursue AGR Full-Time','Pursue Command',
  'Move to Staff','Become Warrant Officer','Pursue Senior Leader Path','Broaden Experience','Retire in Current Grade',
]

function goalsForCategory(cat: CareerCategory): PrimaryGoal[] {
  return ALL_PRIMARY_GOALS.filter(g => {
    if (g === 'Become Warrant Officer' && cat !== 'Enlisted') return false
    if (g === 'Pursue Senior Leader Path' && cat === 'Warrant') return false
    return true
  })
}

function rankToCategory(rank: string): CareerCategory {
  if (rank.startsWith('E')) return 'Enlisted'
  if (rank.startsWith('O')) return 'Officer'
  return 'Warrant'
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-700 text-sm'
const lbl = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1'
const ta  = 'w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-700 text-sm h-24 resize-none'

function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="mb-4 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex justify-between items-center text-white px-5 py-4 cursor-pointer font-semibold text-base"
        style={{ backgroundColor: ARMY_GREEN }}
      >
        <span>{title}</span>
        <span className="text-lg">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="bg-white px-5 py-5">{children}</div>}
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 mt-4 first:mt-0">{children}</p>
}

export default function ProfilePage() {
  const { profile, setProfile, resetProfile } = useProfileStore()
  const [saved, setSaved] = useState(false)
  const [s1, setS1] = useState(true)
  const [s2, setS2] = useState(false)
  const [s3, setS3] = useState(false)
  const [s4, setS4] = useState(false)

  // Count filled required fields for completion %
  const required = [profile.fullName, profile.rank, profile.mos, profile.homeCity, profile.componentStatus]
  const pctComplete = Math.round((required.filter(Boolean).length / required.length) * 100)

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  function handleRankChange(rank: string) {
    const cat = rankToCategory(rank)
    // If category changes, reset target rank to a sensible value in new category
    const targetRanks = RANKS[cat]
    const currentTargetInCategory = targetRanks.includes(profile.targetRank)
    setProfile({
      rank,
      careerCategory: cat,
      targetRank: currentTargetInCategory ? profile.targetRank : (targetRanks[Math.min(1, targetRanks.length - 1)] ?? ''),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: ARMY_GREEN }}>Soldier Career Profile</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-48">
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${pctComplete}%`, backgroundColor: ARMY_GREEN }} />
            </div>
            <span className="text-xs text-gray-500">{pctComplete}% complete</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-700 font-medium text-sm">✓ Saved</span>}
          <button onClick={flash} type="button"
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 font-medium text-sm transition-colors">
            Save Profile
          </button>
          <button onClick={() => { if (window.confirm('Reset all profile data?')) resetProfile() }} type="button"
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm">
            Reset
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── SECTION 1: Identity ─────────────────────────────────── */}
        <Section title="1 · Identity & Current Status" open={s1} onToggle={() => setS1(v => !v)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2">
              <label className={lbl}>Full Name</label>
              <input type="text" className={inp} value={profile.fullName}
                onChange={e => setProfile({ fullName: e.target.value })} placeholder="e.g. John A. Smith" />
            </div>

            {/* Rank — auto-sets careerCategory */}
            <div>
              <label className={lbl}>Rank</label>
              <select className={inp} value={profile.rank} onChange={e => handleRankChange(e.target.value)}>
                <optgroup label="Enlisted">
                  {RANKS.Enlisted.map(r => <option key={r} value={r}>{r}</option>)}
                </optgroup>
                <optgroup label="Warrant Officer">
                  {RANKS.Warrant.map(r => <option key={r} value={r}>{r}</option>)}
                </optgroup>
                <optgroup label="Officer">
                  {RANKS.Officer.map(r => <option key={r} value={r}>{r}</option>)}
                </optgroup>
              </select>
            </div>

            <div>
              <label className={lbl}>Career Category</label>
              <select className={inp} value={profile.careerCategory}
                onChange={e => setProfile({ careerCategory: e.target.value as CareerCategory })}>
                <option value="Enlisted">Enlisted</option>
                <option value="Officer">Officer</option>
                <option value="Warrant">Warrant Officer</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Primary MOS / AOC</label>
              <input type="text" className={inp} value={profile.mos}
                onChange={e => setProfile({ mos: e.target.value })} placeholder="e.g. 92Y" />
            </div>

            <div>
              <label className={lbl}>Secondary MOS (optional)</label>
              <input type="text" className={inp} value={profile.secondaryMos}
                onChange={e => setProfile({ secondaryMos: e.target.value })} placeholder="e.g. 88M" />
            </div>

            <div>
              <label className={lbl}>Branch</label>
              <input type="text" className={inp} value={profile.branch}
                onChange={e => setProfile({ branch: e.target.value })} placeholder="e.g. LG, Aviation, INF" />
            </div>

            <div>
              <label className={lbl}>Component Status</label>
              <select className={inp} value={profile.componentStatus}
                onChange={e => setProfile({ componentStatus: e.target.value as ComponentStatus })}>
                {COMPONENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Unit Name</label>
              <input type="text" className={inp} value={profile.unitName}
                onChange={e => setProfile({ unitName: e.target.value })} placeholder="e.g. 1-163 CAB" />
            </div>

            <div>
              <label className={lbl}>Current Duty Title</label>
              <input type="text" className={inp} value={profile.dutyTitle}
                onChange={e => setProfile({ dutyTitle: e.target.value })} placeholder="e.g. Supply Sergeant" />
            </div>

            <div>
              <label className={lbl}>Unit City</label>
              <select className={inp} value={profile.unitCity}
                onChange={e => setProfile({ unitCity: e.target.value })}>
                <option value="">-- Select --</option>
                {MT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Home City</label>
              <select className={inp} value={profile.homeCity}
                onChange={e => setProfile({ homeCity: e.target.value })}>
                <option value="">-- Select --</option>
                {MT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Max Commute</label>
              <select className={inp} value={profile.maxCommute}
                onChange={e => setProfile({ maxCommute: e.target.value as CommuteLimit })}>
                {COMMUTE_LIMITS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Willing to Relocate?</label>
              <select className={inp} value={profile.willingToRelocate}
                onChange={e => setProfile({ willingToRelocate: e.target.value as 'Yes'|'No'|'Maybe' })}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Maybe">Maybe / Possibly</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Years of Service</label>
              <input type="number" min={0} max={40} className={inp} value={profile.yearsOfService}
                onChange={e => setProfile({ yearsOfService: Number(e.target.value) })} />
            </div>

            <div>
              <label className={lbl}>Time in Grade (years)</label>
              <input type="number" min={0} max={40} step={0.5} className={inp} value={profile.timeInGrade}
                onChange={e => setProfile({ timeInGrade: Number(e.target.value) })} />
            </div>

            <div>
              <label className={lbl}>ETS Date</label>
              <input type="date" className={inp} value={profile.ets}
                onChange={e => setProfile({ ets: e.target.value })} />
            </div>

            <div>
              <label className={lbl}>PEBD Date</label>
              <input type="date" className={inp} value={profile.pebd}
                onChange={e => setProfile({ pebd: e.target.value })} />
            </div>

          </div>
        </Section>

        {/* ── SECTION 2: PME & Education ─────────────────────────── */}
        <Section title="2 · PME & Education" open={s2} onToggle={() => setS2(v => !v)}>

          {/* Enlisted PME */}
          {profile.careerCategory === 'Enlisted' && (
            <>
              <SubLabel>Enlisted PME Checklist</SubLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {[
                  { key: 'ssd1Complete' as const, label: 'SSD1 / DL Phase 1' },
                  { key: 'blcComplete'  as const, label: 'BLC — Basic Leader Course' },
                  { key: 'ssd2Complete' as const, label: 'SSD2 / DL Phase 2' },
                  { key: 'alcComplete'  as const, label: 'ALC — Advanced Leader Course' },
                  { key: 'slcComplete'  as const, label: 'SLC — Senior Leader Course' },
                  { key: 'smcComplete'  as const, label: 'SMC — Sergeants Major Course' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-green-50">
                    <input type="checkbox" checked={profile[key]} onChange={e => setProfile({ [key]: e.target.checked })} className="accent-green-700 w-4 h-4" />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Officer PME */}
          {profile.careerCategory === 'Officer' && (
            <>
              <SubLabel>Officer PME Checklist</SubLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {[
                  { key: 'bolcComplete' as const, label: 'BOLC — Basic Officer Leader Course' },
                  { key: 'cccComplete'  as const, label: "CCC — Captain's Career Course" },
                  { key: 'ileComplete'  as const, label: 'ILE — Intermediate Level Education' },
                  { key: 'sscComplete'  as const, label: 'SSC — Senior Service College' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-green-50">
                    <input type="checkbox" checked={profile[key]} onChange={e => setProfile({ [key]: e.target.checked })} className="accent-green-700 w-4 h-4" />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Warrant PME */}
          {profile.careerCategory === 'Warrant' && (
            <>
              <SubLabel>Warrant Officer PME Checklist</SubLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {[
                  { key: 'wobcComplete'  as const, label: 'WOBC — Warrant Officer Basic Course' },
                  { key: 'woacComplete'  as const, label: 'WOAC — Warrant Officer Advanced Course' },
                  { key: 'woileComplete' as const, label: 'WOILE — WO Intermediate Level Education' },
                  { key: 'wosseComplete' as const, label: 'WOSSE — WO Senior Service Education' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-green-50">
                    <input type="checkbox" checked={profile[key]} onChange={e => setProfile({ [key]: e.target.checked })} className="accent-green-700 w-4 h-4" />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Education */}
          <SubLabel>Education</SubLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Education Level</label>
              <select className={inp} value={profile.educationLevel}
                onChange={e => setProfile({ educationLevel: e.target.value })}>
                <option value="">-- Select --</option>
                {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Field / Major</label>
              <input type="text" className={inp} value={profile.educationField}
                onChange={e => setProfile({ educationField: e.target.value })} placeholder="e.g. Business Administration" />
            </div>
          </div>

        </Section>

        {/* ── SECTION 3: Career Goals ─────────────────────────────── */}
        <Section title="3 · Career Goals" open={s3} onToggle={() => setS3(v => !v)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Target Rank — filtered by careerCategory */}
            <div>
              <label className={lbl}>Target Rank</label>
              <select className={inp} value={profile.targetRank}
                onChange={e => setProfile({ targetRank: e.target.value })}>
                <option value="">-- Select --</option>
                {RANKS[profile.careerCategory].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Years to Reach Target</label>
              <input type="number" min={0} max={30} className={inp} value={profile.targetTimeline}
                onChange={e => setProfile({ targetTimeline: Number(e.target.value) })} />
            </div>

            <div>
              <label className={lbl}>Primary Goal</label>
              <select className={inp} value={profile.primaryGoal}
                onChange={e => setProfile({ primaryGoal: e.target.value as PrimaryGoal })}>
                {goalsForCategory(profile.careerCategory).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className={lbl}>Secondary Goal</label>
              <input type="text" className={inp} value={profile.secondaryGoal}
                onChange={e => setProfile({ secondaryGoal: e.target.value })} placeholder="e.g. Complete bachelor's degree" />
            </div>

            <div>
              <label className={lbl}>Preferred Component Status</label>
              <select className={inp} value={profile.preferredStatus}
                onChange={e => setProfile({ preferredStatus: e.target.value as ComponentStatus | 'Either' })}>
                {COMPONENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Either">Either (No Preference)</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Desired Position Type</label>
              <select className={inp} value={profile.desiredPositionType}
                onChange={e => setProfile({ desiredPositionType: e.target.value as PositionType | 'Any' })}>
                {(['Leadership','Staff','Command','Technical','Broadening'] as PositionType[]).map(t =>
                  <option key={t} value={t}>{t}</option>
                )}
                <option value="Any">Any</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Open to Command / KD Position?</label>
              <select className={inp} value={profile.openToCommand}
                onChange={e => setProfile({ openToCommand: e.target.value as 'Yes'|'No'|'In a few years' })}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="In a few years">In a few years</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Want to Switch MOS?</label>
              <select className={inp} value={profile.wantToSwitchMos}
                onChange={e => setProfile({ wantToSwitchMos: e.target.value as 'Yes'|'No'|'Considering it' })}>
                <option value="No">No</option>
                <option value="Considering it">Considering it</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {/* Target MOS — only visible when switching */}
            {profile.wantToSwitchMos !== 'No' && (
              <div className="sm:col-span-2">
                <label className={lbl}>Target MOS / AOC if Switching</label>
                <input type="text" className={inp} value={profile.targetMos}
                  onChange={e => setProfile({ targetMos: e.target.value })} placeholder="e.g. 25B, 153A" />
              </div>
            )}

            {/* Warrant interest — only for Enlisted */}
            {profile.careerCategory === 'Enlisted' && (
              <div>
                <label className={lbl}>Warrant Officer Interest</label>
                <select className={inp} value={profile.warrantInterest}
                  onChange={e => setProfile({ warrantInterest: e.target.value as 'Yes - Active interest'|'No'|'Considering it' })}>
                  <option value="No">No</option>
                  <option value="Considering it">Considering it</option>
                  <option value="Yes - Active interest">Yes — Active interest</option>
                </select>
              </div>
            )}

          </div>
        </Section>

        {/* ── SECTION 4: Additional Info ──────────────────────────── */}
        <Section title="4 · Additional Information" open={s4} onToggle={() => setS4(v => !v)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className={lbl}>Security Clearance</label>
              <input type="text" className={inp} value={profile.clearanceLevel}
                onChange={e => setProfile({ clearanceLevel: e.target.value })} placeholder="e.g. Secret, TS/SCI" />
            </div>

            <div>
              <label className={lbl}>ACFT / Fitness Status</label>
              <select className={inp} value={profile.fitnessStatus}
                onChange={e => setProfile({ fitnessStatus: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="Passing">Passing</option>
                <option value="Failing">Failing</option>
                <option value="Exempt">Exempt</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className={lbl}>Deployments</label>
              <input type="text" className={inp} value={profile.deployments}
                onChange={e => setProfile({ deployments: e.target.value })} placeholder="e.g. Afghanistan 2021 (OFS)" />
            </div>

            <div>
              <label className={lbl}>Key Awards</label>
              <input type="text" className={inp} value={profile.awards}
                onChange={e => setProfile({ awards: e.target.value })} placeholder="e.g. ARCOM, AAM x2" />
            </div>

            <div>
              <label className={lbl}>Senior Rater Name</label>
              <input type="text" className={inp} value={profile.seniorRaterName}
                onChange={e => setProfile({ seniorRaterName: e.target.value })} placeholder="Name / Rank" />
            </div>

            <div>
              <label className={lbl}>Mentor Name &amp; Role</label>
              <input type="text" className={inp} value={profile.mentorName}
                onChange={e => setProfile({ mentorName: e.target.value })} placeholder="e.g. MSG Smith, Retention NCO" />
            </div>

            <div className="sm:col-span-2 flex flex-wrap gap-4 py-1">
              {[
                { key: 'hasKdPosition' as const,  label: 'Has KD / Key Developmental Position' },
                { key: 'isPromotable'  as const,  label: 'Is Promotable (P1)' },
                { key: 'onPromotionList' as const, label: 'On Current Promotion List' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={profile[key]} onChange={e => setProfile({ [key]: e.target.checked })} className="accent-green-700 w-4 h-4" />
                  {label}
                </label>
              ))}
            </div>

            <div className="sm:col-span-2">
              <label className={lbl}>Previous Assignments</label>
              <textarea className={ta} value={profile.previousAssignments}
                onChange={e => setProfile({ previousAssignments: e.target.value })}
                placeholder="List previous units, positions, and roles..." />
            </div>

            <div className="sm:col-span-2">
              <label className={lbl}>5-Year Goal Statement</label>
              <textarea className={ta} value={profile.fiveYearGoal}
                onChange={e => setProfile({ fiveYearGoal: e.target.value })}
                placeholder="Where do you want to be in 5 years? What rank, position, and status?" />
            </div>

            <div className="sm:col-span-2">
              <label className={lbl}>10-Year Goal Statement</label>
              <textarea className={ta} value={profile.tenYearGoal}
                onChange={e => setProfile({ tenYearGoal: e.target.value })}
                placeholder="Where do you want to be in 10 years? What does success look like?" />
            </div>

            <div className="sm:col-span-2">
              <label className={lbl}>Long-Term / Retirement Vision</label>
              <textarea className={ta} value={profile.longTermGoal}
                onChange={e => setProfile({ longTermGoal: e.target.value })}
                placeholder="What is your ultimate career vision? How do you want to retire from the Guard?" />
            </div>

          </div>
        </Section>

        {/* Bottom bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && <span className="text-green-700 font-medium text-sm">✓ Saved</span>}
          <button onClick={flash} type="button"
            className="bg-green-700 text-white px-6 py-2.5 rounded-lg hover:bg-green-800 font-semibold text-sm transition-colors">
            Save Profile
          </button>
        </div>

      </div>
    </div>
  )
}
