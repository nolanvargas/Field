import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			coverage: {
				provider: 'v8',
				reporter: ['text-summary', 'lcov'],
				include: ['shared/**/*.js', 'server/**/*.mjs'],
				exclude: [
					'server/index.mjs',
					'server/**/*.test.*',
					'shared/**/*.test.*',
					'shared/**/*.d.ts',
				],
				thresholds: {
					lines: 55,
					functions: 55,
					branches: 50,
					statements: 55,
				},
			},
		},
	}),
)
