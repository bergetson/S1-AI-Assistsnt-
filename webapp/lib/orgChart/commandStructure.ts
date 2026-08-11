import type { UnitType } from './types'

// ── The top of the tree ───────────────────────────────────────────────────────
// Transcribed from the org chart MTARNG publishes ("Montana Army National Guard
// JFHQ — click on any unit for their address").
//
// This table exists because the MTOE extract encodes ACCOUNTING rollups, not
// COMMAND relationships. Three specific gaps it fills:
//
//   1. There is no root. `bde` has four disconnected values and JFHQ sits
//      inside one of them as a peer battalion, so nothing in the data says
//      JFHQ is on top. Organizationally it is.
//   2. The JFHQ battalion's four UICs are recognisable units in their own
//      right — HHD JFHQ, the Army Element, and the JAG team — and the published
//      chart draws them as separate boxes rather than one lump.
//   3. Rollup names are accounting labels ('190TH ROLLUP', '95TH TC BDE
//      ROLLUP'). People say "190th CSB" and "95th Troop Command".
//
// Everything BELOW this table is derived from the data. Keep it small: if you
// find yourself adding company-level entries, the builder should be deriving
// them instead.
//
// When the structure changes, this is the file to edit. Anything the table does
// not place still appears in the chart, under "Unmapped formations" — that node
// is the signal this table needs attention, so never filter it out.

export const COMMAND_CHART_SOURCE = 'MTARNG published JFHQ org chart'

export interface FormationEntry {
  /** Node id fragment; also the expand key. */
  key: string
  label: string
  unitType: UnitType
  /** `bde` values from the extract that roll into this formation. */
  bdes?: string[]
  /** `bn` values that roll into it. */
  bns?: string[]
  /** Individual UICs that the published chart draws as their own box. */
  uics?: string[]
  /** Shown under the label. */
  note?: string
}

/**
 * The root. JFHQ's own billets stay with it; the formations below are its
 * children on the published chart.
 */
export const ROOT_FORMATION: FormationEntry = {
  key: 'jfhq',
  label: 'JFHQ — Montana',
  unitType: 'staff',
  note: 'Joint Force Headquarters',
}

/**
 * Direct children of JFHQ, in the order the published chart reads.
 *
 * The two big commands map cleanly onto `bde` values — the extract and the
 * chart agree there. The staff boxes are single UICs the chart names, and the
 * Training Center is its own brigade-level rollup.
 */
export const JFHQ_CHILDREN: FormationEntry[] = [
  {
    key: 'hhd-jfhq',
    label: 'HHD JFHQ',
    unitType: 'staff',
    uics: ['W8ALAA', 'W8ALHD'],
    note: 'Headquarters and Headquarters Detachment',
  },
  {
    key: 'army-element',
    label: 'Army Element',
    unitType: 'staff',
    uics: ['W935AA'],
  },
  {
    key: 'jag',
    label: 'JAG',
    unitType: 'staff',
    uics: ['WPMMAA'],
    note: 'Field trial defense team',
  },
  {
    key: '1889-rsg',
    label: '1889th Regional Support Group',
    unitType: 'command',
    bdes: ['1889TH SUPPORT GROUP'],
  },
  {
    key: '95-tc',
    label: '95th Troop Command',
    unitType: 'command',
    bdes: ['95TH TC BDE ROLLUP'],
  },
  {
    key: 'training-center',
    label: 'Training Center',
    unitType: 'training',
    bdes: ['MTARNG TRNG CTR, FT HARRISON ROLL UP'],
    note: 'Garrison Command, Fort Harrison',
  },
]

/**
 * Readable names for the accounting rollups. Left-hand side is the literal `bn`
 * value in the extract; right-hand side is what people call it.
 *
 * Only rollup labels belong here. Real unit names ('1ST BATTALION, 163D
 * INFANTRY REGIMENT') are already readable and are tidied generically.
 */
export const BN_DISPLAY_NAMES: Record<string, string> = {
  '190TH ROLLUP': '190th Combat Sustainment Battalion',
  '495TH ROLLUP': '495th Combat Sustainment Battalion',
  'HHC, 1889TH SUPPORT GROUP': 'HHC, 1889th Support Group',
  '95TH TROOP COMMAND': '95th Troop Command HQ',
  'MONTANA ARNG RECRUITING & RETENTION BATTALION': 'Recruiting & Retention Battalion',
  'MONTANA MEDICAL READINESS DETACHMENT': 'Montana Medical Detachment',
  '208TH REGIMENT - MONTANA ARNG RTI': '208th Regiment (RTI)',
  '83D CIVIL SUPPORT TEAM': '83rd Civil Support Team',
  'MTARNG TRAINING CENTER, FT WILLIAM HARRISON': 'MTARNG Training Center',
  'ARNG STAFF ELEMENT, JOINT FORCE HEADQUARTERS-MONTANA': 'JFHQ Staff Element',
  '1ST BATTALION, 163D INFANTRY REGIMENT': '1-163 Infantry',
  '1ST BATTALION, 189TH AVIATION REGIMENT': '1-189 Aviation',
}

/**
 * Readable name for every UIC in the extract.
 *
 * The raw `unit` strings are fixed-width MTOE fragments ('0163 IN BN CO A RIFLE
 * COMP', 'AUGOE8ALHD') that no generic tidier can turn into something a soldier
 * would recognise. Names here come from the numeric designators in the S1's
 * notes against the published chart, plus the MTOE unit strings themselves.
 *
 * A UIC missing from this map falls back to its extract name — always correct,
 * just less readable — so an incomplete map degrades rather than breaks.
 */
export const UIC_DESIGNATORS: Record<string, string> = {
  // JFHQ
  W8ALAA: 'HHD JFHQ-MT',
  W8ALHD: 'JFHQ Augmentation',
  W935AA: 'Army Element, JFHQ',
  WPMMAA: '3777th Field Trial Defense Team',

  // 1-163 Infantry
  WTCPT0: 'HHC, 1-163 Infantry',
  WTCPA0: 'A Company, 1-163 Infantry',
  WTCPA1: 'A Company — DET 1',
  WTCPB0: 'B Company, 1-163 Infantry',
  WTCPC0: 'C Company, 1-163 Infantry',
  WTCPD0: 'D Company (Multi-Purpose)',
  WTHAAA: 'Combat Logistics Company',

  // 1-189 Aviation
  WYQST0: 'HHC, 1-189 Aviation',
  WYQST2: 'HHC — DET 2',
  WYQSA0: 'A Company (Command Aviation)',
  WYQSA1: 'A Company — DET 1',
  WYQSB1: 'B Company — DET 1',
  WYQSC1: 'C Company — DET 1',
  WYQSC2: 'C Company — DET 2',
  WYQSD0: 'D Company (Aviation Maintenance)',
  WYQSD5: 'D Company — DET 5',
  WYQSE0: 'E Company (Forward Support)',
  WYQSE6: 'E Company — DET 6',
  WPJPB4: '834th Support — B Company DET 4',
  WPLLB7: '2-245 Aviation — B Company DET 7',
  WQRQA2: '1-112 Aviation — A Company DET 2',
  W7Y441: 'MTARNG OSA Command — DET 41',

  // 190th CSB
  WY2LAA: 'HHC, 190th CSB',
  WPLUAA: '1063rd Maintenance Company',
  WPLUA1: '1063rd Maintenance — DET 1',
  WPSDAA: '143rd MP Detachment',
  WX2QAA: '260th Engineer Company',
  WX2QA1: '260th Engineer — DET 1',
  WX2QA2: '260th Engineer — DET 2',
  WX8XAA: '484th MP Company',
  WX8XA1: '484th MP — DET 1',

  // 495th CSB
  WPBQAA: 'HHC, 495th CSB',
  WPEJA0: 'A Company, 372nd Support',
  WPEJA1: '372nd Support — DET 1',
  WPEJA2: '372nd Support — DET 2',
  WPQGAA: '631st CBRN Company',
  WX2YA1: '230th Engineer — DET 1',
  WY45AA: '190th CBRN Recon Detachment',
  WTWPAA: '1049th Engineer Firefighting Team',
  WP3HAA: '1050th Engineer Firefighting Team',
  WP3JAA: '1051st Engineer Firefighting Team',
  WP3KAA: '1052nd Engineer Firefighting Team',

  // 1889th RSG
  WPT2AA: 'HHD, 1889th RSG',
  WX5GAA: '103rd Public Affairs Detachment',

  // 95th Troop Command and separate units
  W78QAA: '95th Troop Command HQ',
  W7MPAA: '83rd Civil Support Team',
  W8GJAA: '208th Regiment (RTI)',
  W8ZGAA: 'Montana Medical Detachment',
  W903AA: 'Recruiting & Retention Battalion',
  W903A1: 'Recruiting & Retention — DET 1',
  W903HD: 'R&R Augmentation',

  // Training Center
  W917AA: 'MTARNG Training Center',
  WPXVAA: '900th QM Platoon (Field Feeding)',
  WPXVA1: '900th QM — DET 1',
}

/** Every `bde` value the table claims, for the unmapped check. */
export const MAPPED_BDES = new Set(JFHQ_CHILDREN.flatMap(f => f.bdes ?? []))

/** Every UIC the table claims directly, for the unmapped check. */
export const MAPPED_UICS = new Set(JFHQ_CHILDREN.flatMap(f => f.uics ?? []))
