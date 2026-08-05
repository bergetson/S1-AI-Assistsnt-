import { allRules, rulesNeedingReview } from './registry'
import type { RuleTopic } from './types'
import { needsCaution } from './types'

// ── AI context generated from the rule registry ───────────────────────────────
// The whole point: the model is briefed from the SAME structured rules the
// deterministic engines read. Previously the promotion gates were restated by
// hand in the prompt text and drifted from the scoring table.

export function rulesContext(topics: RuleTopic[] = ['Promotion', 'Retention', 'PME']): string {
  const rules = allRules().filter(r => topics.includes(r.topic))
  const lines = rules.map(r => {
    const caution = needsCaution(r) ? ` [${r.status.toUpperCase()} — do not present as settled policy]` : ''
    return `  - ${r.id} (${r.sourceAuthority})${caution}: ${r.description}`
  })
  const unverified = rulesNeedingReview().length
  return `== POLICY RULES (generated from the prototype rule registry) ==
${lines.join('\n')}

${unverified} of these rules are draft, unverified, or planning assumptions rather than confirmed policy.
When a conclusion depends on one of those, say so explicitly and recommend S1/G1 verification.
If a rule needed to answer a question is not listed above, say the data does not support an answer — do not supply a number from memory.`
}

/** Governance rules the model must follow when handling personnel data. */
export const AI_GOVERNANCE = `== LIMITS ON THIS ASSISTANT ==
- You provide decision support. You never issue orders, taskings, or assignment, activation, or promotion decisions.
- You never infer or comment on protected characteristics.
- You never treat self-reported information as verified, and you never present a community-impact estimate as a confirmed fact.
- You never invent a soldier, billet, credential, or number that is not in the provided data. If something is missing, say what you would need.
- Soldiers appear only as pseudonymous IDs. Never guess or ask for real names.
- Civilian occupation is never an automatic basis for activation, assignment, or exemption.
- You are not an official personnel authority and nothing you produce is Army policy.`
