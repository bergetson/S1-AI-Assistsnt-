import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Navbar from '@/components/Navbar';
import { TuningBoot } from '@/components/shared/TuningBoot';
import { SiteFooter } from '@/components/shared/SiteFooter';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Written to be read by a human and by a web-reputation classifier. An Army
// crest plus unit names on a *.github.io subdomain, with nothing saying who
// runs the site, is the shape of an impersonation page — which is what got
// this URL categorised as phishing. The title and description now state what
// the site is and, explicitly, that it has no sign-in.
export const metadata: Metadata = {
  title: 'Ask Steeves — Unofficial MTARNG Talent Management Prototype',
  description:
    'An independent, open-source prototype exploring talent-management analytics for the Montana Army National Guard. Not an official U.S. Army, DoD, or National Guard system. No sign-in, no accounts, no government credentials, and no personal data collected — everything runs in your browser.',
  applicationName: 'Ask Steeves',
  robots: { index: true, follow: true },
  other: {
    'dcterms.rights': 'Unofficial prototype. Not affiliated with, endorsed by, or operated by the U.S. Army, the Department of Defense, or the National Guard Bureau.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-gray-50 antialiased">
        <TuningBoot />
        <Navbar />
        <main className="pt-16">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
