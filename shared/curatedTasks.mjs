/**
 * Curated task fixture helpers (schema v1).
 * Timestamps in fixtures are offsetMs from capturedAt; materialize at seed/demo anchor.
 */

export const CURATED_SCHEMA_VERSION = 1;

/** @param {string | null | undefined} capturedAtIso @param {string | null | undefined} valueIso */
export function offsetMsFromIso(capturedAtIso, valueIso) {
	if (valueIso == null || valueIso === "") return null;
	const anchor = new Date(capturedAtIso).getTime();
	const value = new Date(valueIso).getTime();
	if (Number.isNaN(anchor) || Number.isNaN(value)) {
		throw new Error(`Invalid datetime for offset: captured=${capturedAtIso} value=${valueIso}`);
	}
	return value - anchor;
}

/** @param {number} anchorMs @param {{ offsetMs: number } | null | undefined} field */
export function materializeOffset(anchorMs, field) {
	if (field == null || typeof field.offsetMs !== "number") return null;
	return new Date(anchorMs + field.offsetMs).toISOString();
}

/** @param {string} text */
export function slugifyCuratedTask(text) {
	const base = String(text || "task")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return base || "task";
}

/** @param {string} sha256Hex @param {string} fileName */
export function curatedStorageKeyForHash(sha256Hex, fileName) {
	const slice = sha256Hex.slice(0, 16);
	const ext = fileName.includes(".")
		? fileName.slice(fileName.lastIndexOf("."))
		: "";
	return `attachments/curated/${slice}${ext}`;
}

/** @param {string} relativePath basename under fixtures/curated/files/ */
export function demoCuratedStorageKey(relativePath) {
	return `demo/curated/${String(relativePath).replace(/^[/\\]+/, "")}`;
}

/**
 * @param {Record<string, unknown>} fixture task JSON (schema v1)
 * @param {number} anchorMs
 * @param {{ storageKeyForFileRef: (fileRef: string) => string, fileSizeForFileRef?: (fileRef: string) => number | null }} files
 */
export function materializeCuratedFixtureToSeedTask(fixture, anchorMs, files) {
	const task = /** @type {Record<string, unknown>} */ (fixture.task ?? {});
	const times = /** @type {Record<string, { offsetMs: number } | null>} */ (
		fixture.times ?? {}
	);
	const seedId = Number(fixture.seedId);

	const destination = /** @type {Record<string, unknown>} */ (task.destination ?? {});

	/** @type {string[]} */
	const crew = (Array.isArray(task.crew) ? task.crew : []).map((m) =>
		String(/** @type {{ userId: string }} */ (m).userId),
	);

	/** @type {{ id: number, isPoc?: boolean, receivesEmail?: boolean }[]} */
	const contacts = (Array.isArray(task.contacts) ? task.contacts : []).map((c) => {
		const row = /** @type {{ contactId: number, isPoc?: boolean, receivesEmail?: boolean }} */ (
			c
		);
		return {
			id: Number(row.contactId),
			isPoc: Boolean(row.isPoc),
			receivesEmail:
				row.receivesEmail != null ? Boolean(row.receivesEmail) : undefined,
		};
	});

	const mapFileRef = (fileRef) => files.storageKeyForFileRef(String(fileRef));

	return {
		id: seedId,
		taskType: String(task.taskType),
		status: String(task.status),
		description: String(task.description ?? ""),
		jobTitle: task.jobTitle != null ? String(task.jobTitle) : null,
		externalKey: task.externalKey != null ? String(task.externalKey) : null,
		createdBy: String(task.createdByUserId),
		destinationId:
			destination.addressId != null ? Number(destination.addressId) : null,
		crewSize: task.crewSize != null ? Number(task.crewSize) : null,
		hours: task.hours != null ? Number(task.hours) : null,
		isTimeSpecific: Boolean(task.isTimeSpecific),
		canStartEarly: Boolean(task.canStartEarly),
		windowStart: materializeOffset(anchorMs, times.windowStartAt),
		windowEnd: materializeOffset(anchorMs, times.windowEndAt),
		completedNotes:
			task.completedNotes != null ? String(task.completedNotes) : null,
		completedAt: materializeOffset(anchorMs, times.completedAt),
		failedReason: task.failedReason != null ? String(task.failedReason) : null,
		createdAt: materializeOffset(anchorMs, times.createdAt) ?? new Date(anchorMs).toISOString(),
		updatedAt: materializeOffset(anchorMs, times.updatedAt) ?? new Date(anchorMs).toISOString(),
		deletedAt: materializeOffset(anchorMs, times.deletedAt),
		cancelledAt: materializeOffset(anchorMs, times.cancelledAt),
		statusBeforeCancel:
			task.statusBeforeCancel != null ? String(task.statusBeforeCancel) : null,
		archiveAt: materializeOffset(anchorMs, times.archiveAt),
		crew,
		contacts,
		crewEvents: (Array.isArray(fixture.crewEvents) ? fixture.crewEvents : []).map(
			(e) => {
				const ev = /** @type {{ userId: string, type: string, lat?: number, lng?: number, at: { offsetMs: number } }} */ (
					e
				);
				return {
					userId: String(ev.userId),
					type: /** @type {'started'|'ended'} */ (ev.type),
					lat: ev.lat,
					lng: ev.lng,
					at: materializeOffset(anchorMs, ev.at),
				};
			},
		),
		completionNotes: (Array.isArray(fixture.completionNotes)
			? fixture.completionNotes
			: []
		).map((n) => {
			const row = /** @type {{ userId: string, outcome: string, notes?: string | null }} */ (
				n
			);
			return {
				userId: String(row.userId),
				outcome: /** @type {'Completed'|'Failed'} */ (row.outcome),
				notes: row.notes ?? null,
			};
		}),
		attachments: (Array.isArray(fixture.attachments) ? fixture.attachments : []).map(
			(a) => {
				const row = /** @type {Record<string, unknown>} */ (a);
				const fileRef = String(row.fileRef);
				return {
					kind: String(row.kind),
					storageKey: mapFileRef(fileRef),
					mimeType: String(row.mimeType),
					fileName: String(row.fileName),
					caption: row.caption != null ? String(row.caption) : null,
					uploadedBy: String(row.uploadedByUserId),
					at: materializeOffset(anchorMs, /** @type {{ offsetMs: number }} */ (row.at)),
					attachmentTypeSlug:
						row.attachmentTypeSlug != null
							? String(row.attachmentTypeSlug)
							: undefined,
					fileSizeBytes:
						files.fileSizeForFileRef?.(fileRef) ??
						(row.byteSize != null ? Number(row.byteSize) : undefined),
				};
			},
		),
		documents: (Array.isArray(fixture.documents) ? fixture.documents : []).map(
			(d) => {
				const row = /** @type {Record<string, unknown>} */ (d);
				return {
					kind: String(row.kind),
					storageKey: mapFileRef(String(row.fileRef)),
					fileName: String(row.fileName),
					generatedAt: materializeOffset(
						anchorMs,
						/** @type {{ offsetMs: number }} */ (row.generatedAt),
					),
					generatedBy:
						row.generatedByUserId != null
							? String(row.generatedByUserId)
							: null,
				};
			},
		),
		emails: (Array.isArray(fixture.emails) ? fixture.emails : []).map((m) => {
			const row = /** @type {Record<string, unknown>} */ (m);
			return {
				trigger: String(row.trigger),
				to: String(row.to),
				subject: String(row.subject),
				status: String(row.status),
				sentAt: materializeOffset(
					anchorMs,
					/** @type {{ offsetMs: number } | null} */ (row.sentAt),
				),
				error: row.error != null ? String(row.error) : null,
			};
		}),
		history: (Array.isArray(fixture.history) ? fixture.history : []).map((h) => {
			const row = /** @type {Record<string, unknown>} */ (h);
			return {
				eventType: String(row.eventType),
				actorUserId:
					row.actorUserId != null ? String(row.actorUserId) : null,
				fromStatus: row.fromStatus != null ? String(row.fromStatus) : null,
				toStatus: row.toStatus != null ? String(row.toStatus) : null,
				summary: row.summary != null ? String(row.summary) : null,
				recordedAt: materializeOffset(
					anchorMs,
					/** @type {{ offsetMs: number }} */ (row.recordedAt),
				),
			};
		}),
	};
}
