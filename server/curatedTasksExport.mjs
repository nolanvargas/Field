/**
 * Export a live task into fixtures/curated (local dev only).
 */
import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db.mjs";
import { isS3Enabled, getObjectBuffer, sanitizeFileName } from "./storage.mjs";
import {
	CURATED_SCHEMA_VERSION,
	curatedStorageKeyForHash,
	offsetMsFromIso,
	slugifyCuratedTask,
} from "../shared/curatedTasks.mjs";
import {
	CURATED_FILES_DIR,
	CURATED_TASKS_DIR,
} from "../scripts/lib/curatedTasksPaths.mjs";
import {
	loadCuratedFilesManifest,
	loadCuratedIndex,
	writeCuratedIndexAndManifest,
	writeCuratedTaskFixture,
} from "../scripts/lib/curatedTasks.mjs";

export function isCuratedExportAllowed() {
	if (isS3Enabled()) return false;
	if (process.env.FIELD_ALLOW_CURATED_EXPORT === "0") return false;
	return true;
}

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
	if (filesMap[sha256]) {
		return sha256;
	}
	const safeName = sanitizeFileName(fileName);
	const ext = safeName.includes(".")
		? safeName.slice(safeName.lastIndexOf("."))
		: "";
	const relativePath = `${sha256.slice(0, 32)}${ext}`;
	const destPath = path.join(CURATED_FILES_DIR, relativePath);
	await mkdir(CURATED_FILES_DIR, { recursive: true });
	try {
		await access(destPath);
	} catch {
		await writeFile(destPath, body);
	}
	filesMap[sha256] = {
		storageKey: curatedStorageKeyForHash(sha256, safeName),
		relativePath,
		mimeType,
		fileName: safeName,
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
	const body = await getObjectBuffer(storageKey);
	return ensureFileInManifest(body, fileName, mimeType, filesMap);
}

/**
 * @param {number} taskId
 * @param {string} [requestedSlug]
 */
export async function exportTaskToCuratedFixtures(taskId, requestedSlug) {
	if (!isCuratedExportAllowed()) {
		throw Object.assign(new Error("Curated export is disabled in this environment"), {
			status: 403,
		});
	}

	const pool = getPool();
	const capturedAt = new Date().toISOString();

	const { rows: taskRows } = await pool.query(
		`SELECT
       t.id,
       t.task_type,
       t.status,
       t.description,
       t.job_title,
       t.external_key,
       t.created_by_user_id,
       t.destination_address_id,
       t.destination_address_name,
       t.destination_address,
       t.destination_building,
       t.destination_notes,
       t.destination_latitude,
       t.destination_longitude,
       t.custom_fields,
       t.window_start_at,
       t.window_end_at,
       t.completed_notes,
       t.completed_at,
       t.failed_reason,
       t.cancelled_at,
       t.status_before_cancel,
       t.archive_at,
       t.deleted_at,
       t.created_at,
       t.updated_at,
       cu.display_name AS created_by_name
     FROM tasks t
     LEFT JOIN users cu ON cu.id = t.created_by_user_id
     WHERE t.id = $1`,
		[taskId],
	);
	if (taskRows.length === 0) {
		throw Object.assign(new Error("Task not found"), { status: 404 });
	}
	const row = taskRows[0];

	const customFields = row.custom_fields ?? {};
	const crewSize = customFields["1"] != null ? Number(customFields["1"]) : null;
	const hours = customFields["2"] != null ? Number(customFields["2"]) : null;
	const canStartEarly = Boolean(customFields["3"]);
	const isTimeSpecific = Boolean(customFields["4"]);

	const { rows: crewRows } = await pool.query(
		`SELECT tcm.user_id, tcm.is_lead, u.display_name
     FROM task_crew_members tcm
     JOIN users u ON u.id = tcm.user_id
     WHERE tcm.task_id = $1
     ORDER BY tcm.is_lead DESC, u.display_name`,
		[taskId],
	);

	const { rows: contactRows } = await pool.query(
		`SELECT tc.contact_id, tc.is_poc, tc.receives_email,
            c.name, c.email, c.phone, c.title
     FROM task_contacts tc
     JOIN contacts c ON c.id = tc.contact_id
     WHERE tc.task_id = $1
     ORDER BY tc.is_poc DESC, c.name`,
		[taskId],
	);

	const { rows: crewEventRows } = await pool.query(
		`SELECT user_id, event_type, latitude, longitude, recorded_at
     FROM task_crew_events
     WHERE task_id = $1
     ORDER BY recorded_at, id`,
		[taskId],
	);

	const { rows: completionNoteRows } = await pool.query(
		`SELECT user_id, outcome, notes
     FROM task_completion_notes
     WHERE task_id = $1`,
		[taskId],
	);

	const { rows: attachmentRows } = await pool.query(
		`SELECT a.kind, a.storage_key, a.mime_type, a.file_name, a.caption,
            a.created_at, a.uploaded_by_user_id, a.file_size_bytes,
            tat.slug AS attachment_type_slug
     FROM task_attachments a
     LEFT JOIN org_attachment_type_defs tat ON tat.id = a.attachment_type_id
     WHERE a.task_id = $1
     ORDER BY a.created_at, a.id`,
		[taskId],
	);

	const { rows: documentRows } = await pool.query(
		`SELECT kind, storage_key, file_name, generated_at, generated_by_user_id
     FROM task_documents
     WHERE task_id = $1`,
		[taskId],
	);

	const { rows: emailRows } = await pool.query(
		`SELECT "trigger", to_addresses, subject, status, sent_at, error_message
     FROM email_deliveries
     WHERE task_id = $1`,
		[taskId],
	);

	const { rows: historyRows } = await pool.query(
		`SELECT event_type, actor_user_id, from_status, to_status, summary, recorded_at
     FROM task_history_events
     WHERE task_id = $1
     ORDER BY recorded_at, id`,
		[taskId],
	);

	const index = await loadCuratedIndex();
	const manifest = await loadCuratedFilesManifest();
	const filesMap = { ...manifest.files };

	const slugBase =
		requestedSlug?.trim() ||
		slugifyCuratedTask(row.job_title || row.description?.split("\n")[0] || `task-${taskId}`);
	let slug = slugBase;
	let n = 2;
	while (index.tasks.some((t) => t.slug === slug)) {
		slug = `${slugBase}-${n}`;
		n += 1;
	}

	const existingSeedIds = index.tasks
		.map((t) => t.seedId)
		.filter((id) => typeof id === "number");
	const seedId =
		existingSeedIds.length > 0 ? Math.max(...existingSeedIds) + 1 : 1;

	const attachments = [];
	for (const a of attachmentRows) {
		const fileRef = await fileRefForStorageKey(
			String(a.storage_key),
			String(a.file_name || "file"),
			String(a.mime_type),
			filesMap,
		);
		attachments.push({
			fileRef,
			kind: a.kind,
			mimeType: a.mime_type,
			fileName: a.file_name,
			caption: a.caption,
			uploadedByUserId: String(a.uploaded_by_user_id),
			attachmentTypeSlug: a.attachment_type_slug,
			byteSize: a.file_size_bytes != null ? Number(a.file_size_bytes) : null,
			at: timeField(capturedAt, new Date(a.created_at).toISOString()),
		});
	}

	/** @type {Record<string, unknown>[]} */
	const documents = [];
	for (const d of documentRows) {
		const fileRef = await fileRefForStorageKey(
			String(d.storage_key),
			String(d.file_name),
			"application/pdf",
			filesMap,
		);
		documents.push({
			fileRef,
			kind: d.kind,
			fileName: d.file_name,
			generatedByUserId:
				d.generated_by_user_id != null ? String(d.generated_by_user_id) : null,
			generatedAt: timeField(
				capturedAt,
				new Date(d.generated_at).toISOString(),
			),
		});
	}

	const fixture = {
		schemaVersion: CURATED_SCHEMA_VERSION,
		slug,
		seedId,
		capturedAt,
		task: {
			taskType: row.task_type,
			status: row.status,
			description: row.description ?? "",
			jobTitle: row.job_title,
			externalKey: row.external_key,
			createdByUserId: String(row.created_by_user_id),
			createdByDisplayName: row.created_by_name,
			crewSize,
			hours,
			isTimeSpecific,
			canStartEarly,
			completedNotes: row.completed_notes,
			failedReason: row.failed_reason,
			statusBeforeCancel: row.status_before_cancel,
			destination: {
				addressId: row.destination_address_id,
				addressName: row.destination_address_name,
				streetLine: row.destination_address,
				building: row.destination_building,
				notes: row.destination_notes,
				latitude:
					row.destination_latitude != null
						? Number(row.destination_latitude)
						: null,
				longitude:
					row.destination_longitude != null
						? Number(row.destination_longitude)
						: null,
			},
			crew: crewRows.map((c) => ({
				userId: String(c.user_id),
				displayName: c.display_name,
				isLead: Boolean(c.is_lead),
			})),
			contacts: contactRows.map((c) => ({
				contactId: Number(c.contact_id),
				name: c.name,
				email: c.email,
				phone: c.phone,
				title: c.title,
				isPoc: Boolean(c.is_poc),
				receivesEmail: Boolean(c.receives_email),
			})),
		},
		times: {
			windowStartAt: timeField(
				capturedAt,
				row.window_start_at ? new Date(row.window_start_at).toISOString() : null,
			),
			windowEndAt: timeField(
				capturedAt,
				row.window_end_at ? new Date(row.window_end_at).toISOString() : null,
			),
			completedAt: timeField(
				capturedAt,
				row.completed_at ? new Date(row.completed_at).toISOString() : null,
			),
			createdAt: timeField(capturedAt, new Date(row.created_at).toISOString()),
			updatedAt: timeField(capturedAt, new Date(row.updated_at).toISOString()),
			deletedAt: timeField(
				capturedAt,
				row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
			),
			cancelledAt: timeField(
				capturedAt,
				row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
			),
			archiveAt: timeField(
				capturedAt,
				row.archive_at ? new Date(row.archive_at).toISOString() : null,
			),
		},
		crewEvents: crewEventRows.map((e) => ({
			userId: String(e.user_id),
			type: e.event_type,
			lat: e.latitude != null ? Number(e.latitude) : undefined,
			lng: e.longitude != null ? Number(e.longitude) : undefined,
			at: timeField(capturedAt, new Date(e.recorded_at).toISOString()),
		})),
		completionNotes: completionNoteRows.map((n) => ({
			userId: String(n.user_id),
			outcome: n.outcome,
			notes: n.notes,
		})),
		attachments,
		documents,
		emails: emailRows.map((m) => ({
			trigger: m.trigger,
			to: m.to_addresses,
			subject: m.subject,
			status: m.status,
			sentAt: timeField(
				capturedAt,
				m.sent_at ? new Date(m.sent_at).toISOString() : null,
			),
			error: m.error_message,
		})),
		history: historyRows.map((h) => ({
			eventType: h.event_type,
			actorUserId:
				h.actor_user_id != null ? String(h.actor_user_id) : null,
			fromStatus: h.from_status,
			toStatus: h.to_status,
			summary: h.summary,
			recordedAt: timeField(
				capturedAt,
				new Date(h.recorded_at).toISOString(),
			),
		})),
	};

	await writeCuratedTaskFixture(slug, fixture);

	const nextIndex = {
		schemaVersion: CURATED_SCHEMA_VERSION,
		tasks: [...index.tasks, { slug, seedId }],
	};
	const nextManifest = {
		schemaVersion: CURATED_SCHEMA_VERSION,
		files: filesMap,
	};
	await writeCuratedIndexAndManifest(nextIndex, nextManifest);

	return {
		slug,
		seedId,
		path: path.relative(process.cwd(), path.join(CURATED_TASKS_DIR, `${slug}.json`)),
		capturedAt,
	};
}
