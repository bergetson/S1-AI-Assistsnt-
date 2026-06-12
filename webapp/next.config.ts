import type { NextConfig } from "next";

// GitHub Pages requires a basePath and static export.
// Vercel serves from root with full Next.js server support.
const isGithubPages = process.env.GITHUB_PAGES === 'true'
const basePath = isGithubPages ? '/S1-AI-Assistsnt-' : ''

const nextConfig: NextConfig = {
  ...(isGithubPages && { output: 'export' }),
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
}

export default nextConfig;
