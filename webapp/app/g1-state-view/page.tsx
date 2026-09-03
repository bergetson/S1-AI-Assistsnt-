'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// The G1 State View and the Talent Manager view were the same statewide
// audience under two names. They are now one role at /talent.
export default function G1Redirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/talent/state') }, [router])
  return (
    <div className="max-w-xl mx-auto mt-24 text-center px-4">
      <p className="text-gray-600">
        The G1 State View is now part of the{' '}
        <Link href="/talent/state" className="underline text-green-700 font-medium">Talent Manager</Link> view. Redirecting…
      </p>
    </div>
  )
}
