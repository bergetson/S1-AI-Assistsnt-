import type { CityPair } from '../types'

export const MT_CITIES = [
  'Billings', 'Bozeman', 'Butte', 'Great Falls', 'Helena',
  'Kalispell', 'Missoula', 'Miles City', 'Dillon', 'Havre',
  'Lewistown', 'Livingston', 'Glendive', 'Glasgow', 'Wolf Point',
  'Whitefish', 'Anaconda', 'Shelby',
]

const rawPairs: CityPair[] = [
  { from: 'Billings',    to: 'Bozeman',     miles: 144, minutes: 130, route: 'I-90 W' },
  { from: 'Billings',    to: 'Butte',       miles: 223, minutes: 190, route: 'I-90 W' },
  { from: 'Billings',    to: 'Helena',      miles: 221, minutes: 185, route: 'I-90 W / US-12 W' },
  { from: 'Billings',    to: 'Great Falls', miles: 225, minutes: 195, route: 'US-87 N' },
  { from: 'Billings',    to: 'Missoula',    miles: 344, minutes: 285, route: 'I-90 W' },
  { from: 'Billings',    to: 'Kalispell',   miles: 449, minutes: 370, route: 'I-90 W / US-93 N' },
  { from: 'Billings',    to: 'Miles City',  miles: 141, minutes: 125, route: 'I-94 E' },
  { from: 'Billings',    to: 'Dillon',      miles: 302, minutes: 255, route: 'I-90 W / I-15 S' },
  { from: 'Billings',    to: 'Havre',       miles: 231, minutes: 200, route: 'US-87 N' },
  { from: 'Billings',    to: 'Lewistown',   miles: 126, minutes: 115, route: 'US-87 N' },
  { from: 'Billings',    to: 'Livingston',  miles: 115, minutes: 100, route: 'I-90 W' },
  { from: 'Billings',    to: 'Glendive',    miles: 213, minutes: 180, route: 'I-94 E' },
  { from: 'Bozeman',     to: 'Helena',      miles: 95,  minutes: 80,  route: 'I-90 W / US-12 W' },
  { from: 'Bozeman',     to: 'Butte',       miles: 82,  minutes: 70,  route: 'I-90 W' },
  { from: 'Bozeman',     to: 'Missoula',    miles: 199, minutes: 165, route: 'I-90 W' },
  { from: 'Bozeman',     to: 'Great Falls', miles: 225, minutes: 195, route: 'US-89 N' },
  { from: 'Bozeman',     to: 'Kalispell',   miles: 303, minutes: 255, route: 'I-90 W / US-93 N' },
  { from: 'Bozeman',     to: 'Dillon',      miles: 157, minutes: 135, route: 'I-90 W / I-15 S' },
  { from: 'Bozeman',     to: 'Miles City',  miles: 285, minutes: 240, route: 'I-90 E' },
  { from: 'Bozeman',     to: 'Livingston',  miles: 26,  minutes: 25,  route: 'I-90 E' },
  { from: 'Bozeman',     to: 'Havre',       miles: 320, minutes: 270, route: 'US-89 N' },
  { from: 'Helena',      to: 'Great Falls', miles: 91,  minutes: 70,  route: 'I-15 N' },
  { from: 'Helena',      to: 'Missoula',    miles: 113, minutes: 95,  route: 'I-90 W' },
  { from: 'Helena',      to: 'Butte',       miles: 65,  minutes: 55,  route: 'I-15 S' },
  { from: 'Helena',      to: 'Kalispell',   miles: 217, minutes: 180, route: 'US-93 N' },
  { from: 'Helena',      to: 'Dillon',      miles: 124, minutes: 110, route: 'I-15 S' },
  { from: 'Helena',      to: 'Havre',       miles: 183, minutes: 155, route: 'US-89 N' },
  { from: 'Helena',      to: 'Lewistown',   miles: 165, minutes: 140, route: 'US-12 E' },
  { from: 'Helena',      to: 'Miles City',  miles: 330, minutes: 285, route: 'US-12 E / I-94' },
  { from: 'Great Falls', to: 'Havre',       miles: 115, minutes: 95,  route: 'US-87 N' },
  { from: 'Great Falls', to: 'Lewistown',   miles: 105, minutes: 90,  route: 'US-87 E' },
  { from: 'Great Falls', to: 'Missoula',    miles: 198, minutes: 165, route: 'US-89 S / I-90 W' },
  { from: 'Great Falls', to: 'Kalispell',   miles: 222, minutes: 180, route: 'US-89 N' },
  { from: 'Great Falls', to: 'Glasgow',     miles: 228, minutes: 190, route: 'US-2 E' },
  { from: 'Missoula',    to: 'Kalispell',   miles: 118, minutes: 100, route: 'US-93 N' },
  { from: 'Missoula',    to: 'Butte',       miles: 129, minutes: 110, route: 'I-90 E' },
  { from: 'Missoula',    to: 'Dillon',      miles: 189, minutes: 160, route: 'I-90 E / I-15 S' },
  { from: 'Kalispell',   to: 'Whitefish',   miles: 16,  minutes: 20,  route: 'US-93 N' },
  { from: 'Miles City',  to: 'Glendive',    miles: 72,  minutes: 60,  route: 'I-94 E' },
  { from: 'Dillon',      to: 'Butte',       miles: 63,  minutes: 55,  route: 'I-15 N' },
  { from: 'Butte',       to: 'Anaconda',    miles: 25,  minutes: 30,  route: 'MT-1' },
  { from: 'Havre',       to: 'Glasgow',     miles: 171, minutes: 145, route: 'US-2 E' },
  { from: 'Glasgow',     to: 'Wolf Point',  miles: 49,  minutes: 40,  route: 'US-2 E' },
]

// Symmetrize + same-city = 0
const allPairs = new Map<string, CityPair>()
for (const p of rawPairs) {
  allPairs.set(`${p.from}|${p.to}`, p)
  allPairs.set(`${p.to}|${p.from}`, { ...p, from: p.to, to: p.from })
}
for (const city of MT_CITIES) {
  allPairs.set(`${city}|${city}`, { from: city, to: city, miles: 0, minutes: 0, route: 'Same city' })
}

export const cityPairs = Array.from(allPairs.values())

export function getCommute(from: string, to: string): { miles: number; minutes: number; route: string } | null {
  const key = `${from}|${to}`
  const pair = allPairs.get(key)
  if (pair) return { miles: pair.miles, minutes: pair.minutes, route: pair.route }
  return null
}

export function commuteCategory(minutes: number): 'Same City' | 'Short' | 'Medium' | 'Long' | 'Very Long' {
  if (minutes === 0)   return 'Same City'
  if (minutes <= 30)   return 'Short'
  if (minutes <= 90)   return 'Medium'
  if (minutes <= 180)  return 'Long'
  return 'Very Long'
}

export function commuteColor(category: string): string {
  switch (category) {
    case 'Same City': return 'bg-green-100 text-green-800'
    case 'Short':     return 'bg-green-100 text-green-800'
    case 'Medium':    return 'bg-blue-100 text-blue-800'
    case 'Long':      return 'bg-yellow-100 text-yellow-800'
    case 'Very Long': return 'bg-red-100 text-red-800'
    default:          return 'bg-gray-100 text-gray-800'
  }
}
