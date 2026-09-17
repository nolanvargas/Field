/**
 * Insert a dev seed task and related rows (shared by seed-dev-tasks and curated load).
 */
import { randomBytes } from "node:crypto";
import { buildCustomFieldDefsSnapshot } from "../../server/customFields.mjs";
import { seedStorageByteSize } from "./seedStorage.mjs";

/**
 * @typedef {{
 *   id: number,
 *   taskType: string,
 *   status: string,
 *   description: string,
 *   jobTitle?: string | null,
 *   externalKey?: string | null,
 *   createdBy: string,
 *   destinationId?: number | null,
 *   crewSize?: number | null,
 *   hours?: number | null,
 *   isTimeSpecific?: boolean,
 *   canStartEarly?: boolean,
 *   windowStart?: string | null,
 *   windowEnd?: string | null,
 *   completedNotes?: string | null,
 *   completedAt?: string | null,
 *   failedReason?: string | null,
 *   createdAt: string,
 *   updatedAt: string,
 *   deletedAt?: string | null,
 *   crew?: string[],
 *   contacts?: { id: number, isPoc?: boolean, receivesEmail?: boolean }[],
 *   crewEvents?: { userId: string, type: 'started'|'ended', at: string, lat?: number, lng?: number }[],
 *   completionNotes?: { userId: string, outcome: 'Completed'|'Failed', notes?: string | null }[],
 *   attachments?: { kind: string, storageKey: string, mimeType: string, fileName: string, caption?: string | null, uploadedBy: string, at: string, attachmentTypeSlug?: string, fileSizeBytes?: number }[],
 *   documents?: { kind: string, storageKey: string, fileName: string, generatedAt: string, generatedBy?: string | null }[],
 *   emails?: { trigger: string, to: string, subject: string, status: string, sentAt?: string | null, error?: string | null }[],
 *   history?: { eventType: string, actorUserId?: string | null, fromStatus?: string | null, toStatus?: string | null, summary?: string | null, recordedAt: string }[],
 *   cancelledAt?: string | null,
 *   statusBeforeCancel?: string | null,
 *   archiveAt?: string | null,
 * }} SeedTask
 */

/**
 * @param {SeedTask} t
 * @returns {{ jobTitle: string, description: string }}
 */
export function resolveTaskText(t) {
	if (t.jobTitle?.trim()) {
		return { jobTitle: t.jobTitle.trim(), description: t.description };
	}
	const nl = t.description.indexOf("\n");
	if (nl === -1) {
		return { jobTitle: t.description.trim(), description: "" };
	}
	const jobTitle = t.description.slice(0, nl).trim();
	const description = t.description.slice(nl + 1).trim();
	return { jobTitle, description: description || jobTitle };
}

/**
 * @param {import('pg').Client} client
 * @returns {Promise<Map<string, number>>}
 */
export async function loadTaskTypeIds(client) {
	const { rows } = await client.query(
		`SELECT id, slug FROM org_task_types WHERE retired_at IS NULL`,
	);
	return new Map(rows.map((row) => [String(row.slug), Number(row.id)]));
}

/**
 * @param {import('pg').Client} client
 */
export async function loadAttachmentTypeIdsBySlug(client) {
	const { rows } = await client.query(
		`SELECT id, slug FROM org_attachment_type_defs WHERE retired_at IS NULL`,
	);
	return new Map(rows.map((row) => [String(row.slug), Number(row.id)]));
}

/**
 * @param {import('pg').Client} client
 */
export async function loadTaskCustomFieldDefsSnapshot(client) {
	const { rows } = await client.query(
		`SELECT slot, label, data_type, required, lookup_table, options, show_when
     FROM org_custom_field_defs
     WHERE entity_type = 'task'
     ORDER BY slot`,
	);
	return buildCustomFieldDefsSnapshot(
		rows.map((row) => ({
			slot: row.slot,
			label: row.label,
			dataType: row.data_type,
			required: row.required,
			lookupTable: row.lookup_table,
			options: row.options,
			showWhen: row.show_when,
		})),
	);
}

/**
 * @param {import('pg').Client} client
 * @param {SeedTask} t
 * @param {{
 *   taskTypeIds: Map<string, number>,
 *   attachmentTypeIds: Map<string, number>,
 *   customFieldDefsSnapshot: ReturnType<typeof buildCustomFieldDefsSnapshot>,
 *   fileSizeForStorageKey?: (storageKey: string) => number | null,
 * }} ctx
 */
export async function insertSeedTask(client, t, ctx) {
	const trackingToken = randomBytes(32).toString("base64url");
	const { jobTitle, description } = resolveTaskText(t);
	/** @type {{ address_name: string | null, street_line: string | null, building: string | null, notes: string | null, latitude: number | null, longitude: number | null } | null} */
	let destination = null;
	if (t.destinationId != null) {
		const { rows } = await client.query(
			`SELECT address_name, street_line, building, notes, latitude, longitude
       FROM addresses
       WHERE id = $1 AND deleted_at IS NULL`,
			[t.destinationId],
		);
		destination = rows[0] ?? null;
	}
	const startedEvent = (t.crewEvents ?? []).find(
		(event) => event.type === "started" && event.lat != null,
	);
	const destinationLatitude =
		destination?.latitude != null
			? Number(destination.latitude)
			: startedEvent?.lat ?? null;
	const destinationLongitude =
		destination?.longitude != null
			? Number(destination.longitude)
			: startedEvent?.lng ?? null;
	const taskTypeId = ctx.taskTypeIds.get(t.taskType) ?? null;
	const customFields = {};
	if (t.crewSize != null) customFields["1"] = t.crewSize;
	if (t.hours != null) customFields["2"] = t.hours;
	if (t.canStartEarly) customFields["3"] = true;
	if (t.isTimeSpecific) customFields["4"] = true;
	await client.query(
		`INSERT INTO tasks (
       id, task_type, task_type_id, status, description, job_title, external_key, created_by_user_id,
       destination_address_id, destination_address_name, destination_address,
       destination_building, destination_notes, destination_latitude, destination_longitude,
       custom_fields, custom_field_defs_snapshot,
       window_start_at, window_end_at,
       completed_notes, completed_at, failed_reason,
       cancelled_at, status_before_cancel, archive_at,
       deleted_at, created_at, updated_at, tracking_token
     ) VALUES (
       $1, $2, $3, $4::task_status, $5, $6, $7, $8::uuid,
       $9, $10, $11, $12, $13, $14, $15,
       $16::jsonb, $17::jsonb,
       $18::timestamptz, $19::timestamptz,
       $20, $21::timestamptz, $22,
       $23::timestamptz, $24::task_status, $25::timestamptz,
       $26::timestamptz, $27::timestamptz, $28::timestamptz, $29
     )`,
		[
			t.id,
			t.taskType,
			taskTypeId,
			t.status,
			description,
			jobTitle,
			t.externalKey ?? null,
			t.createdBy,
			t.destinationId ?? null,
			destination?.address_name ?? null,
			destination?.street_line ?? null,
			destination?.building ?? null,
			destination?.notes ?? null,
			destinationLatitude,
			destinationLongitude,
			JSON.stringify(customFields),
			JSON.stringify(ctx.customFieldDefsSnapshot),
			t.windowStart ?? null,
			t.windowEnd ?? null,
			t.completedNotes ?? null,
			t.completedAt ?? null,
			t.failedReason ?? null,
			t.cancelledAt ?? null,
			t.statusBeforeCancel ?? null,
			t.archiveAt ?? null,
			t.deletedAt ?? null,
			t.createdAt,
			t.updatedAt,
			trackingToken,
		],
	);

	for (const [index, userId] of (t.crew ?? []).entries()) {
		await client.query(
			`INSERT INTO task_crew_members (task_id, user_id, is_lead) VALUES ($1, $2::uuid, $3)`,
			[t.id, userId, index === 0],
		);
	}

	for (const c of t.contacts ?? []) {
		await client.query(
			`INSERT INTO task_contacts (task_id, contact_id, is_poc, receives_email)
       VALUES ($1, $2, $3, $4)`,
			[
				t.id,
				c.id,
				Boolean(c.isPoc),
				c.receivesEmail != null ? Boolean(c.receivesEmail) : Boolean(c.isPoc),
			],
		);
	}

	for (const e of t.crewEvents ?? []) {
		await client.query(
			`INSERT INTO task_crew_events (
         task_id, user_id, event_type, latitude, longitude, accuracy_meters, recorded_at
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7::timestamptz)`,
			[
				t.id,
				e.userId,
				e.type,
				e.lat ?? null,
				e.lng ?? null,
				e.lat != null ? 12.5 : null,
				e.at,
			],
		);
	}

	for (const n of t.completionNotes ?? []) {
		await client.query(
			`INSERT INTO task_completion_notes (task_id, user_id, outcome, notes)
       VALUES ($1, $2::uuid, $3, $4)`,
			[t.id, n.userId, n.outcome, n.notes ?? null],
		);
	}

	const sizeForKey =
		ctx.fileSizeForStorageKey ??
		((key) => seedStorageByteSize(key) ?? 125000);

	for (const a of t.attachments ?? []) {
		const fileSizeBytes =
			a.fileSizeBytes != null ? Number(a.fileSizeBytes) : sizeForKey(a.storageKey);
		const typeSlug =
			a.attachmentTypeSlug ??
			(a.kind === "photo" ? "completion_photos" : null);
		const attachmentTypeId =
			typeSlug != null ? ctx.attachmentTypeIds.get(typeSlug) ?? null : null;
		await client.query(
			`INSERT INTO task_attachments (
         task_id, uploaded_by_user_id, kind, storage_key, mime_type,
         file_name, file_size_bytes, caption, created_at, attachment_type_id
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10)`,
			[
				t.id,
				a.uploadedBy,
				a.kind,
				a.storageKey,
				a.mimeType,
				a.fileName,
				fileSizeBytes,
				a.caption ?? null,
				a.at,
				attachmentTypeId,
			],
		);
	}

	for (const d of t.documents ?? []) {
		await client.query(
			`INSERT INTO task_documents (
         task_id, kind, storage_key, file_name, generated_at, generated_by_user_id
       ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::uuid)`,
			[
				t.id,
				d.kind,
				d.storageKey,
				d.fileName,
				d.generatedAt,
				d.generatedBy ?? null,
			],
		);
	}

	for (const m of t.emails ?? []) {
		await client.query(
			`INSERT INTO email_deliveries (
         task_id, "trigger", to_addresses, subject, status,
         provider_message_id, error_message, sent_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
			[
				t.id,
				m.trigger,
				m.to,
				m.subject,
				m.status,
				m.status === "sent" ? `seed-${t.id}-${m.trigger}` : null,
				m.error ?? null,
				m.sentAt ?? null,
			],
		);
	}

	for (const h of t.history ?? []) {
		await client.query(
			`INSERT INTO task_history_events (
         task_id, event_type, actor_user_id, from_status, to_status, summary, recorded_at
       ) VALUES ($1, $2, $3::uuid, $4::task_status, $5::task_status, $6, $7::timestamptz)`,
			[
				t.id,
				h.eventType,
				h.actorUserId ?? null,
				h.fromStatus ?? null,
				h.toStatus ?? null,
				h.summary ?? null,
				h.recordedAt,
			],
		);
	}
}
