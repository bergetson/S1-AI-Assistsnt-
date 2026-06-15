'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// The Career Timeline has been consolidated into the Career Planner.
export default function TimelineRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/planner') }, [router])
  return (
    <div className="max-w-xl mx-auto mt-24 text-center px-4">
      <p className="text-gray-600">
        The Career Timeline is now part of the{' '}
        <Link href="/planner" className="underline text-green-700 font-medium">Career Planner</Link>. Redirecting…
      </p>
    </div>
  )
}
