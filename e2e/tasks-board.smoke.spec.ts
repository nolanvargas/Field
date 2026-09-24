import { expect, test } from '@playwright/test';

/** Sandbocks seed — Logan Reed (viewAllTasks). See scripts/seed-dev-data.mjs */
const LOGAN_USER_ID = 'a6c2a0c2-6266-4b3a-b786-eeae20667afe';

test('stub web loads coordinator tasks board', async ({ page }) => {
	await page.addInitScript((userId) => {
		localStorage.setItem('field.currentUserId', userId);
	}, LOGAN_USER_ID);

	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible();
});
