'use client'

import Link from 'next/link'
import { useProfileStore } from '@/lib/store'

/* ── Star SVG (decorative) ───────────────────────────────────────────────── */
function Star({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

/* ── S1 Shield (custom, matches the green/gold palette) ──────────────────── */
function BranchCrest({ size = 90 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 100 115"
      className="drop-shadow-2xl"
      aria-label="Ask Steeves S1 Shield"
      role="img"
    >
      <defs>
        <linearGradient id="shieldGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0c080" />
          <stop offset="50%" stopColor="#C8A96E" />
          <stop offset="100%" stopColor="#a8854a" />
        </linearGradient>
        <linearGradient id="shieldGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a6b3d" />
          <stop offset="100%" stopColor="#123620" />
        </linearGradient>
      </defs>

      {/* Outer gold shield */}
      <path
        d="M50 2 L95 14 V52 C95 82 76 102 50 113 C24 102 5 82 5 52 V14 Z"
        fill="url(#shieldGold)"
      />
      {/* Inner green field */}
      <path
        d="M50 9 L88 19.5 V52 C88 78 72 95.5 50 105.5 C28 95.5 12 78 12 52 V19.5 Z"
        fill="url(#shieldGreen)"
      />
      {/* Thin gold inner line */}
      <path
        d="M50 14 L83 23.5 V52 C83 75 69 91 50 100 C31 91 17 75 17 52 V23.5 Z"
        fill="none"
        stroke="#C8A96E"
        strokeWidth="1.2"
        opacity="0.7"
      />

      {/* Gold star */}
      <path
        d="M50 24 L53.3 33.2 L63 33.2 L55.2 39 L58.3 48.2 L50 42.6 L41.7 48.2 L44.8 39 L37 33.2 L46.7 33.2 Z"
        fill="url(#shieldGold)"
      />

      {/* S1 lettering */}
      <text
        x="50"
        y="76"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold"
        fontSize="27"
        fill="url(#shieldGold)"
        letterSpacing="1"
      >
        S1
      </text>

      {/* Banner line under S1 */}
      <line x1="33" y1="84" x2="67" y2="84" stroke="#C8A96E" strokeWidth="1.5" opacity="0.8" />
      <line x1="38" y1="88.5" x2="62" y2="88.5" stroke="#C8A96E" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

/* ── Feature card data ───────────────────────────────────────────────────── */
const FEATURES = [
  {
    href: '/profile',
    icon: '👤',
    title: 'Soldier Profile',
    desc: 'Enter your rank, MOS, PME status, home city, and career goals. Everything else flows from here.',
    bg: 'from-blue-700 to-blue-900',
    badge: null,
  },
  {
    href: '/matches',
    icon: '🎯',
    title: 'Position Matches',
    desc: '612 real MTARNG positions — filled and vacant — scored 0–100 against your profile. Filter by city, grade, status, and vacancy.',
    bg: 'from-emerald-700 to-emerald-900',
    badge: null,
  },
  {
    href: '/commute',
    icon: '🗺️',
    title: 'Commute Analysis',
    desc: 'Montana is enormous. See the real drive time and mileage from your home to every duty station.',
    bg: 'from-indigo-700 to-indigo-900',
    badge: null,
  },
  {
    href: '/timeline',
    icon: '📅',
    title: 'Career Timeline',
    desc: 'Visualize a 10–20 year pathway with PME gates, promotion points, and decision gates.',
    bg: 'from-amber-600 to-amber-800',
    badge: null,
  },
  {
    href: '/counseling',
    icon: '📋',
    title: 'Counseling Sheet',
    desc: 'Print a professional one-page senior-rater counseling product ready for any leadership meeting.',
    bg: 'from-purple-700 to-purple-900',
    badge: null,
  },
  {
    href: '/ai-mentor',
    icon: '💬',
    title: 'Ask Steeves',
    desc: 'Chat directly with Steeves. Get personalized advice on promotions, MOS switches, schools, and next steps.',
    bg: 'from-[#1B4F2A] to-[#0D2614]',
    badge: 'AI Powered',
  },
]

/* ── HOW IT WORKS steps ──────────────────────────────────────────────────── */
const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Build Your Profile',
    desc: 'Tell Steeves your rank, MOS, PME status, home city, and where you want to go. Takes 5 minutes.',
  },
  {
    step: '02',
    title: 'See Your Matches',
    desc: 'Every open position in Montana, scored and ranked for you. Filter by city, grade, vacancy, or goal alignment.',
  },
  {
    step: '03',
    title: 'Ask Steeves',
    desc: 'Chat with the AI. Get specific advice on your next assignment, schools to attend, and your 5-year plan.',
  },
]

/* ── STATS ───────────────────────────────────────────────────────────────── */
const STATS = [
  { value: '612', label: 'Real MTARNG Positions' },
  { value: '53', label: 'Positions Currently Vacant' },
  { value: '0–100', label: 'Fit Score per Position' },
  { value: 'AI', label: 'Career Mentor Built In' },
]

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { profile, profileComplete } = useProfileStore()

  return (
    <div className="min-h-screen bg-white">

      {/* ╔══════════════════════════════════════════════════════════════╗ */}
      {/*  HERO                                                          */}
      {/* ╚══════════════════════════════════════════════════════════════╝ */}
      <section
        className="relative overflow-hidden min-h-[92vh] flex flex-col items-center justify-center text-white px-6 py-24"
        style={{ background: 'linear-gradient(160deg, #0D2614 0%, #1B4F2A 45%, #14401f 100%)' }}
      >
        {/* Subtle dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, #C8A96E 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Glow behind shield */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #C8A96E, transparent 70%)' }}
        />

        {/* Decorative corner stars */}
        <Star className="absolute top-12 left-10 w-5 h-5 text-amber-400/30" />
        <Star className="absolute top-20 left-20 w-3 h-3 text-amber-400/20" />
        <Star className="absolute top-12 right-10 w-5 h-5 text-amber-400/30" />
        <Star className="absolute top-24 right-24 w-3 h-3 text-amber-400/20" />
        <Star className="absolute bottom-16 left-16 w-4 h-4 text-amber-400/20" />
        <Star className="absolute bottom-20 right-20 w-4 h-4 text-amber-400/20" />

        <div className="relative z-10 text-center max-w-4xl mx-auto flex flex-col items-center">

          {/* S1 / AG Branch Crest */}
          <div className="mb-8 animate-[fadeInDown_0.7s_ease]">
            <BranchCrest size={100} />
          </div>

          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-5">
            <div className="h-px w-12 bg-amber-400/60" />
            <span className="text-amber-400 text-xs font-bold tracking-[0.25em] uppercase">
              Montana Army National Guard · S1 Career Manager
            </span>
            <div className="h-px w-12 bg-amber-400/60" />
          </div>

          {/* Main wordmark */}
          <h1 className="text-7xl md:text-8xl font-extrabold tracking-tight leading-none mb-4"
            style={{ textShadow: '0 4px 40px rgba(0,0,0,0.5)' }}>
            Ask&nbsp;<span style={{ color: '#C8A96E' }}>Steeves</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-green-200 font-medium mb-6 leading-snug">
            Your personal S1 career manager — powered by AI,<br className="hidden md:block" />
            built for the Montana Army National Guard.
          </p>

          {/* Description */}
          <p className="text-base text-white/70 max-w-2xl mx-auto leading-relaxed mb-10">
            Steeves knows the MTARNG force structure, Montana's geography, Army PME requirements,
            and what it actually takes to promote. Whether you're an E5 eyeing E7 or a CPT headed
            toward battalion command — Steeves helps you plan the path and take the next step.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Link
              href="/profile"
              className="px-8 py-4 rounded-xl font-bold text-lg text-green-950 shadow-xl transition-all hover:scale-105 active:scale-100"
              style={{ background: 'linear-gradient(135deg, #C8A96E, #e0c080)' }}
            >
              Start My Career Session →
            </Link>
            <Link
              href="/ai-mentor"
              className="px-8 py-4 rounded-xl font-bold text-lg border-2 border-white/30 text-white hover:border-amber-400 hover:text-amber-300 transition-all"
            >
              💬 Ask Steeves Now
            </Link>
          </div>

          {/* Social proof / scroll hint */}
          <div className="mt-16 flex items-center gap-6 text-white/40 text-sm">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-amber-400/80">{s.value}</div>
                <div className="text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll chevron */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 animate-bounce">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════════════╗ */}
      {/*  PROFILE STATUS BAR (only when profile exists)                 */}
      {/* ╚══════════════════════════════════════════════════════════════╝ */}
      {profileComplete && (
        <div className="bg-emerald-700 text-white py-3 px-6">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-4 text-sm">
            <span className="font-bold text-amber-300">✓ Profile loaded:</span>
            {profile.fullName && <span className="font-semibold">{profile.fullName}</span>}
            <span className="opacity-60">|</span>
            <span>{profile.rank} · {profile.mos} · {profile.componentStatus}</span>
            <span className="opacity-60">|</span>
            <span>Home: {profile.homeCity}</span>
            <span className="opacity-60">|</span>
            <span>Goal: {profile.targetRank} — {profile.primaryGoal}</span>
            <Link href="/matches" className="ml-auto underline text-amber-300 font-semibold text-sm">
              See My Matches →
            </Link>
          </div>
        </div>
      )}

      {/* ╔══════════════════════════════════════════════════════════════╗ */}
      {/*  WHO IS STEEVES?                                               */}
      {/* ╚══════════════════════════════════════════════════════════════╝ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left: text */}
            <div>
              <div className="text-amber-600 text-xs font-bold tracking-widest uppercase mb-3">
                Meet Your Career Manager
              </div>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
                Steeves knows your career.<br />
                Steeves knows Montana.<br />
                Steeves knows <span style={{ color: '#1B4F2A' }}>what it takes.</span>
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  <strong className="text-gray-800">Ask Steeves</strong> is an AI-powered career
                  management system built specifically for Montana Army National Guard Soldiers.
                  It combines real MTARNG force structure data with the Army's PME and promotion
                  framework to give you advice that's <em>specific to your situation</em> —
                  not generic career guidance.
                </p>
                <p>
                  Steeves understands that you live in Bozeman and the closest relevant opening
                  might be in Dillon — 2.5 hours away. Steeves knows whether your MOS has an
                  AGR pipeline at state HQ. Steeves can tell you exactly which schools you need
                  before your next promotion board.
                </p>
                <p>
                  Think of Steeves as the S1 NCO who's been around long enough to know everyone,
                  remember every TDA, and give you a straight answer — available 24/7.
                </p>
              </div>
              <div className="mt-8">
                <Link
                  href="/ai-mentor"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm shadow-md hover:shadow-lg transition"
                  style={{ backgroundColor: '#1B4F2A' }}
                >
                  💬 Start a Conversation with Steeves
                </Link>
              </div>
            </div>

            {/* Right: big quote card */}
            <div
              className="rounded-2xl p-8 text-white shadow-2xl"
              style={{ background: 'linear-gradient(145deg, #0D2614, #1B4F2A)' }}
            >
              <div className="text-amber-400 text-5xl font-serif leading-none mb-4">"</div>
              <blockquote className="text-lg leading-relaxed text-green-100 italic mb-6">
                Sergeant, here's what I see. You've got 8 years in, two deployments, and your
                ALC is still outstanding. You're within commute distance of three E6 vacancies —
                one of them is a Squad Leader KD position in Helena. That's the move.
                Get your ALC date locked in first. Here's how.
              </blockquote>
              <div className="flex items-center gap-3 border-t border-white/20 pt-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-green-950"
                  style={{ backgroundColor: '#C8A96E' }}>
                  S
                </div>
                <div>
                  <div className="font-bold text-amber-300">Steeves</div>
                  <div className="text-green-400 text-xs">S1 Career Manager · MT ARNG</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════════════╗ */}
      {/*  HOW IT WORKS                                                  */}
      {/* ╚══════════════════════════════════════════════════════════════╝ */}
      <section className="py-20 px-6" style={{ backgroundColor: '#f8f7f4' }}>
        <div className="max-w-5xl mx-auto text-center mb-14">
          <div className="text-amber-600 text-xs font-bold tracking-widest uppercase mb-3">Simple Process</div>
          <h2 className="text-4xl font-extrabold text-gray-900">How it works</h2>
          <p className="text-gray-500 mt-3 text-lg">Three steps to a better career plan.</p>
        </div>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.step} className="relative">
              {/* Connector line */}
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(100%+0px)] w-full h-px bg-amber-200 z-0" style={{ left: '100%', width: '100%' }} />
              )}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 relative z-10">
                <div
                  className="text-2xl font-extrabold mb-4 w-14 h-14 rounded-xl flex items-center justify-center text-white shadow"
                  style={{ background: 'linear-gradient(135deg, #1B4F2A, #0D2614)' }}
                >
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════════════╗ */}
      {/*  FEATURES GRID                                                 */}
      {/* ╚══════════════════════════════════════════════════════════════╝ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-amber-600 text-xs font-bold tracking-widest uppercase mb-3">Everything You Need</div>
            <h2 className="text-4xl font-extrabold text-gray-900">Six tools. One system.</h2>
            <p className="text-gray-500 mt-3 text-lg max-w-2xl mx-auto">
              From building your profile to printing your counseling sheet — Steeves handles the full career planning cycle.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <Link
                key={f.href}
                href={f.href}
                className="group block rounded-2xl overflow-hidden shadow hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`bg-gradient-to-br ${f.bg} p-7 h-full flex flex-col`}>
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl" role="img">{f.icon}</span>
                    {f.badge && (
                      <span className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                        {f.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-white/75 text-sm leading-relaxed flex-1">{f.desc}</p>
                  <div className="mt-5 flex items-center gap-1 text-white/60 text-sm group-hover:text-white transition-colors">
                    Open {f.title}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════════════╗ */}
      {/*  FINAL CTA                                                     */}
      {/* ╚══════════════════════════════════════════════════════════════╝ */}
      <section
        className="py-24 px-6 text-center text-white"
        style={{ background: 'linear-gradient(160deg, #0D2614, #1B4F2A)' }}
      >
        <div className="max-w-3xl mx-auto">
          <BranchCrest size={64} />
          <h2 className="text-4xl font-extrabold mt-6 mb-4">
            Ready to plan your career?
          </h2>
          <p className="text-green-200 text-lg mb-10">
            Every Soldier in the Montana Army National Guard deserves a clear path forward.
            Steeves helps you find it.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/profile"
              className="px-8 py-4 rounded-xl font-bold text-lg text-green-950 shadow-xl transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #C8A96E, #e0c080)' }}
            >
              Build My Profile →
            </Link>
            <Link
              href="/ai-mentor"
              className="px-8 py-4 rounded-xl font-bold text-lg border-2 border-white/30 hover:border-amber-400 hover:text-amber-300 transition-all"
            >
              💬 Ask Steeves
            </Link>
          </div>
          <p className="mt-8 text-green-400/60 text-xs">
            Montana Army National Guard · S1 AI Career Management System
          </p>
        </div>
      </section>

    </div>
  )
}
