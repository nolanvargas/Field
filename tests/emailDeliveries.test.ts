/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
}));

const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({ query: dbMocks.query }),
}));

vi.mock('../server/email.mjs', () => ({
	sendEmail: sendEmailMock,
}));

describe('dispatchOutboundEmail', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
		sendEmailMock.mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const pendingRow = {
		id: 10,
		task_id: 42,
		trigger: 'task_completed',
		to_addresses: 'jane@example.com',
		subject: 'Delivered',
		status: 'pending',
		provider_message_id: null,
		error_message: null,
		sent_at: null,
		created_at: new Date('2026-08-12T10:00:00Z'),
	};

	it('validates taskId, trigger, to, and subject', async () => {
		const { dispatchOutboundEmail } = await import('../server/emailDeliveries.mjs');

		await expect(
			dispatchOutboundEmail({
				taskId: 0,
				trigger: 'task_completed',
				to: 'a@example.com',
				subject: 'Hi',
				text: 'Body',
			}),
		).rejects.toThrow(/taskId must be a positive integer/);

		await expect(
			dispatchOutboundEmail({
				taskId: 1,
				trigger: '',
				to: 'a@example.com',
				subject: 'Hi',
				text: 'Body',
			}),
		).rejects.toThrow(/trigger is required/);

		await expect(
			dispatchOutboundEmail({
				taskId: 1,
				trigger: 'task_completed',
				to: '',
				subject: 'Hi',
				text: 'Body',
			}),
		).rejects.toThrow(/at least one To address/);

		await expect(
			dispatchOutboundEmail({
				taskId: 1,
				trigger: 'task_completed',
				to: 'a@example.com',
				subject: '  ',
				text: 'Body',
			}),
		).rejects.toThrow(/subject is required/);
	});

	it('marks delivery sent when the provider succeeds', async () => {
		sendEmailMock.mockResolvedValue({ messageId: 'msg-123' });

		dbMocks.query
			.mockResolvedValueOnce({ rows: [pendingRow], rowCount: 1 })
			.mockResolvedValueOnce({
				rows: [
					{
						...pendingRow,
						status: 'sent',
						provider_message_id: 'msg-123',
						sent_at: new Date('2026-08-12T10:01:00Z'),
					},
				],
				rowCount: 1,
			});

		const { dispatchOutboundEmail } = await import('../server/emailDeliveries.mjs');
		const result = await dispatchOutboundEmail({
			taskId: 42,
			trigger: 'task_completed',
			to: 'jane@example.com',
			subject: 'Delivered',
			text: 'Done',
		});

		expect(result.status).toBe('sent');
		expect(result.providerMessageId).toBe('msg-123');
		expect(sendEmailMock).toHaveBeenCalledOnce();
	});

	it('marks delivery failed with a truncated error when send throws', async () => {
		const longError = 'x'.repeat(5000);
		sendEmailMock.mockRejectedValue(new Error(longError));

		dbMocks.query
			.mockResolvedValueOnce({ rows: [pendingRow], rowCount: 1 })
			.mockResolvedValueOnce({
				rows: [
					{
						...pendingRow,
						status: 'failed',
						error_message: longError.slice(0, 4000),
					},
				],
				rowCount: 1,
			});

		const { dispatchOutboundEmail } = await import('../server/emailDeliveries.mjs');
		const result = await dispatchOutboundEmail({
			taskId: 42,
			trigger: 'task_completed',
			to: 'jane@example.com',
			subject: 'Delivered',
			text: 'Done',
		});

		expect(result.status).toBe('failed');
		expect(result.errorMessage).toHaveLength(4000);
		expect(result.providerMessageId).toBeNull();
	});
});
