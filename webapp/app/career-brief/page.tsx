'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// The Career Brief has been removed — its content lives in Matches (action plans)
// and the Career Planner (grade-by-grade planning).
export default function CareerBriefRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/matches') }, [router])
  return (
    <div className="max-w-xl mx-auto mt-24 text-center px-4">
      <p className="text-gray-600">
        The Career Brief has been consolidated into{' '}
        <Link href="/matches" className="underline text-green-700 font-medium">Position Matches</Link>{' '}
        and the{' '}
        <Link href="/planner" className="underline text-green-700 font-medium">Career Planner</Link>. Redirecting…
      </p>
    </div>
  )
}
