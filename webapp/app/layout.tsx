import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Navbar from '@/components/Navbar';
import { TuningBoot } from '@/components/shared/TuningBoot';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Ask Steeves | Your S1 Career Manager — Montana Army National Guard',
  description:
    'Ask Steeves is your AI-powered S1 Career Manager for the Montana Army National Guard. Personalized career advice, position matches, commute analysis, and a printable counseling sheet.',
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
      </body>
    </html>
  );
}
