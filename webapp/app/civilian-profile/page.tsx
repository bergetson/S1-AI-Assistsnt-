'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCivilianStore } from '@/lib/civilianStore'
import {
  categoryNames, subcategoriesOf,
} from '@/lib/civilian/taxonomy'
import {
  PROFICIENCY_ORDER, isCredentialExpired, effectiveVerification,
  type SkillProficiency, type VerificationStatus, type EmployerType, type SupervisoryLevel,
} from '@/lib/civilian/types'
import { VerificationBadge, PrototypeNotice, MissingDataNote } from '@/components/shared/Badges'
import { AS_OF } from '@/components/shared/useForceData'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const lbl = 'block text-xs font-semibold text-gray-600 uppercase mb-1'

const VERIFICATIONS: VerificationStatus[] = ['Self Reported', 'Leader Reviewed', 'Document Verified', 'Unverified']
const EMPLOYER_TYPES: EmployerType[] = ['Private', 'Federal Government', 'State Government', 'Local Government', 'Nonprofit', 'Self Employed', 'Other']
const SUPERVISORY: SupervisoryLevel[] = ['None', 'Team Lead', 'Supervisor', 'Manager', 'Executive', 'Owner']

type Tab = 'employment' | 'skills' | 'credentials' | 'leadership' | 'languages' | 'preferences' | 'about'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'employment', label: '1. Employment' },
  { id: 'skills', label: '2. Skills' },
  { id: 'credentials', label: '3. Credentials' },
  { id: 'leadership', label: '4. Leadership' },
  { id: 'languages', label: '5. Languages' },
  { id: 'preferences', label: '6. Mission Use' },
  { id: 'about', label: '7. How This Is Used' },
]

export default function CivilianProfilePage() {
  const {
    profile, setEmployment, addSkill, updateSkill, removeSkill,
    addCredential, updateCredential, removeCredential,
    setLanguages, setProjectManagement, setWillingness, resetCivilian,
  } = useCivilianStore()
  const [tab, setTab] = useState<Tab>('employment')
  const [newSkillCat, setNewSkillCat] = useState(categoryNames()[0])
  const [newSkillSub, setNewSkillSub] = useState(subcategoriesOf(categoryNames()[0])[0] ?? '')
  const [error, setError] = useState('')

  const emp = profile.employment

  function updateEmp(patch: Partial<NonNullable<typeof emp>>) {
    setEmployment({
      occupationTitle: '', industry: '', employerType: 'Private',
      ...emp, ...patch,
    })
  }

  function handleAddSkill() {
    if (!newSkillSub) { setError('Choose a specific skill before adding.'); return }
    if (profile.skills.some(s => s.category === newSkillCat && s.subcategory === newSkillSub)) {
      setError('That skill is already on your profile.'); return
    }
    setError('')
    addSkill({
      id: `sk-${Date.now()}`,
      category: newSkillCat, subcategory: newSkillSub, skillName: newSkillSub,
      proficiency: 'Working Experience',
      verificationStatus: 'Self Reported',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Civilian Capability Profile</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Your civilian work, skills, and credentials. This helps planners find the right people for
            missions that need civilian expertise — and helps leaders understand what capability leaves a
            community when units activate.
          </p>
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
            <strong>Everything here is optional.</strong> Providing civilian information does not
            automatically determine activation, assignment, or exemption — a human makes those decisions.
            Your entries are stored only in this browser and are never uploaded.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 bg-white border-b overflow-x-auto">
        <div className="max-w-4xl mx-auto flex gap-1" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn('px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition focus:outline-none focus:ring-2 focus:ring-green-700',
                tab === t.id ? 'border-green-700 text-green-800' : 'border-transparent text-gray-500 hover:text-gray-800')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-5">
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
          )}

          {/* ── 1. Employment ── */}
          {tab === 'employment' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-gray-900">Current civilian employment</h2>
                <p className="text-sm text-gray-500">
                  Your day job. This is separate from your skills — you may have capabilities your current
                  job does not use.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl} htmlFor="occ">Occupation title</label>
                  <input id="occ" className={inp} value={emp?.occupationTitle ?? ''}
                    onChange={e => updateEmp({ occupationTitle: e.target.value })}
                    placeholder="e.g. Master Electrician" />
                </div>
                <div>
                  <label className={lbl} htmlFor="ind">Industry</label>
                  <input id="ind" className={inp} value={emp?.industry ?? ''}
                    onChange={e => updateEmp({ industry: e.target.value })} placeholder="e.g. Construction" />
                </div>
                <div>
                  <label className={lbl} htmlFor="etype">Employer type</label>
                  <select id="etype" className={inp} value={emp?.employerType ?? 'Private'}
                    onChange={e => updateEmp({ employerType: e.target.value as EmployerType })}>
                    {EMPLOYER_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl} htmlFor="ename">Employer name (optional)</label>
                  <input id="ename" className={inp} value={emp?.employerName ?? ''}
                    onChange={e => updateEmp({ employerName: e.target.value })} />
                </div>
                <div>
                  <label className={lbl} htmlFor="wcity">Work city</label>
                  <input id="wcity" className={inp} value={emp?.workCity ?? ''}
                    onChange={e => updateEmp({ workCity: e.target.value })} />
                </div>
                <div>
                  <label className={lbl} htmlFor="wcounty">Work county</label>
                  <input id="wcounty" className={inp} value={emp?.workCounty ?? ''}
                    onChange={e => updateEmp({ workCounty: e.target.value })} placeholder="e.g. Phillips" />
                </div>
                <div>
                  <label className={lbl} htmlFor="yio">Years in occupation</label>
                  <input id="yio" type="number" min={0} className={inp} value={emp?.yearsInOccupation ?? ''}
                    onChange={e => updateEmp({ yearsInOccupation: Number(e.target.value) || undefined })} />
                </div>
                <div>
                  <label className={lbl} htmlFor="sup">Supervisory level</label>
                  <select id="sup" className={inp} value={emp?.supervisoryLevel ?? 'None'}
                    onChange={e => updateEmp({ supervisoryLevel: e.target.value as SupervisoryLevel })}>
                    {SUPERVISORY.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <fieldset className="border border-gray-200 rounded-lg p-3">
                <legend className="text-xs font-semibold text-gray-600 uppercase px-1">
                  Community context (optional, self-reported)
                </legend>
                <p className="text-xs text-gray-500 mb-2">
                  Used only to estimate what capability a community may lose during an activation.
                </p>
                {([
                  ['essentialCommunityRole', 'My role is essential to my community (EMS, utilities, healthcare, public safety).'],
                  ['soleProviderOrSpecialist', 'I am one of very few people locally who can do this work.'],
                  ['smallEmployer', 'My employer is small enough that my absence is materially felt.'],
                ] as const).map(([key, text]) => (
                  <label key={key} className="flex items-start gap-2 text-sm text-gray-700 py-1">
                    <input type="checkbox" className="mt-1 accent-green-700"
                      checked={Boolean(emp?.[key])}
                      onChange={e => updateEmp({ [key]: e.target.checked })} />
                    <span>{text}</span>
                  </label>
                ))}
              </fieldset>
            </section>
          )}

          {/* ── 2. Skills ── */}
          {tab === 'skills' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-gray-900">Skills and experience</h2>
                <p className="text-sm text-gray-500">
                  Add any capability you have, whether or not it relates to your current job.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-end bg-gray-50 rounded-lg p-3">
                <div className="flex-1 min-w-[180px]">
                  <label className={lbl} htmlFor="cat">Category</label>
                  <select id="cat" className={inp} value={newSkillCat}
                    onChange={e => { setNewSkillCat(e.target.value); setNewSkillSub(subcategoriesOf(e.target.value)[0] ?? '') }}>
                    {categoryNames().map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className={lbl} htmlFor="sub">Skill</label>
                  <select id="sub" className={inp} value={newSkillSub} onChange={e => setNewSkillSub(e.target.value)}>
                    {subcategoriesOf(newSkillCat).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={handleAddSkill}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: GREEN }}>
                  + Add skill
                </button>
              </div>

              {profile.skills.length === 0 ? (
                <MissingDataNote>
                  No skills added yet. Without them you will not appear in civilian capability searches.
                </MissingDataNote>
              ) : (
                <ul className="space-y-3">
                  {profile.skills.map(s => (
                    <li key={s.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-semibold text-gray-900">{s.subcategory}</div>
                          <div className="text-xs text-gray-500">{s.category}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <VerificationBadge value={s.verificationStatus} />
                          <button onClick={() => removeSkill(s.id)}
                            className="text-xs text-gray-400 hover:text-red-600" aria-label={`Remove ${s.subcategory}`}>
                            ✕ remove
                          </button>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-4 gap-3 mt-3">
                        <div>
                          <label className={lbl}>Proficiency</label>
                          <select className={inp} value={s.proficiency}
                            onChange={e => updateSkill(s.id, { proficiency: e.target.value as SkillProficiency })}>
                            {PROFICIENCY_ORDER.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Years</label>
                          <input type="number" min={0} className={inp} value={s.yearsExperience ?? ''}
                            onChange={e => updateSkill(s.id, { yearsExperience: Number(e.target.value) || undefined })} />
                        </div>
                        <div>
                          <label className={lbl}>Last used (year)</label>
                          <input type="number" min={1970} max={2100} className={inp} value={s.lastUsedYear ?? ''}
                            onChange={e => updateSkill(s.id, { lastUsedYear: Number(e.target.value) || undefined })} />
                        </div>
                        <div>
                          <label className={lbl}>Verification</label>
                          <select className={inp} value={s.verificationStatus}
                            onChange={e => updateSkill(s.id, { verificationStatus: e.target.value as VerificationStatus })}>
                            {VERIFICATIONS.map(v => <option key={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ── 3. Credentials ── */}
          {tab === 'credentials' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-gray-900">Licenses and credentials</h2>
                <p className="text-sm text-gray-500">
                  Do not enter license or certificate numbers — they are not needed here.
                </p>
              </div>
              <button
                onClick={() => addCredential({
                  id: `cr-${Date.now()}`, name: '', category: '',
                  verificationStatus: 'Self Reported',
                })}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                style={{ backgroundColor: GREEN }}>
                + Add credential
              </button>

              {profile.credentials.length === 0 ? (
                <MissingDataNote>No credentials recorded.</MissingDataNote>
              ) : (
                <ul className="space-y-3">
                  {profile.credentials.map(c => {
                    const expired = isCredentialExpired(c, AS_OF)
                    return (
                      <li key={c.id} className={cn('rounded-lg border p-3',
                        expired ? 'border-red-300 bg-red-50' : 'border-gray-200')}>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className={lbl}>Credential name</label>
                            <input className={inp} value={c.name}
                              onChange={e => updateCredential(c.id, { name: e.target.value })}
                              placeholder="e.g. Montana Master Electrician" />
                          </div>
                          <div>
                            <label className={lbl}>Issuing authority</label>
                            <input className={inp} value={c.issuingAuthority ?? ''}
                              onChange={e => updateCredential(c.id, { issuingAuthority: e.target.value })} />
                          </div>
                          <div>
                            <label className={lbl}>Expiration date</label>
                            <input type="date" className={inp} value={c.expirationDate ?? ''}
                              onChange={e => updateCredential(c.id, { expirationDate: e.target.value })} />
                          </div>
                          <div>
                            <label className={lbl}>Verification</label>
                            <select className={inp} value={c.verificationStatus}
                              onChange={e => updateCredential(c.id, { verificationStatus: e.target.value as VerificationStatus })}>
                              {VERIFICATIONS.map(v => <option key={v}>{v}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <VerificationBadge value={effectiveVerification(c, AS_OF)} />
                          <button onClick={() => removeCredential(c.id)}
                            className="text-xs text-gray-400 hover:text-red-600">✕ remove</button>
                        </div>
                        {expired && (
                          <p className="mt-2 text-xs text-red-800">
                            This credential is expired and will not count toward mission requirements that
                            require a current credential.
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {/* ── 4. Leadership ── */}
          {tab === 'leadership' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-900">Leadership and project experience</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-green-700"
                  checked={profile.projectManagementExperience?.hasExperience ?? false}
                  onChange={e => setProjectManagement({
                    ...profile.projectManagementExperience, hasExperience: e.target.checked })} />
                I have civilian project or program management experience
              </label>
              {profile.projectManagementExperience?.hasExperience && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className={lbl}>Largest team led</label>
                    <input type="number" min={0} className={inp}
                      value={profile.projectManagementExperience?.largestTeam ?? ''}
                      onChange={e => setProjectManagement({
                        ...profile.projectManagementExperience!, largestTeam: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <label className={lbl}>Largest budget (USD)</label>
                    <input type="number" min={0} className={inp}
                      value={profile.projectManagementExperience?.largestBudget ?? ''}
                      onChange={e => setProjectManagement({
                        ...profile.projectManagementExperience!, largestBudget: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <label className={lbl}>Years of experience</label>
                    <input type="number" min={0} className={inp}
                      value={profile.projectManagementExperience?.yearsExperience ?? ''}
                      onChange={e => setProjectManagement({
                        ...profile.projectManagementExperience!, yearsExperience: Number(e.target.value) || undefined })} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── 5. Languages ── */}
          {tab === 'languages' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Languages</h2>
              <label className={lbl} htmlFor="langs">Languages you speak (comma separated)</label>
              <input id="langs" className={inp} value={profile.languages.join(', ')}
                onChange={e => setLanguages(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Spanish, German, ASL" />
            </section>
          )}

          {/* ── 6. Mission-use preferences ── */}
          {tab === 'preferences' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-gray-900">Mission-use preferences</h2>
                <p className="text-sm text-gray-500">
                  Your stated preference is shown to planners. It is a factor in matching, not a veto or a
                  guarantee — orders still come through the chain of command.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Use my civilian skills on missions</label>
                  <select className={inp} value={profile.willingness.useCivilianSkillsOnMission}
                    onChange={e => setWillingness({ useCivilianSkillsOnMission: e.target.value as 'Yes' | 'No' | 'Ask Me' })}>
                    <option>Yes</option><option>Ask Me</option><option>No</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Available for state active duty</label>
                  <select className={inp} value={profile.willingness.supportStateActiveDuty}
                    onChange={e => setWillingness({ supportStateActiveDuty: e.target.value as 'Yes' | 'No' | 'Maybe' })}>
                    <option>Yes</option><option>Maybe</option><option>No</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Support other units</label>
                  <select className={inp} value={profile.willingness.supportOtherUnits}
                    onChange={e => setWillingness({ supportOtherUnits: e.target.value as 'Yes' | 'No' | 'Maybe' })}>
                    <option>Yes</option><option>Maybe</option><option>No</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Maximum travel (miles)</label>
                  <input type="number" min={0} className={inp} value={profile.willingness.maxTravelMiles ?? ''}
                    onChange={e => setWillingness({ maxTravelMiles: Number(e.target.value) || undefined })} />
                </div>
                <div>
                  <label className={lbl}>Willing to mentor others</label>
                  <select className={inp} value={profile.willingness.mentorOthers}
                    onChange={e => setWillingness({ mentorOthers: e.target.value as 'Yes' | 'No' })}>
                    <option>Yes</option><option>No</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* ── 7. About ── */}
          {tab === 'about' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3 text-sm text-gray-700">
              <h2 className="font-bold text-gray-900">How this information is used</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Planners can search for civilian capability when a mission needs it — electricians for temporary power, medical personnel for a shelter, heavy equipment operators for debris clearance.</li>
                <li>Leaders can estimate what civilian capability a community may lose if a unit activates, so they can plan around it.</li>
                <li>Your stated willingness travels with your record so planners see it before they contact you.</li>
              </ul>
              <h3 className="font-bold text-gray-900 pt-2">How it is not used</h3>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Civilian occupation is never an automatic basis for activation, assignment, or exemption.</li>
                <li>Nothing here creates an official personnel record or changes your status in an Army system.</li>
                <li>Self-reported information is labeled as such and never presented as verified.</li>
              </ul>
              <div className="pt-3 border-t">
                <div className="text-xs text-gray-500 mb-2">
                  Data source: {profile.provenance.source}
                  {profile.lastUpdated ? ` · last updated ${profile.lastUpdated}` : ''}
                </div>
                <button onClick={() => { if (confirm('Clear your entire civilian profile from this browser?')) resetCivilian() }}
                  className="text-sm text-red-700 underline">
                  Clear my civilian profile
                </button>
              </div>
            </section>
          )}

          <div className="flex items-center justify-between pt-2">
            <PrototypeNotice scope="This profile" />
            <Link href="/skills" className="text-sm underline text-green-700 font-medium whitespace-nowrap">
              See the statewide skills view →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
