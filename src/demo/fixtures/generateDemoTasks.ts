import type { TaskHistoryEvent } from '../../api/tasks';
import type { TaskDetail, TaskStatus } from '../../types/task';
import { buildDemoAttachments } from './attachmentMedia';
import {
	buildDemoHeatmapDayTargets,
	dayOffsetFromFocus,
	pacificDayKeyFromIso,
	pacificTodayKey,
	pickDemoTaskWindow,
} from './calendar';
import { buildDemoTaskHistory } from './demoHistory';
import {
	DEMO_ADMIN_USER_ID,
	DEMO_CREW_USER_ID,
} from './boot';

export type DemoTaskRecord = {
	detail: TaskDetail;
	crewMemberIds: string[];
	createdByUserId: string;
	history: TaskHistoryEvent[];
};

const DEMO_TASK_COUNT = 100;

const TASK_TYPES = [
	'Delivery',
	'Install',
	'Removal',
	'Site Survey',
	'Pickup',
	'Other',
] as const;

const VENUES = [
	{ name: 'Riverside Convention Center', street: '1200 Harbor Blvd', lat: 36.09, lng: -115.15 },
	{ name: 'Grand Vista Hotel', street: '88 Market Street', lat: 36.1, lng: -115.16 },
	{ name: 'Lakeview Amphitheater', street: '400 Lakeside Dr', lat: 36.11, lng: -115.14 },
	{ name: 'Metro Arts Pavilion', street: '55 Gallery Walk', lat: 36.12, lng: -115.13 },
	{ name: 'Union Station Events', street: '901 Transit Plaza', lat: 36.08, lng: -115.18 },
	{ name: 'Harbor Expo Hall', street: '300 Pier Road', lat: 36.07, lng: -115.19 },
	{ name: 'Civic Auditorium', street: '10 Center Ave', lat: 36.13, lng: -115.12 },
	{ name: 'Skyline Ballroom', street: '2200 Summit Rd', lat: 36.14, lng: -115.11 },
];

const CONTACTS = [
	{ name: 'Jordan Lee', email: 'jordan@example.com' },
	{ name: 'Riley Hayes', email: 'riley@example.com' },
	{ name: 'Sam Ortiz', email: 'sam@example.com' },
];

function addMinutes(iso: string, minutes: number): string {
	const d = new Date(iso);
	d.setMinutes(d.getMinutes() + minutes);
	return d.toISOString();
}

function statusForDayOffset(dayOffset: number, seed: number): TaskStatus {
	if (dayOffset <= -2) {
		const pool: TaskStatus[] = [
			'Completed',
			'Completed',
			'Failed',
			'Cancelled',
			'Undetermined',
		];
		return pool[seed % pool.length];
	}
	if (dayOffset >= -1 && dayOffset <= 1) {
		const pool: TaskStatus[] = [
			'In Progress',
			'Assigned',
			'Completed',
			'In Progress',
			'Assigned',
			'Completed',
		];
		return pool[seed % pool.length];
	}
	const pool: TaskStatus[] = [
		'Assigned',
		'Assigned',
		'Unassigned',
		'Assigned',
		'Unassigned',
	];
	return pool[seed % pool.length];
}

function trackingForId(id: number): {
	trackingToken: string;
	trackingPath: string;
	trackingUrl: string;
} {
	const trackingToken = `demo-track-${id}`;
	return {
		trackingToken,
		trackingPath: `/t/${trackingToken}`,
		trackingUrl: `/t/${trackingToken}`,
	};
}

function buildCrewMembers(
	crewIds: string[],
	status: TaskStatus,
	windowStartAt: string,
	completedAt: string | null,
	taskId: number,
): TaskDetail['crewMembers'] {
	if (crewIds.length === 0) return [];

	const needsStart = ['In Progress', 'Completed', 'Failed', 'Undetermined'].includes(
		status,
	);
	const needsEnd = ['Completed', 'Failed', 'Undetermined'].includes(status);

	return crewIds.map((userId, index) => {
		const isLead = index === 0;
		const displayName =
			userId === DEMO_ADMIN_USER_ID ? 'Demo Dispatch' : 'Demo Crew';
		let startedAt: string | null = null;
		let endedAt: string | null = null;
		if (needsStart) {
			startedAt = addMinutes(windowStartAt, 8 + index * 4 + (taskId % 5));
		}
		if (needsEnd && completedAt) {
			endedAt = addMinutes(completedAt, -3 + index * 2);
		} else if (status === 'In Progress' && isLead) {
			startedAt = startedAt ?? addMinutes(windowStartAt, 5);
			endedAt = null;
		}
		return {
			id: userId,
			displayName,
			isLead,
			startedAt,
			endedAt,
		};
	});
}

function buildRecord(id: number, dayKey: string, focusDayKey: string): DemoTaskRecord {
	const dispatch = DEMO_ADMIN_USER_ID;
	const crew = DEMO_CREW_USER_ID;
	const dayOffset = dayOffsetFromFocus(focusDayKey, dayKey);
	const status = statusForDayOffset(dayOffset, id);
	const taskType = TASK_TYPES[id % TASK_TYPES.length];
	const venue = VENUES[id % VENUES.length];
	const contact = CONTACTS[id % CONTACTS.length];
	const { windowStartAt, windowEndAt } = pickDemoTaskWindow(dayKey, id);
	const createdAt = addMinutes(windowStartAt, -(48 + (id % 36)));
	const updatedAt = windowEndAt;
	const tracking = trackingForId(id);

	const crewMemberIds =
		status === 'Unassigned' ? [] : [crew, ...(id % 5 === 0 ? [dispatch] : [])];

	let completedAt: string | null = null;
	let failedReason: string | null = null;
	let cancelledAt: string | null = null;
	let completedNotes: string | null = null;

	if (status === 'Completed') {
		completedAt = addMinutes(windowEndAt, -15 + (id % 10));
		completedNotes = 'Delivered and signed.';
	} else if (status === 'Failed') {
		completedAt = addMinutes(windowEndAt, -10);
		failedReason = 'Access denied after hours.';
	} else if (status === 'Undetermined') {
		completedAt = addMinutes(windowEndAt, -8);
	} else if (status === 'Cancelled') {
		cancelledAt = addMinutes(createdAt, 120 + (id % 60));
	}

	const crewMembers = buildCrewMembers(
		crewMemberIds,
		status,
		windowStartAt,
		completedAt,
		id,
	);

	const attachmentBaseAt =
		completedAt ?? updatedAt ?? addMinutes(windowStartAt, 30);
	const attachments = buildDemoAttachments({
		taskId: id,
		status,
		taskType,
		baseAt: attachmentBaseAt,
		uploaderId: crewMemberIds[0] ?? dispatch,
		secondUploaderId: crewMemberIds[1] ?? crew,
	});

	const detail: TaskDetail = {
		id,
		taskType,
		taskTypeId: null,
		status,
		description:
			`${taskType} — ${venue.name}\n` +
			'Check in with site contact. Capture photos where noted in job title.',
		jobTitle: `${taskType} — ${venue.name.split(' ')[0]} #${id}`,
		externalKey: String(99000 + id),
		destinationAddressId: null,
		destinationAddressName: venue.name,
		destinationAddress: venue.street,
		destinationBuilding: '',
		destinationNotes: 'Use loading dock when available.',
		destinationLatitude: venue.lat,
		destinationLongitude: venue.lng,
		contacts: [
			{
				id: id * 10,
				name: contact.name,
				title: 'Site contact',
				phone: '555-0100',
				email: contact.email,
				isPoc: true,
				receivesEmail: true,
			},
		],
		customFields: {},
		customFieldDefs: [],
		customFieldDefsSnapshot: [],
		customFieldDisplays: {},
		windowStartAt,
		windowEndAt,
		completedNotes,
		completedAt,
		failedReason,
		cancelledAt,
		archiveAt: null,
		trackingToken: tracking.trackingToken,
		trackingPath: tracking.trackingPath,
		trackingUrl: tracking.trackingUrl,
		completionNotes: [],
		completionNotesByName: null,
		createdAt,
		updatedAt,
		createdByName: 'Demo Dispatch',
		crewMembers,
		attachments,
	};

	const history = buildDemoTaskHistory({
		detail,
		crewMemberIds,
		createdByUserId: dispatch,
	});

	return {
		detail,
		crewMemberIds,
		createdByUserId: dispatch,
		history,
	};
}

export function generateDemoTasks(opts?: {
	bulkCount?: number;
	startId?: number;
	baseByDay?: Map<string, number>;
	totalTarget?: number;
}): DemoTaskRecord[] {
	const totalTarget = opts?.totalTarget ?? DEMO_TASK_COUNT;
	const bulkCount = opts?.bulkCount ?? totalTarget;
	if (bulkCount <= 0) return [];

	const baseByDay = opts?.baseByDay ?? new Map<string, number>();
	const focusDayKey = pacificTodayKey();
	const targets = buildDemoHeatmapDayTargets(
		focusDayKey,
		totalTarget,
		baseByDay,
	);
	const records: DemoTaskRecord[] = [];
	let id = opts?.startId ?? 1;
	let remaining = bulkCount;

	for (const [dayKey, target] of targets.entries()) {
		const base = baseByDay.get(dayKey) ?? 0;
		const deficit = Math.max(0, target - base);
		const count = Math.min(deficit, remaining);
		for (let i = 0; i < count; i++) {
			records.push(buildRecord(id, dayKey, focusDayKey));
			id += 1;
			remaining -= 1;
		}
		if (remaining <= 0) break;
	}

	while (remaining > 0) {
		records.push(buildRecord(id, focusDayKey, focusDayKey));
		id += 1;
		remaining -= 1;
	}

	return records.sort((a, b) => {
		const at = new Date(a.detail.createdAt).getTime();
		const bt = new Date(b.detail.createdAt).getTime();
		return bt - at || b.detail.id - a.detail.id;
	});
}

export function countDemoTasksByPacificDay(
	records: DemoTaskRecord[],
): Map<string, number> {
	const byDay = new Map<string, number>();
	for (const record of records) {
		const iso =
			record.detail.windowStartAt ?? record.detail.createdAt;
		const key = pacificDayKeyFromIso(iso);
		byDay.set(key, (byDay.get(key) ?? 0) + 1);
	}
	return byDay;
}
