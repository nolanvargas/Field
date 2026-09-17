/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/branding.mjs', () => ({
	emailFromAddress: () => 'noreply@field.test',
}));

describe('sendEmail', () => {
	const originalProvider = process.env.EMAIL_PROVIDER;

	beforeEach(() => {
		process.env.EMAIL_PROVIDER = 'console';
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		process.env.EMAIL_PROVIDER = originalProvider;
		vi.restoreAllMocks();
	});

	it('rejects empty To addresses', async () => {
		const { sendEmail } = await import('../server/email.mjs');
		await expect(
			sendEmail({ to: ['', '  '], subject: 'Hi', text: 'Body' }),
		).rejects.toThrow(/at least one To address/);
	});

	it('rejects empty subject', async () => {
		const { sendEmail } = await import('../server/email.mjs');
		await expect(
			sendEmail({ to: 'a@example.com', subject: '  ', text: 'Body' }),
		).rejects.toThrow(/subject is required/);
	});

	it('console provider returns an ID and logs the payload', async () => {
		const { sendEmail } = await import('../server/email.mjs');
		const result = await sendEmail({
			to: ['user@example.com'],
			subject: 'Test',
			text: 'Hello',
		});

		expect(result.messageId).toMatch(/^console-/);
		expect(console.log).toHaveBeenCalledWith(
			'[email:console]',
			expect.objectContaining({
				messageId: result.messageId,
				from: 'noreply@field.test',
				to: ['user@example.com'],
				subject: 'Test',
				text: 'Hello',
			}),
		);
	});
});
