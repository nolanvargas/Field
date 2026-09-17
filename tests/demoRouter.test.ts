import { describe, expect, it } from 'vitest';
import { DEMO_ADMIN_USER_ID } from '../src/demo/fixtures/boot';
import { filterDemoTasksForList } from '../src/demo/fixtures/tasks';
import { demoRouter } from '../src/demo/router';
import { getDemoStore, resetDemoStore } from '../src/demo/store';

describe('demoRouter', () => {
	it('GET /api/auth/config returns stub provider', async () => {
		const res = await demoRouter('/api/auth/config');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.provider).toBe('stub');
		expect(body.config).toBeNull();
		expect(typeof body.accentColor).toBe('string');
	});

	it('GET /api/users includes demo admin', async () => {
		const res = await demoRouter('/api/users');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body.users)).toBe(true);
		expect(body.users.some((u: { id: string }) => u.id === DEMO_ADMIN_USER_ID)).toBe(
			true,
		);
	});

	it('GET /api/org/settings returns org catalog', async () => {
		const res = await demoRouter('/api/org/settings');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.taskTypes?.length).toBeGreaterThan(0);
		expect(body.printTemplatesRevision).toBeTruthy();
	});

	it('GET /api/org/print-templates returns revision', async () => {
		const res = await demoRouter('/api/org/print-templates');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.revision).toBeTruthy();
		expect(Array.isArray(body.templates)).toBe(true);
	});

	it('GET /api/tasks returns full demo suite sorted by createdAt desc', async () => {
		resetDemoStore();
		const res = await demoRouter('/api/tasks');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.tasks?.length).toBe(100);
	});

	it('demo list sort is createdAt desc (matches API)', () => {
		resetDemoStore();
		const { taskRecords } = getDemoStore();
		const tasks = filterDemoTasksForList(taskRecords, new URLSearchParams());
		for (let i = 1; i < tasks.length; i++) {
			const prev = taskRecords.find((r) => r.detail.id === tasks[i - 1].id)!;
			const cur = taskRecords.find((r) => r.detail.id === tasks[i].id)!;
			expect(new Date(prev.detail.createdAt).getTime()).toBeGreaterThanOrEqual(
				new Date(cur.detail.createdAt).getTime(),
			);
		}
	});

	it('GET /api/tasks/:id/attachments and download url', async () => {
		resetDemoStore();
		const listRes = await demoRouter('/api/tasks');
		const { tasks } = await listRes.json();
		const completed = tasks.find((t: { status: string }) => t.status === 'Completed');
		expect(completed).toBeTruthy();
		const detailRes = await demoRouter(`/api/tasks/${completed.id}`);
		const detailBody = await detailRes.json();
		expect(detailBody.task.attachments?.length).toBeGreaterThan(0);
		const attId = detailBody.task.attachments[0].id;
		const attList = await demoRouter(`/api/tasks/${completed.id}/attachments`);
		const attBody = await attList.json();
		expect(attBody.attachments.length).toBeGreaterThan(0);
		const urlRes = await demoRouter(
			`/api/tasks/${completed.id}/attachments/${attId}/url?inline=1`,
		);
		const urlBody = await urlRes.json();
		expect(urlBody.downloadUrl).toMatch(/^\/demo\//);
	});

	it('GET /api/tasks/:id returns task detail', async () => {
		resetDemoStore();
		const listRes = await demoRouter('/api/tasks');
		const listBody = await listRes.json();
		const id = listBody.tasks[0].id;
		const res = await demoRouter(`/api/tasks/${id}`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.task?.id).toBe(id);
	});

	it('unknown route returns 501', async () => {
		const res = await demoRouter('/api/contacts');
		expect(res.status).toBe(501);
		const body = await res.json();
		expect(body.error).toMatch(/demo/i);
	});
});
