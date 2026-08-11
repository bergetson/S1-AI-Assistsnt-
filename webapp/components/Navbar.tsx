'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  useViewModeStore, modeForPath, VIEW_MODE_LABEL, VIEW_MODE_ICON,
  VIEW_MODE_HOME, VIEW_MODE_SUBTITLE, type ViewMode,
} from '@/lib/viewModeStore';

const NAV: Record<ViewMode, Array<{ label: string; href: string }>> = {
  soldier: [
    { label: 'Home', href: '/' },
    { label: 'Military Profile', href: '/profile' },
    { label: 'Civilian Profile', href: '/civilian-profile' },
    { label: 'Matches', href: '/matches' },
    { label: 'Planner', href: '/planner' },
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Force Structure', href: '/force-structure' },
    { label: 'Reclass', href: '/reclassification' },
    { label: 'Counseling', href: '/counseling' },
    { label: 'Ask Steeves', href: '/ai-mentor' },
  ],
  commander: [
    { label: 'Overview', href: '/command' },
    { label: 'Org Chart', href: '/command/org' },
    { label: 'Roster', href: '/command/roster' },
    { label: 'Forecast', href: '/command/forecast' },
    { label: 'Succession', href: '/command/succession' },
    { label: 'Ask Steeves', href: '/command/ask' },
    { label: 'Civilian Skills', href: '/skills' },
    { label: 'Community Impact', href: '/community-impact' },
    { label: 'Mission Builder', href: '/mission-builder' },
    { label: 'Import', href: '/command/import' },
  ],
  talent: [
    { label: 'Dashboard', href: '/talent' },
    { label: 'Vacancies', href: '/talent/vacancies' },
    { label: 'Marketplace', href: '/talent/marketplace' },
    { label: 'Civilian Skills', href: '/skills' },
    { label: 'Mission Builder', href: '/mission-builder' },
    { label: 'Data Quality', href: '/talent/data-quality' },
    { label: 'Policy Rules', href: '/talent/rules' },
  ],
  g1: [
    { label: 'State Overview', href: '/g1-state-view' },
    { label: 'Org Chart', href: '/g1-state-view/org' },
    { label: 'Ask Steeves', href: '/g1-state-view/ask' },
    { label: 'Civilian Skills', href: '/skills' },
    { label: 'Community Impact', href: '/community-impact' },
    { label: 'Mission Builder', href: '/mission-builder' },
    { label: 'Data Quality', href: '/talent/data-quality' },
  ],
};

const MODES: ViewMode[] = ['soldier', 'commander', 'talent', 'g1'];

/**
 * Exact match for role landing pages so their link does not stay lit while the
 * user is on a child route; prefix match everywhere else.
 */
function isLinkActive(href: string, pathname: string): boolean {
  if (href === '/' || href === '/command' || href === '/talent') return pathname === href;
  return pathname.startsWith(href);
}

function ModeToggle({ mode, onSwitch, stacked }: {
  mode: ViewMode;
  onSwitch: (m: ViewMode) => void;
  stacked?: boolean;
}) {
  return (
    <div
      className={stacked ? 'grid grid-cols-2 gap-1' : 'inline-flex rounded-lg p-0.5 bg-black/25'}
      role="group"
      aria-label="Switch role view"
    >
      {MODES.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onSwitch(m)}
            aria-pressed={active}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-amber-300 ${
              active ? 'text-green-950 shadow' : 'text-gray-300 hover:text-white'
            }`}
            style={active ? { backgroundColor: '#C8A96E' } : undefined}
          >
            {VIEW_MODE_ICON[m]} {VIEW_MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, setMode } = useViewModeStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // The URL wins while browsing, so a deep link into /talent shows talent nav
  // regardless of the stored mode.
  const activeMode: ViewMode = modeForPath(pathname) ?? mode;
  const navLinks = NAV[activeMode];

  function switchMode(next: ViewMode) {
    setMode(next);
    setMenuOpen(false);
    router.push(VIEW_MODE_HOME[next]);
  }

  return (
    <nav className="fixed top-0 left-0 w-full z-50 shadow-md" style={{ backgroundColor: '#1B4F2A' }}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href={VIEW_MODE_HOME[activeMode]} className="flex items-center space-x-3 group flex-shrink-0">
            <div className="relative flex-shrink-0">
              <svg width="34" height="38" viewBox="0 0 34 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M17 1L2 7V20C2 28.5 8.5 35.5 17 37C25.5 35.5 32 28.5 32 20V7L17 1Z"
                  fill="#C8A96E" stroke="#A07840" strokeWidth="1.5" />
                <text x="17" y="24" textAnchor="middle" fill="#1B4F2A"
                  fontSize="14" fontWeight="bold" fontFamily="serif">S</text>
              </svg>
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-white font-bold text-lg tracking-tight group-hover:text-amber-200 transition-colors">
                Ask Steeves
              </div>
              <div className="text-green-300 text-[10px] font-medium tracking-wider uppercase">
                {VIEW_MODE_SUBTITLE[activeMode]}
              </div>
            </div>
          </Link>

          {/* Desktop */}
          <div className="hidden xl:flex items-center gap-2 flex-1 justify-end">
            <ModeToggle mode={activeMode} onSwitch={switchMode} />
            <div className="w-px h-6 bg-white/20" />
            <div className="flex items-center space-x-0.5">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-2.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                      isActive
                        ? 'bg-white/20 text-white underline underline-offset-4'
                        : 'text-gray-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile / tablet */}
          <div className="xl:hidden">
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="text-white focus:outline-none focus:ring-2 focus:ring-white rounded-md p-2"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="xl:hidden px-4 pb-4 pt-2 space-y-1 max-h-[75vh] overflow-y-auto"
          style={{ backgroundColor: '#1B4F2A' }}>
          <div className="pb-3 mb-2 border-b border-white/20">
            <ModeToggle mode={activeMode} onSwitch={switchMode} stacked />
          </div>
          {navLinks.map((link) => {
            const isActive = isLinkActive(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-white/20 text-white underline underline-offset-4'
                    : 'text-gray-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
