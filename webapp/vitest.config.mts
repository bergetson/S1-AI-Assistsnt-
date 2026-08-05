import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Deterministic generators are the backbone of the demo data; a flaky
    // ordering here would mean a hydration mismatch in the browser.
    sequence: { shuffle: false },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
})
