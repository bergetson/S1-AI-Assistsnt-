import Link from 'next/link'

/**
 * Standing disclaimer, on every page.
 *
 * This is not decoration. The site was blocked by the DoD Enterprise-Level
 * Protection System as "Zero Hour Phishing", and the fingerprint that earns
 * that label is a low-reputation shared-hosting domain (*.github.io) carrying
 * U.S. Army branding with no statement of who runs it. Saying plainly, on
 * every page, that this is an unofficial prototype with no sign-in is the
 * single most direct answer to that classification — and it is also simply
 * true, so it belongs here regardless of the filter.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-500 space-y-2">
        <p className="font-semibold text-gray-700">
          Unofficial prototype — not a U.S. Army, Department of Defense, or National Guard system.
        </p>
        <p>
          Ask Steeves is an independent, open-source demonstration of talent-management analytics
          built by a Montana Army National Guard soldier. It is not an official personnel system,
          it produces no personnel actions, and nothing it shows is an order or an official record.
        </p>
        <p>
          <strong>There is no sign-in.</strong> The site has no accounts, no password, no server and
          no database. It never asks for a CAC, an AKO/Army 365 credential, an EDIPI, or any
          government login. Everything runs in your own browser and is stored only there.
        </p>
        <p>
          <Link href="/about" className="text-green-800 underline hover:text-green-900">
            About this site
          </Link>
          {' · '}
          <a
            href="https://github.com/bergetson/S1-AI-Assistsnt-"
            className="text-green-800 underline hover:text-green-900"
            rel="noopener noreferrer"
          >
            Source code
          </a>
        </p>
      </div>
    </footer>
  )
}
