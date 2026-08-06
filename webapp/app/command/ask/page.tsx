'use client'

import {
  RosterSourceBanner, FormationBar, CommandPrintStyles, useSeedFormation,
} from '@/components/command/CommandShell'
import { ForceAsk } from '@/components/shared/ForceAsk'

export default function CommandAskPage() {
  useSeedFormation()
  return (
    <div className="min-h-screen bg-gray-50">
      <RosterSourceBanner />
      <FormationBar />
      <ForceAsk scope="formation" />
      <CommandPrintStyles />
    </div>
  )
}
