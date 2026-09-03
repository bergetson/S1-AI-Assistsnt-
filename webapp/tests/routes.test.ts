import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NAV } from '@/components/Navbar'
import { modeForPath, VIEW_MODE_HOME, type ViewMode } from '@/lib/viewModeStore'
import { buildActions } from '@/lib/actions/build'
import { positions } from '@/lib/data/positions'
import { realRoster } from '@/lib/data/realRoster'

const APP = path.resolve(import.meta.dirname, '..', 'app')

/**
 * A link in this app is a string, so nothing but a test stops one from
 * outliving the page it points at. The G1 State View merged into the talent
 * manager's and moved three routes; an action was still linking at the old
 * path, which nothing caught.
 */
function routeExists(href: string): boolean {
  const clean = href.split('?')[0].split('#')[0]
  if (clean === '/') return fs.existsSync(path.join(APP, 'page.tsx'))
  const dir = path.join(APP, ...clean.replace(/^\//, '').split('/'))
  return fs.existsSync(path.join(dir, 'page.tsx'))
}

describe('every internal link points at a page that exists', () => {
  it('for every navbar entry', () => {
    for (const [mode, items] of Object.entries(NAV)) {
      for (const item of items) {
        if ('divider' in item) continue
        expect(routeExists(item.href), `${mode} nav → ${item.href}`).toBe(true)
      }
    }
  })

  it('for every role landing page', () => {
    for (const href of Object.values(VIEW_MODE_HOME)) {
      expect(routeExists(href), `home → ${href}`).toBe(true)
    }
  })

  it('for every action feed link', () => {
    // The real force, not a fixture: an action only carries a link when its
    // condition fires, and a two-billet fixture fires almost none of them —
    // which made an earlier version of this test pass while checking nothing.
    const uics = [...new Set(positions.map(p => p.uic).filter(Boolean) as string[])]
    const items = buildActions({
      positions, roster: realRoster, uics, civilian: new Map(), applications: [],
      baseYear: 2026, asOfIso: '2026-06-01',
    })
    const linked = items.filter(i => i.href)
    expect(linked.length).toBeGreaterThan(4)
    for (const i of linked) {
      expect(routeExists(i.href!), `action ${i.id} → ${i.href}`).toBe(true)
      // Existing is not enough: the old G1 paths still exist as redirect
      // stubs, so a stale link would pass the check above while bouncing the
      // user through a redirect to get where it should have sent them.
      expect(i.href!.startsWith('/g1-state-view'), `action ${i.id} links at a retired route`).toBe(false)
    }
  })
})

describe('the retired G1 view still resolves', () => {
  it('keeps a redirect stub at every old path', () => {
    for (const old of ['/g1-state-view', '/g1-state-view/org', '/g1-state-view/ask']) {
      expect(routeExists(old), `stub missing for ${old}`).toBe(true)
    }
  })

  it('shows the talent nav while the stub redirects, not a blank one', () => {
    // modeForPath returning null would fall back to whatever hat the user last
    // wore, so a G1 bookmark could flash the soldier nav on the way through.
    for (const old of ['/g1-state-view', '/g1-state-view/org', '/g1-state-view/ask']) {
      expect(modeForPath(old)).toBe('talent')
    }
  })

  it('routes the new paths to the talent hat', () => {
    for (const p of ['/talent', '/talent/state', '/talent/org', '/talent/ask']) {
      expect(modeForPath(p)).toBe('talent')
    }
  })

  it('has no nav entry left pointing into the old tree', () => {
    for (const items of Object.values(NAV)) {
      for (const item of items) {
        if ('divider' in item) continue
        expect(item.href.startsWith('/g1-state-view')).toBe(false)
      }
    }
  })

  it('offers exactly three hats', () => {
    const modes = Object.keys(NAV) as ViewMode[]
    expect(modes.sort()).toEqual(['commander', 'soldier', 'talent'])
  })
})
