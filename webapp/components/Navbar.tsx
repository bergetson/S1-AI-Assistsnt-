'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useViewModeStore } from '@/lib/viewModeStore';

const soldierLinks = [
  { label: 'Home', href: '/' },
  { label: 'My Profile', href: '/profile' },
  { label: 'Matches', href: '/matches' },
  { label: 'Planner', href: '/planner' },
  { label: 'Reclass', href: '/reclassification' },
  { label: 'Commute', href: '/commute' },
  { label: 'Counseling', href: '/counseling' },
  { label: 'Ask Steeves', href: '/ai-mentor' },
];

const commanderLinks = [
  { label: 'Home', href: '/' },
  { label: 'Overview', href: '/command' },
  { label: 'Roster', href: '/command/roster' },
  { label: 'Forecast', href: '/command/forecast' },
  { label: 'Succession', href: '/command/succession' },
  { label: 'Import Data', href: '/command/import' },
];

/**
 * Exact match for '/' and '/command' so the Overview link doesn't stay lit while
 * you're on /command/roster; prefix match everywhere else.
 */
function isLinkActive(href: string, pathname: string): boolean {
  if (href === '/' || href === '/command') return pathname === href;
  return pathname.startsWith(href);
}

function ModeToggle({
  mode,
  onSwitch,
}: {
  mode: 'soldier' | 'commander';
  onSwitch: (m: 'soldier' | 'commander') => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5 bg-black/25"
      role="group"
      aria-label="Switch between soldier and commander view"
    >
      {(
        [
          { key: 'soldier', label: 'Soldier', icon: '🎖️' },
          { key: 'commander', label: 'Commander', icon: '🛡️' },
        ] as const
      ).map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => onSwitch(m.key)}
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors duration-150 ${
              active
                ? 'text-green-950 shadow'
                : 'text-gray-300 hover:text-white'
            }`}
            style={active ? { backgroundColor: '#C8A96E' } : undefined}
          >
            {m.icon} {m.label}
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

  // The URL is the source of truth while browsing, so deep-linking into /command
  // shows commander nav even if the stored mode still says 'soldier'.
  const onCommandRoute = pathname.startsWith('/command');
  const activeMode = onCommandRoute ? 'commander' : mode;
  const navLinks = activeMode === 'commander' ? commanderLinks : soldierLinks;

  function switchMode(next: 'soldier' | 'commander') {
    setMode(next);
    setMenuOpen(false);
    // Moving between hats should land somewhere meaningful, not on a dead route.
    if (next === 'commander') router.push('/command');
    else if (onCommandRoute) router.push('/');
  }

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 shadow-md"
      style={{ backgroundColor: '#1B4F2A' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo / Brand */}
          <Link href="/" className="flex items-center space-x-3 group">
            {/* Shield badge */}
            <div className="relative flex-shrink-0">
              <svg width="34" height="38" viewBox="0 0 34 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 1L2 7V20C2 28.5 8.5 35.5 17 37C25.5 35.5 32 28.5 32 20V7L17 1Z"
                  fill="#C8A96E" stroke="#A07840" strokeWidth="1.5"/>
                <text x="17" y="24" textAnchor="middle" fill="#1B4F2A"
                  fontSize="14" fontWeight="bold" fontFamily="serif">S</text>
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-white font-bold text-lg tracking-tight group-hover:text-amber-200 transition-colors">
                Ask Steeves
              </div>
              <div className="text-green-300 text-xs font-medium tracking-wider uppercase">
                {activeMode === 'commander'
                  ? 'Force Management · MT ARNG'
                  : 'S1 Career Manager · MT ARNG'}
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-1">
            <ModeToggle mode={activeMode} onSwitch={switchMode} />
            <div className="w-px h-6 bg-white/20 mx-2" />
            {navLinks.map((link) => {
              const isActive = isLinkActive(link.href, pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
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

          {/* Mobile Hamburger Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="text-white focus:outline-none focus:ring-2 focus:ring-white rounded-md p-2"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                /* X icon */
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div
          className="md:hidden px-4 pb-4 pt-2 space-y-1"
          style={{ backgroundColor: '#1B4F2A' }}
        >
          <div className="pb-2 mb-2 border-b border-white/20">
            <ModeToggle mode={activeMode} onSwitch={switchMode} />
          </div>
          {navLinks.map((link) => {
            const isActive = isLinkActive(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
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
