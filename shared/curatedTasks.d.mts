export const CURATED_SCHEMA_VERSION: number;

export function offsetMsFromIso(
	capturedAtIso: string | null | undefined,
	valueIso: string | null | undefined,
): number | null;

export function materializeOffset(
	anchorMs: number,
	field: { offsetMs: number } | null | undefined,
): string | null;

export function slugifyCuratedTask(text: string): string;

export function curatedStorageKeyForHash(sha256Hex: string, fileName: string): string;

export function demoCuratedStorageKey(relativePath: string): string;

export interface CuratedSeedCrewEvent {
	userId: string;
	type: 'started' | 'ended';
	lat?: number;
	lng?: number;
	at: string | null;
}

export interface CuratedSeedAttachment {
	kind: string;
	storageKey: string;
	mimeType: string;
	fileName: string;
	caption: string | null;
	uploadedBy: string;
	at: string | null;
	attachmentTypeSlug?: string;
	fileSizeBytes?: number;
}

export interface CuratedSeedTask {
	id: number;
	taskType: string;
	status: string;
	description: string;
	jobTitle: string | null;
	externalKey: string | null;
	createdBy: string;
	destinationId: number | null;
	crewSize: number | null;
	hours: number | null;
	isTimeSpecific: boolean;
	canStartEarly: boolean;
	windowStart: string | null;
	windowEnd: string | null;
	completedNotes: string | null;
	completedAt: string | null;
	failedReason: string | null;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	cancelledAt: string | null;
	statusBeforeCancel: string | null;
	archiveAt: string | null;
	crew: string[];
	contacts: { id: number; isPoc?: boolean; receivesEmail?: boolean }[];
	crewEvents: CuratedSeedCrewEvent[];
	completionNotes: {
		userId: string;
		outcome: 'Completed' | 'Failed';
		notes: string | null;
	}[];
	attachments: CuratedSeedAttachment[];
	documents: unknown[];
	emails: unknown[];
	history: unknown[];
}

export function materializeCuratedFixtureToSeedTask(
	fixture: Record<string, unknown>,
	anchorMs: number,
	files: {
		storageKeyForFileRef: (fileRef: string) => string;
		fileSizeForFileRef?: (fileRef: string) => number | null;
	},
): CuratedSeedTask;
