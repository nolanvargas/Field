import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:5173',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'node scripts/e2e-serve.mjs',
		url: 'http://127.0.0.1:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
