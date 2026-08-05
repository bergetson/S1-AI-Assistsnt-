// ── Action feed ───────────────────────────────────────────────────────────────
// The app used to answer "what is" — fill rates, distributions, tables. A
// commander opening it between meetings needs "what do I do." Every item here
// is an answer with an action attached, ranked so the top of the list is the
// thing that matters most today.
//
// Design rules:
//   - The headline IS the answer. Bottom line up front, no lede.
//   - Every item names a concrete next action and links to where to do it.
//   - Nothing appears without a reason a human would care about it.
//   - Items that cannot be computed say so instead of being silently omitted.

export type ActionRole = 'commander' | 'talent' | 'g1'

export type Urgency = 'Act now' | 'This month' | 'This quarter' | 'Monitor'

export const URGENCY_ORDER: Record<Urgency, number> = {
  'Act now': 0, 'This month': 1, 'This quarter': 2, Monitor: 3,
}

export type Severity = 'critical' | 'high' | 'moderate' | 'info'

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0, high: 1, moderate: 2, info: 3,
}

export interface ActionItem {
  id: string
  roles: ActionRole[]
  urgency: Urgency
  severity: Severity
  /** The answer, in plain language. "You have no successor for 3 key billets." */
  headline: string
  /** Why it matters — one sentence, no jargon. */
  why: string
  /** The concrete next step. */
  action: string
  /** Where to do it. */
  href: string
  linkLabel: string
  /** Optional supporting count shown as a badge. */
  count?: number
  /** Named examples so the item is verifiable, not a black box. */
  examples?: string[]
  /** Set when the finding is limited by missing data. */
  caveat?: string
}

export function sortActions(items: ActionItem[]): ActionItem[] {
  return [...items].sort((a, b) =>
    URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    (b.count ?? 0) - (a.count ?? 0) ||
    a.id.localeCompare(b.id))
}

export function actionsForRole(items: ActionItem[], role: ActionRole): ActionItem[] {
  return sortActions(items.filter(i => i.roles.includes(role)))
}
