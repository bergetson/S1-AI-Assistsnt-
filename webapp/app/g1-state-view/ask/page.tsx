'use client'

import { ForceAsk } from '@/components/shared/ForceAsk'

// Statewide scope: the G1 asks the same questions of the whole force, so this
// shares ForceAsk rather than reimplementing it. Two roles briefed identically.
export default function G1AskPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ForceAsk scope="state" />
    </div>
  )
}
