'use client'

import { cn } from '@/lib/utils'
import type {
  Eligibility, Readiness, Strength, NeedLevel, QualFit, CivilianFit, Gap,
} from '@/lib/recommendation'
import type { VerificationStatus } from '@/lib/civilian/types'
import type { ImpactLevel } from '@/lib/communityImpact/types'
import type { DataProvenance } from '@/lib/provenance'
import { provenanceLabel } from '@/lib/provenance'

// Reusable badges so a dimension looks the same everywhere it appears, and so
// "Unknown" is always visually distinct from a low-but-known value.

const BASE = 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap'

function Pill({ tone, children, title }: {
  tone: 'good' | 'ok' | 'warn' | 'bad' | 'unknown' | 'neutral'
  children: React.ReactNode
  title?: string
}) {
  const tones = {
    good: 'bg-green-100 text-green-800 border border-green-200',
    ok: 'bg-blue-100 text-blue-800 border border-blue-200',
    warn: 'bg-amber-100 text-amber-800 border border-amber-200',
    bad: 'bg-red-100 text-red-800 border border-red-200',
    // Dashed border marks "we don't know" apart from "we know it's fine".
    unknown: 'bg-gray-50 text-gray-600 border border-dashed border-gray-400',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
  }
  return <span className={cn(BASE, tones[tone])} title={title}>{children}</span>
}

export function EligibilityBadge({ value, title }: { value: Eligibility; title?: string }) {
  const tone = value === 'Eligible' ? 'good'
    : value === 'Conditionally Eligible' ? 'warn'
    : value === 'Not Eligible' ? 'bad' : 'unknown'
  return <Pill tone={tone} title={title}>{value}</Pill>
}

export function ReadinessBadge({ value }: { value: Readiness }) {
  const tone = value === 'Ready Now' ? 'good'
    : value === 'Ready in 0-6 Months' ? 'ok'
    : value === 'Ready in 6-18 Months' ? 'warn'
    : value === 'Developmental Candidate' ? 'warn'
    : value === 'Not Currently Feasible' ? 'bad' : 'unknown'
  return <Pill tone={tone}>{value}</Pill>
}

export function StrengthBadge({ value, label }: { value: Strength | QualFit | CivilianFit; label?: string }) {
  const tone = value === 'Strong' ? 'good'
    : value === 'Moderate' ? 'ok'
    : value === 'Weak' ? 'warn'
    : value === 'Blocking Gap' ? 'bad'
    : value === 'Not Relevant' ? 'neutral' : 'unknown'
  return <Pill tone={tone}>{label ? `${label}: ` : ''}{value}</Pill>
}

export function NeedBadge({ value }: { value: NeedLevel }) {
  const tone = value === 'Critical' ? 'bad'
    : value === 'High' ? 'warn'
    : value === 'Moderate' ? 'ok'
    : value === 'Low' ? 'neutral' : 'unknown'
  return <Pill tone={tone}>Need: {value}</Pill>
}

export function VerificationBadge({ value }: { value: VerificationStatus }) {
  const tone = value === 'Document Verified' ? 'good'
    : value === 'Leader Reviewed' ? 'ok'
    : value === 'Self Reported' ? 'warn'
    : value === 'Expired' ? 'bad' : 'unknown'
  const icon = value === 'Document Verified' ? '✓' : value === 'Expired' ? '✕' : ''
  return <Pill tone={tone} title={
    value === 'Self Reported' ? 'Reported by the soldier and not independently checked.' :
    value === 'Expired' ? 'Credential is past its expiration date.' : undefined
  }>{icon} {value}</Pill>
}

export function ImpactBadge({ value }: { value: ImpactLevel }) {
  const tone = value === 'Critical' ? 'bad'
    : value === 'High' ? 'bad'
    : value === 'Moderate' ? 'warn'
    : value === 'Low' ? 'good' : 'unknown'
  return <Pill tone={tone} title={
    value === 'Unknown' ? 'Insufficient civilian data to assess. Not the same as low impact.' : undefined
  }>Community: {value}</Pill>
}

export function ProvenanceBadge({ value }: { value: DataProvenance | undefined }) {
  const demo = value?.source === 'Demo' || value?.source === 'Synthetic'
  return (
    <Pill tone={demo ? 'bad' : value?.verified ? 'good' : 'unknown'}
      title={value?.notes}>
      {provenanceLabel(value)}
    </Pill>
  )
}

export function DemoPill() {
  return <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-bold align-middle">DEMO</span>
}

/** Explicit callout for data that is absent — never hide this in a tooltip. */
export function MissingDataNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-gray-700 bg-gray-50 border border-dashed border-gray-400 rounded p-2">
      <span className="font-semibold">Missing data: </span>{children}
    </div>
  )
}

const GAP_TONE: Record<Gap['severity'], string> = {
  'Hard Blocker': 'border-red-300 bg-red-50 text-red-900',
  'Significant Gap': 'border-amber-300 bg-amber-50 text-amber-900',
  'Development Opportunity': 'border-blue-200 bg-blue-50 text-blue-900',
  'Missing Data': 'border-gray-400 border-dashed bg-gray-50 text-gray-700',
}

export function GapList({ gaps }: { gaps: Gap[] }) {
  if (gaps.length === 0) {
    return <p className="text-xs text-green-700">No blockers or gaps identified.</p>
  }
  return (
    <ul className="space-y-1.5">
      {gaps.map((g, i) => (
        <li key={i} className={cn('rounded border p-2 text-xs', GAP_TONE[g.severity])}>
          <div className="font-semibold">{g.severity}: {g.label}</div>
          <div className="mt-0.5">{g.detail}</div>
          <div className="mt-1">
            <span className="font-medium">Action: </span>{g.recommendedAction}
            {g.timeline && <span className="text-gray-600"> · {g.timeline}</span>}
            {g.responsibleParty && <span className="text-gray-600"> · {g.responsibleParty}</span>}
          </div>
          {g.ruleId && <div className="mt-0.5 opacity-70 font-mono text-[10px]">Basis: {g.ruleId}</div>}
        </li>
      ))}
    </ul>
  )
}

/** Factor table with excluded factors visibly marked rather than dropped. */
export function FactorList({ factors }: {
  factors: Array<{ label: string; value?: string; detail: string; points?: number; max?: number; excluded?: boolean }>
}) {
  return (
    <div className="space-y-1">
      {factors.map((f, i) => (
        <div key={i} className={cn('text-xs flex justify-between gap-3 border-b border-gray-100 py-1',
          f.excluded && 'opacity-70')}>
          <span className="font-medium text-gray-700 flex-shrink-0">{f.label}</span>
          <span className="text-gray-500 text-right flex-1">{f.detail}</span>
          <span className="font-bold text-gray-800 w-14 text-right flex-shrink-0">
            {f.excluded ? '—' : f.points != null && f.max ? `${f.points}/${f.max}` : f.value ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * States exactly which parts of what you are looking at are real. The billets
 * are current MTARNG force structure; only people and civilian capability can
 * be synthetic, and conflating the two is what makes a demo misleading.
 */
export function DataSourceBanner({
  rosterIsDemo, civilianIsSynthetic, positionCount,
}: {
  rosterIsDemo: boolean
  civilianIsSynthetic: boolean
  positionCount?: number
}) {
  if (!rosterIsDemo && !civilianIsSynthetic) return null
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <span className="font-bold">What is real here: </span>
      the {positionCount ? `${positionCount.toLocaleString()} ` : ''}billets, units, grades, MOSs, and
      locations come from the current MTARNG force structure.
      <span className="font-bold"> What is synthetic: </span>
      {rosterIsDemo && 'the people occupying those billets'}
      {rosterIsDemo && civilianIsSynthetic && ', and '}
      {civilianIsSynthetic && 'all civilian occupations, skills, credentials, and willingness'}
      {' '}— generated deterministically for demonstration. No real personnel are represented.
    </div>
  )
}

/** Standing banner: nothing in this prototype is an official personnel action. */
export function PrototypeNotice({ scope = 'This view' }: { scope?: string }) {
  return (
    <p className="text-xs text-gray-500 border-l-2 border-gray-300 pl-2">
      {scope} is a prototype for planning and workflow validation. It does not represent
      assignment authority, official orders, or an authoritative personnel record.
    </p>
  )
}
