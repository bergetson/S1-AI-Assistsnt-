// ── Structured personnel rules ────────────────────────────────────────────────
// Personnel rules previously lived in two places: the deterministic scoring code
// and the AI prompt text. They drifted. This module is the single source; the AI
// context is GENERATED from it (see lib/rules/aiContext.ts) so the model can
// never be briefed on a different rule than the one the math used.

export type RuleStatus =
  | 'Verified'
  | 'Draft'
  | 'Unverified'
  | 'Outdated'
  | 'Superseded'
  | 'Assumption'

export type RuleTopic =
  | 'Promotion'
  | 'Retention'
  | 'PME'
  | 'Boards'
  | 'Reclassification'
  | 'Assignment'
  | 'Community Impact'

export interface PolicyRule {
  id: string
  topic: RuleTopic
  description: string
  /** Regulation or message that establishes the rule. */
  sourceAuthority: string
  citation?: string
  effectiveDate?: string
  expirationDate?: string
  status: RuleStatus
  lastReviewed?: string
  reviewedBy?: string
  /** Who/what the rule applies to, in plain language. */
  applicability: string
  /** Numeric knobs the deterministic engines read. */
  params?: Record<string, number | string | boolean | null>
  notes?: string
}

/** Statuses that must trigger a visible caution in the UI. */
export const CAUTION_STATUSES: RuleStatus[] = ['Draft', 'Unverified', 'Outdated', 'Superseded', 'Assumption']

export function needsCaution(rule: PolicyRule): boolean {
  return CAUTION_STATUSES.includes(rule.status)
}

export function ruleCaution(rule: PolicyRule): string | null {
  switch (rule.status) {
    case 'Draft': return 'Draft value — not yet confirmed against current policy.'
    case 'Unverified': return 'Unverified — confirm with your S1/G1 before relying on it.'
    case 'Outdated': return 'Known to be outdated. Treat results as indicative only.'
    case 'Superseded': return 'Superseded by newer policy. Do not plan from this.'
    case 'Assumption': return 'Planning assumption, not policy. Adjust to local experience.'
    default: return null
  }
}
