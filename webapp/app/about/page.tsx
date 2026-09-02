import Link from 'next/link'
import { BILLET_SOURCE, BASELINE_ROSTER_SOURCE, CIVILIAN_SOURCE } from '@/lib/dataSources'
import { AS_OF_LABEL } from '@/lib/asOf'

export const metadata = {
  title: 'About Ask Steeves — Unofficial MTARNG Prototype',
  description:
    'What Ask Steeves is, who built it, what data it uses, and why it never asks for a government login.',
}

/**
 * A plain "what is this site" page.
 *
 * Every legitimate site of this kind has one; phishing pages almost never do,
 * which is part of why a bare *.github.io deployment carrying Army branding
 * gets scored as impersonation. This page exists to be that missing context —
 * for a reviewer running a category-change request, and for a soldier who
 * lands here from a link and reasonably wonders what they are looking at.
 */
export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">About Ask Steeves</h1>
        <p className="text-gray-600">
          An independent prototype for Montana Army National Guard talent management.
        </p>
      </header>

      <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 space-y-2">
        <h2 className="font-bold text-amber-900">This is not an official system</h2>
        <p className="text-sm text-amber-900">
          Ask Steeves is not operated by, affiliated with, or endorsed by the U.S. Army, the
          Department of Defense, the National Guard Bureau, or the Montana Military Department. It
          is a personal, open-source project. Nothing it produces is an order, a personnel action,
          or an official record. Use official systems of record for any actual decision.
        </p>
      </section>

      <section className="rounded-xl border-2 border-green-300 bg-green-50 p-5 space-y-2">
        <h2 className="font-bold text-green-900">There is no login, and never will be</h2>
        <ul className="text-sm text-green-900 space-y-1 list-disc pl-5">
          <li>No accounts, no passwords, no CAC, no AKO or Army 365 sign-in, no EDIPI.</li>
          <li>No server and no database. The site is a set of static files.</li>
          <li>
            Everything you type stays in your own browser&rsquo;s local storage. It is never sent to
            the site&rsquo;s host and cannot be read by anyone else.
          </li>
          <li>
            The optional AI chat asks for a commercial AI provider&rsquo;s API token. That is not a
            government credential. If any page ever asks you for one, it is not this site.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-gray-900">What it does</h2>
        <p className="text-sm text-gray-700">
          It reads a force-structure extract and models the questions a personnel shop actually
          gets asked: who is eligible for promotion, where the manning gaps are, who could fill a
          vacant billet, and what a soldier&rsquo;s realistic path to a given grade looks like. It is
          a demonstration of what the analysis could look like if the underlying data were complete
          — not a replacement for any system that holds that data today.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-gray-900">Where the data comes from</h2>
        <p className="text-sm text-gray-700">
          Planning date: {AS_OF_LABEL}. Every screen labels its own sources; the full list is:
        </p>
        <ul className="space-y-2">
          {[BILLET_SOURCE, BASELINE_ROSTER_SOURCE, CIVILIAN_SOURCE].map(src => (
            <li key={src.key} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="font-semibold text-sm text-gray-900">{src.label}</p>
              <p className="text-sm text-gray-600">{src.statement}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-gray-700">
          <strong>No names are published.</strong> Personal identifiers are discarded when the data
          is prepared; individuals appear only as stable pseudonyms such as <code>S-0142</code>.
          Names never leave your browser and are never sent to an AI provider.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-gray-900">Source code</h2>
        <p className="text-sm text-gray-700">
          The entire application is public and auditable at{' '}
          <a
            href="https://github.com/bergetson/S1-AI-Assistsnt-"
            className="text-green-800 underline hover:text-green-900"
            rel="noopener noreferrer"
          >
            github.com/bergetson/S1-AI-Assistsnt-
          </a>
          . Report a problem through the repository&rsquo;s issues page.
        </p>
      </section>

      <p className="text-sm">
        <Link href="/" className="text-green-800 underline hover:text-green-900">
          ← Back to Ask Steeves
        </Link>
      </p>
    </div>
  )
}
