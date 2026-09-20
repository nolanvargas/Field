import type { TaskHistoryEvent } from '../../api/tasks';
import type {
	AttachmentKind,
	TaskDetail,
	TaskStatus,
} from '../../types/task';
import curatedIndex from '../../../fixtures/curated/index.json';
import curatedFilesManifest from '../../../fixtures/curated/files/manifest.json';
import {
	demoCuratedStorageKey,
	materializeCuratedFixtureToSeedTask,
	type CuratedSeedAttachment,
	type CuratedSeedCrewEvent,
	type CuratedSeedTask,
} from '../../../shared/curatedTasks.mjs';
import {
	DEMO_ADMIN_USER_ID,
	DEMO_CREW_USER_ID,
} from './boot';
import { buildDemoTaskHistory } from './demoHistory';
import type { DemoTaskRecord } from './generateDemoTasks';
import {
	DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
} from './attachmentMedia';

type CuratedIndex = {
	schemaVersion: number;
	tasks: { slug: string; seedId?: number }[];
};

type FilesManifest = {
	schemaVersion: number;
	files: Record<
		string,
		{
			storageKey: string;
			relativePath: string;
			mimeType: string;
			fileName: string;
			byteSize: number;
		}
	>;
};

const taskModules = import.meta.glob('../../../fixtures/curated/tasks/*.json', {
	eager: true,
	import: 'default',
});

function demoStorageKeyForFileRef(fileRef: string): string {
	const manifest = curatedFilesManifest as FilesManifest;
	const meta = manifest.files[fileRef];
	if (!meta) return `demo/curated/${fileRef}`;
	return demoCuratedStorageKey(meta.relativePath);
}

function mapUserIdForDemo(_sandbocksUserId: string, role: 'creator' | 'crew'): string {
	if (role === 'creator') return DEMO_ADMIN_USER_ID;
	return DEMO_CREW_USER_ID;
}

function seedTaskToDemoDetail(
	seed: CuratedSeedTask,
	fixture: Record<string, unknown>,
): TaskDetail {
	const task = fixture.task as Record<string, unknown>;
	const destination = task.destination as Record<string, unknown>;
	const contactsRaw = (task.contacts as Record<string, unknown>[]) ?? [];
	const crewRaw = (task.crew as Record<string, unknown>[]) ?? [];

	const createdByName =
		(task.createdByDisplayName as string | null) ?? 'Demo Dispatch';

	const crewMembers = crewRaw.map((member, index) => {
		const userId = mapUserIdForDemo(String(member.userId), 'crew');
		const displayName =
			(member.displayName as string | null) ??
			(index === 0 ? 'Demo Crew Lead' : 'Demo Crew');
		const events = (seed.crewEvents ?? []).filter(
			(e: CuratedSeedCrewEvent) => e.userId === String(member.userId),
		);
		const started = events.find((e: CuratedSeedCrewEvent) => e.type === 'started');
		const ended = events.find((e: CuratedSeedCrewEvent) => e.type === 'ended');
		return {
			id: userId,
			displayName,
			isLead: Boolean(member.isLead ?? index === 0),
			startedAt: started?.at ?? null,
			endedAt: ended?.at ?? null,
		};
	});

	const contacts = contactsRaw.map((c) => ({
		id: Number(c.contactId),
		name: String(c.name ?? 'Contact'),
		title: String(c.title ?? ''),
		phone: String(c.phone ?? ''),
		email: String(c.email ?? ''),
		isPoc: Boolean(c.isPoc),
		receivesEmail: Boolean(c.receivesEmail ?? c.isPoc),
	}));

	let attachmentId = 1;
	const attFixtures = (fixture.attachments as { fileRef: string }[]) ?? [];
	const attachments =
		seed.attachments?.map((a: CuratedSeedAttachment, i: number) => ({
			id: attachmentId++,
			taskId: seed.id,
			kind: a.kind as AttachmentKind,
			storageKey: attFixtures[i]
				? demoStorageKeyForFileRef(attFixtures[i].fileRef)
				: a.storageKey,
			mimeType: a.mimeType,
			fileName: a.fileName,
			fileSizeBytes: a.fileSizeBytes ?? null,
			caption: a.caption ?? null,
			createdAt: a.at ?? seed.createdAt,
			uploadedByUserId: mapUserIdForDemo(a.uploadedBy, 'crew'),
			uploadedByName: null,
			attachmentTypeId:
				a.attachmentTypeSlug === 'completion_photos'
					? DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID
					: null,
			attachmentTypeSlug: a.attachmentTypeSlug ?? null,
			attachmentTypeLabel: null,
		})) ?? [];

	const jobTitle =
		seed.jobTitle?.trim() ||
		seed.description.split('\n')[0]?.trim() ||
		`Task #${seed.id}`;

	return {
		id: seed.id,
		taskType: seed.taskType,
		status: seed.status as TaskStatus,
		description: seed.description,
		jobTitle,
		externalKey: seed.externalKey ?? '',
		destinationAddressId:
			destination.addressId != null ? Number(destination.addressId) : null,
		destinationAddressName: String(destination.addressName ?? ''),
		destinationAddress: String(destination.streetLine ?? ''),
		destinationBuilding: String(destination.building ?? ''),
		destinationNotes: String(destination.notes ?? ''),
		destinationLatitude:
			destination.latitude != null ? Number(destination.latitude) : null,
		destinationLongitude:
			destination.longitude != null ? Number(destination.longitude) : null,
		windowStartAt: seed.windowStart ?? null,
		windowEndAt: seed.windowEnd ?? null,
		completedNotes: seed.completedNotes ?? null,
		completedAt: seed.completedAt ?? null,
		failedReason: seed.failedReason ?? null,
		cancelledAt: seed.cancelledAt ?? null,
		archiveAt: seed.archiveAt ?? null,
		createdAt: seed.createdAt,
		updatedAt: seed.updatedAt,
		createdByName,
		crewMembers,
		contacts,
		attachments,
		completionNotes: [],
		completionNotesByName: null,
		customFields: {},
		customFieldDefs: [],
		customFieldDisplays: {},
	};
}

export function buildCuratedDemoRecords(
	anchorMs = Date.now(),
): DemoTaskRecord[] {
	const index = curatedIndex as CuratedIndex;
	const manifest = curatedFilesManifest as FilesManifest;
	if (index.tasks.length === 0) return [];

	const records: DemoTaskRecord[] = [];

	for (const entry of index.tasks) {
		const pathKey = `../../../fixtures/curated/tasks/${entry.slug}.json`;
		const fixture = taskModules[pathKey] as Record<string, unknown> | undefined;
		if (!fixture) continue;

		const seed = materializeCuratedFixtureToSeedTask(fixture, anchorMs, {
			storageKeyForFileRef: (fileRef: string) => {
				const meta = manifest.files[fileRef];
				if (!meta) throw new Error(`Unknown curated file ${fileRef}`);
				return demoStorageKeyForFileRef(fileRef);
			},
			fileSizeForFileRef: (fileRef: string) =>
				manifest.files[fileRef]?.byteSize ?? null,
		});

		const detail = seedTaskToDemoDetail(seed, fixture);
		const crewMemberIds = detail.crewMembers.map((m) => m.id);
		const createdByUserId = mapUserIdForDemo(
			String((fixture.task as Record<string, unknown>).createdByUserId),
			'creator',
		);
		const history: TaskHistoryEvent[] = buildDemoTaskHistory({
			detail,
			crewMemberIds,
			createdByUserId,
		});

		records.push({
			detail,
			crewMemberIds,
			createdByUserId,
			history,
		});
	}

	return records.sort((a, b) => {
		const at = new Date(a.detail.createdAt).getTime();
		const bt = new Date(b.detail.createdAt).getTime();
		return bt - at || b.detail.id - a.detail.id;
	});
}

export function curatedDemoTaskCount(): number {
	return (curatedIndex as CuratedIndex).tasks.length;
}
