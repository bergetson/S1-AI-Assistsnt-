'use client'

import { OrgChartView } from '@/components/shared/OrgChartView'

// Same component as /command/org. The chart is the whole force either way, so
// the two roles cannot end up looking at different shapes of the organization.
export default function TalentOrgPage() {
  return <OrgChartView mode="manager" />
}
