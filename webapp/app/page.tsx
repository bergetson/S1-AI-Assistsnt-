'use client';

import Link from 'next/link';
import { useProfileStore } from '@/lib/store';

export default function DashboardPage() {
  const { profile } = useProfileStore();

  const fields = [
    profile?.fullName,
    profile?.rank,
    profile?.mos,
    profile?.homeCity,
    profile?.targetRank,
    profile?.primaryGoal,
    profile?.componentStatus,
    profile?.careerCategory,
  ];
  const filledCount = fields.filter((f) => f && String(f).trim() !== '').length;
  const completionPercent = Math.round((filledCount / 8) * 100);

  const progressColor =
    completionPercent >= 80
      ? 'bg-green-500'
      : completionPercent >= 40
      ? 'bg-yellow-500'
      : 'bg-red-400';

  const hasProfileData =
    profile &&
    (profile.rank || profile.mos || profile.homeCity || profile.primaryGoal);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Hero Section */}
      <div
        className="w-full py-20 px-8 text-center text-white"
        style={{ backgroundColor: '#1B4F2A' }}
      >
        <div className="text-4xl mb-4">🛡️</div>
        <h1 className="text-4xl md:text-5xl font-bold">
          Montana Army National Guard
        </h1>
        <p className="text-xl md:text-2xl font-semibold text-amber-300 mt-2">
          Career Planning &amp; Mentorship System
        </p>
        <p className="text-lg text-white/80 mt-4 italic">
          Understand where you are. Plan where you&apos;re going. Get there with purpose.
        </p>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-gray-100 border-b py-3 px-8 flex gap-6 text-sm text-gray-700 flex-wrap">
        {hasProfileData ? (
          <>
            {profile.rank && (
              <span>
                <span className="font-semibold">Rank:</span> {profile.rank}
              </span>
            )}
            {profile.mos && (
              <span>
                <span className="font-semibold">MOS:</span> {profile.mos}
              </span>
            )}
            {profile.homeCity && (
              <span>
                <span className="font-semibold">Home:</span> {profile.homeCity}
              </span>
            )}
            {profile.primaryGoal && (
              <span>
                <span className="font-semibold">Goal:</span> {profile.primaryGoal}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-500 italic">
            Complete your profile to see personalized stats
          </span>
        )}
      </div>

      {/* Profile Completion Card */}
      <div className="bg-white shadow rounded-xl max-w-2xl mx-auto my-8 p-6">
        <p className="font-semibold text-lg text-gray-800 mb-3">
          Profile Completion
        </p>
        <div className="bg-gray-200 rounded-full h-3 w-full overflow-hidden">
          <div
            className={`${progressColor} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-gray-600">{completionPercent}% Complete</span>
          {completionPercent < 100 && (
            <Link
              href="/profile"
              className="text-sm font-medium hover:underline"
              style={{ color: '#1B4F2A' }}
            >
              Complete Your Profile →
            </Link>
          )}
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1 - My Profile */}
        <Link href="/profile" className="block rounded-xl hover:shadow-xl transition">
          <div className="bg-blue-600 text-white rounded-xl p-6 h-full">
            <div className="text-3xl">👤</div>
            <h2 className="font-bold text-xl mt-3">My Profile</h2>
            <p className="mt-2 text-white/85 text-sm leading-relaxed">
              Build your soldier profile with current rank, MOS, career goals, and PME status.
            </p>
            <div className="mt-4 font-semibold text-white/90">→</div>
          </div>
        </Link>

        {/* Card 2 - Position Matches */}
        <Link href="/matches" className="block rounded-xl hover:shadow-xl transition">
          <div className="bg-green-700 text-white rounded-xl p-6 h-full">
            <div className="text-3xl">🎯</div>
            <h2 className="font-bold text-xl mt-3">Position Matches</h2>
            <p className="mt-2 text-white/85 text-sm leading-relaxed">
              Find positions across MTARNG that align with your grade, MOS, goals, and commute tolerance.
            </p>
            <div className="mt-4 font-semibold text-white/90">→</div>
          </div>
        </Link>

        {/* Card 3 - Commute Analysis */}
        <Link href="/commute" className="block rounded-xl hover:shadow-xl transition">
          <div className="bg-indigo-700 text-white rounded-xl p-6 h-full">
            <div className="text-3xl">🗺️</div>
            <h2 className="font-bold text-xl mt-3">Commute Analysis</h2>
            <p className="mt-2 text-white/85 text-sm leading-relaxed">
              See drive times and distances from your home to every MTARNG duty location in Montana.
            </p>
            <div className="mt-4 font-semibold text-white/90">→</div>
          </div>
        </Link>

        {/* Card 4 - Career Timeline */}
        <Link href="/timeline" className="block rounded-xl hover:shadow-xl transition">
          <div className="bg-amber-600 text-white rounded-xl p-6 h-full">
            <div className="text-3xl">📅</div>
            <h2 className="font-bold text-xl mt-3">Career Timeline</h2>
            <p className="mt-2 text-white/85 text-sm leading-relaxed">
              Visualize your enlisted, officer, or warrant officer career path with PME gates and milestones.
            </p>
            <div className="mt-4 font-semibold text-white/90">→</div>
          </div>
        </Link>

        {/* Card 5 - Counseling Sheet */}
        <Link href="/counseling" className="block rounded-xl hover:shadow-xl transition">
          <div className="bg-purple-700 text-white rounded-xl p-6 h-full">
            <div className="text-3xl">📋</div>
            <h2 className="font-bold text-xl mt-3">Counseling Sheet</h2>
            <p className="mt-2 text-white/85 text-sm leading-relaxed">
              Generate a printable DA-4856-style career counseling document with your top matches.
            </p>
            <div className="mt-4 font-semibold text-white/90">→</div>
          </div>
        </Link>

        {/* Card 6 - AI Career Mentor */}
        <Link href="/ai-mentor" className="block rounded-xl hover:shadow-xl transition">
          <div className="bg-rose-700 text-white rounded-xl p-6 h-full">
            <div className="text-3xl">🤖</div>
            <h2 className="font-bold text-xl mt-3 flex items-center flex-wrap gap-1">
              AI Career Mentor
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full inline-block ml-2">
                AI Powered
              </span>
            </h2>
            <p className="mt-2 text-white/85 text-sm leading-relaxed">
              Chat with an AI mentor trained on ARNG career progression, PME requirements, and MTARNG positions.
            </p>
            <div className="mt-4 font-semibold text-white/90">→</div>
          </div>
        </Link>
      </div>

      {/* Demo Data Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl max-w-6xl mx-auto mx-8 my-4 p-4 flex gap-3 items-start">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <p className="text-sm text-amber-900">
          <span className="font-bold">Demo Data Notice:</span>{' '}
          This tool uses 82 demo MTARNG positions for illustration. Real position data will be loaded by unit administrators before operational use.
        </p>
      </div>
    </div>
  );
}
