'use client'

import { ForceAsk } from '@/components/shared/ForceAsk'

// Statewide scope. Shares ForceAsk with /command/ask rather than reimplementing
// it, so a commander and a talent manager are never briefed differently about
// the same force — only the scope differs.
export default function TalentAskPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ForceAsk scope="state" />
    </div>
  )
}
