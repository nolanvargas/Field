import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
})
