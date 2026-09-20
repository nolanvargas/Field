import type { TaskHistoryEvent } from '../../api/tasks';
import type { TaskDetail, TaskStatus } from '../../types/task';

function addMinutes(iso: string, minutes: number): string {
	const d = new Date(iso);
	d.setMinutes(d.getMinutes() + minutes);
	return d.toISOString();
}

export function buildDemoTaskHistory(opts: {
	detail: TaskDetail;
	crewMemberIds: string[];
	createdByUserId: string;
}): TaskHistoryEvent[] {
	const { detail, crewMemberIds } = opts;
	const events: TaskHistoryEvent[] = [];
	const actorName = detail.createdByName || 'Demo Dispatch';

	events.push({
		id: `${detail.id}-created`,
		type: 'created',
		at: detail.createdAt,
		actorName,
		fromStatus: null,
		toStatus: null,
		summary: null,
		detail: null,
		latitude: null,
		longitude: null,
		accuracyMeters: null,
	});

	const crewIds = crewMemberIds;
	const status = detail.status;

	if (crewIds.length > 0 && status !== 'Unassigned') {
		events.push({
			id: `${detail.id}-assigned`,
			type: 'status_changed',
			at: addMinutes(detail.createdAt, 5 + (detail.id % 20)),
			actorName,
			fromStatus: 'Unassigned',
			toStatus: 'Assigned',
			summary: null,
			detail: null,
			latitude: null,
			longitude: null,
			accuracyMeters: null,
		});
	}

	const activeStatuses = new Set<TaskStatus>([
		'In Progress',
		'Completed',
		'Failed',
		'Undetermined',
	]);

	if (activeStatuses.has(status)) {
		const lead = detail.crewMembers.find((m) => m.isLead) ?? detail.crewMembers[0];
		const at =
			lead?.startedAt ??
			addMinutes(
				detail.windowStartAt ?? detail.createdAt,
				10 + (detail.id % 15),
			);
		events.push({
			id: `${detail.id}-in-progress`,
			type: 'status_changed',
			at,
			actorName: lead?.displayName ?? actorName,
			fromStatus: crewIds.length > 0 ? 'Assigned' : 'Unassigned',
			toStatus: 'In Progress',
			summary: null,
			detail: null,
			latitude: null,
			longitude: null,
			accuracyMeters: null,
		});
	}

	for (const member of detail.crewMembers) {
		if (member.startedAt) {
			events.push({
				id: `${detail.id}-start-${member.id}`,
				type: 'crew_started',
				at: member.startedAt,
				actorName: member.displayName,
				fromStatus: null,
				toStatus: null,
				summary: null,
				detail: null,
				latitude: 36.11,
				longitude: -115.17,
				accuracyMeters: 12,
			});
		}
		if (member.endedAt) {
			events.push({
				id: `${detail.id}-end-${member.id}`,
				type: 'crew_ended',
				at: member.endedAt,
				actorName: member.displayName,
				fromStatus: null,
				toStatus: null,
				summary: null,
				detail: null,
				latitude: 36.11,
				longitude: -115.17,
				accuracyMeters: 12,
			});
		}
	}

	for (const attachment of detail.attachments ?? []) {
		events.push({
			id: `${detail.id}-att-${attachment.id}`,
			type: 'attachment_added',
			at: attachment.createdAt,
			actorName: attachment.uploadedByName,
			fromStatus: null,
			toStatus: null,
			summary: attachment.fileName ?? attachment.kind,
			detail: attachment.caption,
			latitude: null,
			longitude: null,
			accuracyMeters: null,
		});
	}

	if (status === 'Completed') {
		events.push({
			id: `${detail.id}-completed`,
			type: 'status_changed',
			at: detail.completedAt ?? detail.updatedAt,
			actorName: detail.crewMembers[0]?.displayName ?? actorName,
			fromStatus: 'In Progress',
			toStatus: 'Completed',
			summary: null,
			detail: null,
			latitude: null,
			longitude: null,
			accuracyMeters: null,
		});
	} else if (status === 'Failed') {
		events.push({
			id: `${detail.id}-failed`,
			type: 'status_changed',
			at: detail.completedAt ?? detail.updatedAt,
			actorName: detail.crewMembers[0]?.displayName ?? actorName,
			fromStatus: 'In Progress',
			toStatus: 'Failed',
			summary: detail.failedReason ?? 'Task failed',
			detail: null,
			latitude: null,
			longitude: null,
			accuracyMeters: null,
		});
	} else if (status === 'Undetermined') {
		events.push({
			id: `${detail.id}-undetermined`,
			type: 'status_changed',
			at: detail.completedAt ?? detail.updatedAt,
			actorName: detail.crewMembers[0]?.displayName ?? actorName,
			fromStatus: 'In Progress',
			toStatus: 'Undetermined',
			summary: 'Mixed crew outcomes',
			detail: null,
			latitude: null,
			longitude: null,
			accuracyMeters: null,
		});
	} else if (status === 'Cancelled') {
		events.push({
			id: `${detail.id}-cancelled`,
			type: 'cancelled',
			at: detail.cancelledAt ?? detail.updatedAt,
			actorName,
			fromStatus: crewIds.length > 0 ? 'Assigned' : 'Unassigned',
			toStatus: 'Cancelled',
			summary: 'Task cancelled',
			detail: null,
			latitude: null,
			longitude: null,
			accuracyMeters: null,
		});
	}

	return events.sort((a, b) => {
		const at = a.at ? new Date(a.at).getTime() : 0;
		const bt = b.at ? new Date(b.at).getTime() : 0;
		return at - bt;
	});
}
