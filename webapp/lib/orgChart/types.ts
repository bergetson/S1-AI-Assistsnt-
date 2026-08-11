import type { Position } from '../types'

// ── Force structure as a tree ─────────────────────────────────────────────────
// The MTOE extract is flat: every billet carries bde / bn / uic / paraLine as
// strings. That is enough to rebuild the organization, but only after two
// things the extract does not give you:
//
//   1. A root. JFHQ appears as a battalion inside one of four brigade rollups,
//      not above them. See commandStructure.ts.
//   2. A company level. UIC character 5 is the company letter and character 6
//      the detachment number, but nothing models it as a field.

export type OrgLevel = 'root' | 'formation' | 'battalion' | 'company' | 'section'

/** Matches the colour convention of the published MTARNG chart. */
export type UnitType = 'command' | 'training' | 'staff' | 'support'

export interface OrgNode {
  /** Stable path key. Also the React key and the expand/collapse identity. */
  id: string
  level: OrgLevel
  /** What a soldier would call it — '495th CSB', never a bare UIC. */
  label: string
  /** Armory town, or 'DET 1', or the MTOE paragraph. */
  sublabel?: string
  unitType?: UnitType
  /** Armory town for this node, when it has exactly one. */
  city?: string
  /** The UIC this node IS, for company nodes. */
  uic?: string
  /** Every UIC at or beneath this node, so the uics-based analytics all apply. */
  uics: string[]
  /** Billets held directly by this node. Only section nodes carry any. */
  billets: Position[]
  children: OrgNode[]

  // ── Rolled up bottom-up, once, at build time ──
  /** Authorized billets beneath. Excludes `authorized === false`. */
  authorized: number
  /** Soldiers assigned beneath, including those against unauthorized lines. */
  assigned: number
  /** Assigned against a TEMPLET / Standard Excess line — real over-strength. */
  unauthorizedAssigned: number
  /** Total billets beneath, authorized or not. Used for conservation checks. */
  billetCount: number

  /**
   * True where this node's parent relationship comes from the published MTARNG
   * org chart rather than from the MTOE extract. Surfaced in the UI — the app
   * should never quietly assert structure the source data does not contain.
   */
  fromPublishedChart?: boolean
  /** True where the label was inferred from the group's senior billet. */
  inferredLabel?: boolean
  /** True for the trailing TEMPLET / Standard Excess bucket. */
  unauthorizedBucket?: boolean
}

export interface OrgTree {
  root: OrgNode
  /** Every node by id, for lookup without walking. */
  byId: Map<string, OrgNode>
  /** Parent id for each node id, for breadcrumbs. */
  parentOf: Map<string, string>
}
