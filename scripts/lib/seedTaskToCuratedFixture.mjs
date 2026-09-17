/**
 * Convert an in-memory SeedTask (absolute ISO times) to curated fixture JSON.
 */
import { createHash } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	CURATED_SCHEMA_VERSION,
	curatedStorageKeyForHash,
	demoCuratedStorageKey,
	offsetMsFromIso,
	slugifyCuratedTask,
} from "../../shared/curatedTasks.mjs";
import { CURATED_FILES_DIR } from "./curatedTasksPaths.mjs";
import { getObjectBuffer } from "../../server/storage.mjs";
import { seedStorageByteSize } from "./seedStorage.mjs";

/** @param {string | null | undefined} iso @param {string} capturedAt */
function timeField(capturedAt, iso) {
	const offsetMs = offsetMsFromIso(capturedAt, iso ?? null);
	if (offsetMs == null) return null;
	return { offsetMs };
}

/**
 * @param {Buffer} body
 * @param {string} fileName
 * @param {string} mimeType
 * @param {Record<string, { storageKey: string, relativePath: string, mimeType: string, fileName: string, byteSize: number }>} filesMap
 */
async function ensureFileInManifest(body, fileName, mimeType, filesMap) {
	const sha256 = createHash("sha256").update(body).digest("hex");
	if (filesMap[sha256]) return sha256;
	const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
	const relativePath = `${sha256.slice(0, 32)}${ext}`;
	const destPath = path.join(CURATED_FILES_DIR, relativePath);
	try {
		await access(destPath);
	} catch {
		await writeFile(destPath, body);
	}
	filesMap[sha256] = {
		storageKey: curatedStorageKeyForHash(sha256, fileName),
		relativePath,
		mimeType,
		fileName,
		byteSize: body.length,
	};
	return sha256;
}

/**
 * @param {string} storageKey
 * @param {string} fileName
 * @param {string} mimeType
 * @param {Record<string, { storageKey: string, relativePath: string, mimeType: string, fileName: string, byteSize: number }>} filesMap
 */
async function fileRefForStorageKey(storageKey, fileName, mimeType, filesMap) {
	try {
		const body = await getObjectBuffer(storageKey);
		return ensureFileInManifest(body, fileName, mimeType, filesMap);
	} catch {
		const size = seedStorageByteSize(storageKey);
		const body = Buffer.alloc(size ?? 128);
		return ensureFileInManifest(body, fileName, mimeType, filesMap);
	}
}

/**
 * @param {import('./insertSeedTask.mjs').SeedTask} t
 * @param {string} capturedAt
 * @param {Record<string, { storageKey: string, relativePath: string, mimeType: string, fileName: string, byteSize: number }>} filesMap
 */
export async function seedTaskToCuratedFixture(t, capturedAt, filesMap) {
	const slug = slugifyCuratedTask(
		t.jobTitle || t.description.split("\n")[0] || `task-${t.id}`,
	);
	const attachments = [];
	for (const a of t.attachments ?? []) {
		const fileRef = await fileRefForStorageKey(
			a.storageKey,
			a.fileName,
			a.mimeType,
			filesMap,
		);
		attachments.push({
			fileRef,
			kind: a.kind,
			mimeType: a.mimeType,
			fileName: a.fileName,
			caption: a.caption ?? null,
			uploadedByUserId: a.uploadedBy,
			attachmentTypeSlug: a.attachmentTypeSlug ?? null,
			byteSize: seedStorageByteSize(a.storageKey),
			at: timeField(capturedAt, a.at),
		});
	}
	const documents = [];
	for (const d of t.documents ?? []) {
		const fileRef = await fileRefForStorageKey(
			d.storageKey,
			d.fileName,
			"application/pdf",
			filesMap,
		);
		documents.push({
			fileRef,
			kind: d.kind,
			fileName: d.fileName,
			generatedByUserId: d.generatedBy ?? null,
			generatedAt: timeField(capturedAt, d.generatedAt),
		});
	}

	return {
		schemaVersion: CURATED_SCHEMA_VERSION,
		slug: `${slug}-${t.id}`,
		seedId: t.id,
		capturedAt,
		task: {
			taskType: t.taskType,
			status: t.status,
			description: t.description,
			jobTitle: t.jobTitle ?? null,
			externalKey: t.externalKey ?? null,
			createdByUserId: t.createdBy,
			createdByDisplayName: null,
			crewSize: t.crewSize ?? null,
			hours: t.hours ?? null,
			isTimeSpecific: Boolean(t.isTimeSpecific),
			canStartEarly: Boolean(t.canStartEarly),
			completedNotes: t.completedNotes ?? null,
			failedReason: t.failedReason ?? null,
			statusBeforeCancel: t.statusBeforeCancel ?? null,
			destination: {
				addressId: t.destinationId ?? null,
				addressName: null,
				streetLine: null,
				building: null,
				notes: null,
				latitude: null,
				longitude: null,
			},
			crew: (t.crew ?? []).map((userId, index) => ({
				userId,
				displayName: null,
				isLead: index === 0,
			})),
			contacts: (t.contacts ?? []).map((c) => ({
				contactId: c.id,
				name: null,
				email: null,
				phone: null,
				title: null,
				isPoc: Boolean(c.isPoc),
				receivesEmail:
					c.receivesEmail != null ? Boolean(c.receivesEmail) : undefined,
			})),
		},
		times: {
			windowStartAt: timeField(capturedAt, t.windowStart ?? null),
			windowEndAt: timeField(capturedAt, t.windowEnd ?? null),
			completedAt: timeField(capturedAt, t.completedAt ?? null),
			createdAt: timeField(capturedAt, t.createdAt),
			updatedAt: timeField(capturedAt, t.updatedAt),
			deletedAt: timeField(capturedAt, t.deletedAt ?? null),
			cancelledAt: timeField(capturedAt, t.cancelledAt ?? null),
			archiveAt: timeField(capturedAt, t.archiveAt ?? null),
		},
		crewEvents: (t.crewEvents ?? []).map((e) => ({
			userId: e.userId,
			type: e.type,
			lat: e.lat,
			lng: e.lng,
			at: timeField(capturedAt, e.at),
		})),
		completionNotes: (t.completionNotes ?? []).map((n) => ({
			userId: n.userId,
			outcome: n.outcome,
			notes: n.notes ?? null,
		})),
		attachments,
		documents,
		emails: (t.emails ?? []).map((m) => ({
			trigger: m.trigger,
			to: m.to,
			subject: m.subject,
			status: m.status,
			sentAt: timeField(capturedAt, m.sentAt ?? null),
			error: m.error ?? null,
		})),
		history: (t.history ?? []).map((h) => ({
			eventType: h.eventType,
			actorUserId: h.actorUserId ?? null,
			fromStatus: h.fromStatus ?? null,
			toStatus: h.toStatus ?? null,
			summary: h.summary ?? null,
			recordedAt: timeField(capturedAt, h.recordedAt),
		})),
	};
}

export { demoCuratedStorageKey };
