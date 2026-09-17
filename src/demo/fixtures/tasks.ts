import type { Task } from '../../types/task';
import {
	generateDemoTasks,
	countDemoTasksByPacificDay,
	type DemoTaskRecord,
} from './generateDemoTasks';
import { buildCuratedDemoRecords } from './curatedDemoTasks';

export type { DemoTaskRecord };

const DEMO_TASK_COUNT = 100;

export function buildBootTasks(): DemoTaskRecord[] {
	const curated = buildCuratedDemoRecords();
	const baseByDay = countDemoTasksByPacificDay(curated);
	const bulkCount = Math.max(0, DEMO_TASK_COUNT - curated.length);
	const startId =
		curated.length > 0
			? Math.max(...curated.map((r) => r.detail.id)) + 1
			: 1;
	const generated = generateDemoTasks({
		bulkCount,
		startId,
		baseByDay,
		totalTarget: DEMO_TASK_COUNT,
	});
	return [...curated, ...generated].sort((a, b) => {
		const at = new Date(a.detail.createdAt).getTime();
		const bt = new Date(b.detail.createdAt).getTime();
		return bt - at || b.detail.id - a.detail.id;
	});
}

export function demoTaskToListRow(
	record: DemoTaskRecord,
	crewMemberId?: string | null,
): Task {
	const d = record.detail;
	const contactNames = d.contacts.map((c) => c.name).join(', ');
	const crewName =
		d.crewMembers.length > 0
			? d.crewMembers.map((c) => c.displayName).join(', ')
			: null;
	let myLive = false;
	if (crewMemberId) {
		const member = d.crewMembers.find((m) => m.id === crewMemberId);
		myLive = Boolean(member?.startedAt && !member?.endedAt);
	}
	const destinationAddress =
		d.destinationAddressName.trim() !== ''
			? d.destinationAddressName
			: d.destinationAddress;

	return {
		id: d.id,
		taskType: d.taskType,
		status: d.status,
		externalKey: d.externalKey,
		jobTitle: d.jobTitle,
		contactNames,
		destinationAddressName: d.destinationAddressName,
		destinationStreet: d.destinationAddress,
		destinationBuilding: d.destinationBuilding,
		destinationAddress,
		crewName,
		windowStartAt: d.windowStartAt,
		windowEndAt: d.windowEndAt,
		description: d.description,
		createdByName: d.createdByName,
		cancelledAt: d.cancelledAt,
		archiveAt: d.archiveAt ?? null,
		trackingToken: d.trackingToken,
		trackingPath: d.trackingPath,
		trackingUrl: d.trackingUrl,
		customFields: d.customFields,
		customFieldDefs: d.customFieldDefs,
		customFieldDisplays: d.customFieldDisplays,
		myLive,
	};
}

export function filterDemoTasksForList(
	records: DemoTaskRecord[],
	searchParams: URLSearchParams,
): Task[] {
	const crewMemberId = searchParams.get('crewMemberId')?.trim() || null;
	const createdByUserId = searchParams.get('createdByUserId')?.trim() || null;

	let filtered = records;
	if (crewMemberId || createdByUserId) {
		filtered = records.filter((record) => {
			if (record.detail.status === 'Cancelled') return false;
			const onCrew =
				crewMemberId != null &&
				record.crewMemberIds.includes(crewMemberId);
			const created =
				createdByUserId != null &&
				record.createdByUserId === createdByUserId;
			return onCrew || created;
		});
	}

	return [...filtered]
		.sort((a, b) => {
			const at = new Date(a.detail.createdAt).getTime();
			const bt = new Date(b.detail.createdAt).getTime();
			return bt - at || b.detail.id - a.detail.id;
		})
		.map((record) => demoTaskToListRow(record, crewMemberId));
}

export function findDemoTaskRecord(
	records: DemoTaskRecord[],
	taskId: number,
): DemoTaskRecord | undefined {
	return records.find((r) => r.detail.id === taskId);
}
