import { randomUUID } from 'node:crypto';
import { getPool } from '../db.mjs';
import {
	PERMISSIONS,
	permissionsFromDb,
	wouldRemoveOwnManageUsers,
} from '../../shared/permissions.js';
import { parseBooleanCell } from './boolean.mjs';
import { normalizeMatchKey } from './parse.mjs';
import {
	customFieldCellsEqual,
	customFieldsJsonFromCells,
	importedCustomFieldCells,
	storedCustomFieldCells,
} from './customFields.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {import('pg').QueryResultRow} row
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function mapUser(row, defs) {
	const permissions = permissionsFromDb(row.permissions);
	return {
		id: String(row.id),
		displayName: row.display_name ?? '',
		email: row.email ?? '',
		phone: row.phone ?? '',
		role: row.role ?? '',
		manageUsers: permissions.includes(PERMISSIONS.manageUsers)
			? 'TRUE'
			: 'FALSE',
		manageOrg: permissions.includes(PERMISSIONS.manageOrg) ? 'TRUE' : 'FALSE',
		viewCrewMap: permissions.includes(PERMISSIONS.viewCrewMap)
			? 'TRUE'
			: 'FALSE',
		viewAllTasks: permissions.includes(PERMISSIONS.viewAllTasks)
			? 'TRUE'
			: 'FALSE',
		...storedCustomFieldCells(row.custom_fields, defs),
	};
}

/**
 * @param {Record<string, string>} fields
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function importedUserFields(fields, defs) {
	return {
		displayName: fields.displayName ?? '',
		email: fields.email ?? '',
		phone: fields.phone ?? '',
		role: fields.role ?? '',
		manageUsers: fields.manageUsers ?? 'FALSE',
		manageOrg: fields.manageOrg ?? 'FALSE',
		viewCrewMap: fields.viewCrewMap ?? 'FALSE',
		viewAllTasks: fields.viewAllTasks ?? 'FALSE',
		...importedCustomFieldCells(fields, defs),
	};
}

/**
 * @param {Record<string, string>} fields
 */
function permissionsFromImportFields(fields) {
	/** @type {string[]} */
	const out = [];
	if (parseBooleanCell(fields.manageUsers)) {
		out.push(PERMISSIONS.manageUsers);
	}
	if (parseBooleanCell(fields.manageOrg)) {
		out.push(PERMISSIONS.manageOrg);
	}
	if (parseBooleanCell(fields.viewCrewMap)) {
		out.push(PERMISSIONS.viewCrewMap);
	}
	if (parseBooleanCell(fields.viewAllTasks)) {
		out.push(PERMISSIONS.viewAllTasks);
	}
	return out;
}

/**
 * @param {Record<string, string>} a
 * @param {Record<string, string>} b
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function userFieldsEqual(a, b, defs) {
	return (
		a.displayName === b.displayName &&
		a.email === b.email &&
		a.phone === b.phone &&
		a.role === b.role &&
		a.manageUsers === b.manageUsers &&
		a.manageOrg === b.manageOrg &&
		a.viewCrewMap === b.viewCrewMap &&
		a.viewAllTasks === b.viewAllTasks &&
		customFieldCellsEqual(a, b, defs)
	);
}

/**
 * @param {Record<string, string>} fields
 * @param {number} rowIndex
 * @returns {string[]}
 */
function validateUserFields(fields, rowIndex) {
	const errors = [];
	if (!fields.displayName?.trim()) {
		errors.push('Name is required');
	}
	const email = fields.email?.trim();
	if (email && !EMAIL_RE.test(email)) {
		errors.push('Email is invalid');
	}
	if (fields.displayName && fields.displayName.length > 255) {
		errors.push('Name must be 255 characters or fewer');
	}
	if (email && email.length > 255) {
		errors.push('Email must be 255 characters or fewer');
	}
	if (fields.phone && fields.phone.length > 50) {
		errors.push('Phone must be 50 characters or fewer');
	}
	if (fields.role && fields.role.length > 50) {
		errors.push('Role must be 50 characters or fewer');
	}
	return errors.map((e) => (rowIndex ? e : e));
}

/**
 * @param {Array<{ rowIndex: number; fields: Record<string, string>; errors: string[] }>} parsedRows
 * @param {import('../customFields.mjs').CustomFieldDef[]} [customFieldDefs]
 */
export async function previewUsersImport(parsedRows, customFieldDefs = []) {
	const defs = customFieldDefs;
	const pool = getPool();
	const { rows: existingRows } = await pool.query(
		`SELECT id, display_name, email, phone, role, permissions, custom_fields
     FROM users WHERE is_active = true`,
	);

	/** @type {Map<string, ReturnType<typeof mapUser>>} */
	const byEmail = new Map();
	/** @type {Map<string, ReturnType<typeof mapUser>>} */
	const byId = new Map();
	for (const row of existingRows) {
		const mapped = mapUser(row, defs);
		byId.set(mapped.id.toLowerCase(), mapped);
		const emailKey = normalizeMatchKey(mapped.email);
		if (emailKey && !byEmail.has(emailKey)) byEmail.set(emailKey, mapped);
	}

	/** @type {import('./types.mjs').ImportPreviewRow[]} */
	const rows = [];
	const summary = { new: 0, update: 0, conflict: 0, error: 0 };

	for (const parsed of parsedRows) {
		const imported = importedUserFields(parsed.fields, defs);
		const idRaw = (parsed.fields.id ?? '').trim();
		const validationErrors = [
			...parsed.errors,
			...validateUserFields(imported, parsed.rowIndex),
		];

		if (validationErrors.length > 0) {
			rows.push({
				rowIndex: parsed.rowIndex,
				status: 'error',
				errors: validationErrors,
				imported,
			});
			summary.error++;
			continue;
		}

		if (idRaw) {
			if (!UUID_RE.test(idRaw)) {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'error',
					errors: ['Id must be a valid user UUID'],
					imported,
				});
				summary.error++;
				continue;
			}
			const existing = byId.get(idRaw.toLowerCase());
			if (!existing) {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'error',
					errors: [`User id ${idRaw} not found`],
					imported,
				});
				summary.error++;
				continue;
			}
			rows.push({
				rowIndex: parsed.rowIndex,
				status: 'update',
				matchId: existing.id,
				imported,
				existing,
			});
			summary.update++;
			continue;
		}

		const emailKey = normalizeMatchKey(imported.email);
		const match = emailKey ? byEmail.get(emailKey) : undefined;
		if (match) {
			if (userFieldsEqual(imported, match, defs)) {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'update',
					matchId: match.id,
					imported,
					existing: match,
				});
				summary.update++;
			} else {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'conflict',
					matchId: match.id,
					imported,
					existing: match,
				});
				summary.conflict++;
			}
			continue;
		}

		rows.push({
			rowIndex: parsed.rowIndex,
			status: 'new',
			imported,
		});
		summary.new++;
	}

	return { rows, summary };
}

/**
 * @param {string} userId
 */
async function assertNotLastManageUsers(userId) {
	const pool = getPool();
	const { rows } = await pool.query(
		`SELECT permissions FROM users
     WHERE id = $1::uuid AND is_active = true`,
		[userId],
	);
	const perms = permissionsFromDb(rows[0]?.permissions);
	if (!perms.includes(PERMISSIONS.manageUsers)) return;

	const { rows: others } = await pool.query(
		`SELECT 1 FROM users
     WHERE is_active = true
       AND id <> $1::uuid
       AND $2 = ANY(permissions)
     LIMIT 1`,
		[userId, PERMISSIONS.manageUsers],
	);
	if (others.length === 0) {
		throw Object.assign(
			new Error('Cannot remove the only user with Manage users access'),
			{ status: 403 },
		);
	}
}

/**
 * @param {import('./types.mjs').ImportApplyRow[]} applyRows
 * @param {string} actorUserId
 * @param {import('../customFields.mjs').CustomFieldDef[]} [customFieldDefs]
 */
export async function applyUsersImport(applyRows, actorUserId, customFieldDefs = []) {
	const pool = getPool();
	let created = 0;
	let updated = 0;
	/** @type {string[]} */
	const errors = [];

	for (const row of applyRows) {
		if (row.status === 'error') continue;
		const fields = resolveUserFields(row);
		const fieldErrors = validateUserFields(fields, row.rowIndex);
		if (fieldErrors.length > 0) {
			errors.push(`Row ${row.rowIndex}: ${fieldErrors.join('; ')}`);
			continue;
		}

		const displayName = fields.displayName.trim().slice(0, 255);
		const email = fields.email?.trim().toLowerCase() || null;
		const phone = fields.phone?.trim().slice(0, 50) || null;
		const role = fields.role?.trim().slice(0, 50) || '';
		const permissions = permissionsFromImportFields(fields);

		try {
			const customFields = await customFieldsJsonFromCells(
				pool,
				fields,
				customFieldDefs,
			);
			if (row.status === 'new' || !row.matchId) {
				const id = randomUUID();
				await pool.query(
					`INSERT INTO users (id, display_name, email, phone, role, permissions, custom_fields, is_active)
           VALUES ($1::uuid, $2, $3, $4, $5, $6::text[], $7::jsonb, true)`,
					[id, displayName, email, phone, role, permissions, customFields],
				);
				created++;
			} else {
				const targetId = row.matchId;
				if (
					wouldRemoveOwnManageUsers(actorUserId, targetId, permissions)
				) {
					errors.push(
						`Row ${row.rowIndex}: Cannot remove manage_users from yourself`,
					);
					continue;
				}
				if (!permissions.includes(PERMISSIONS.manageUsers)) {
					try {
						await assertNotLastManageUsers(targetId);
					} catch (err) {
						errors.push(
							`Row ${row.rowIndex}: ${err instanceof Error ? err.message : 'Permission check failed'}`,
						);
						continue;
					}
				}

				const { rowCount } = await pool.query(
					`UPDATE users
           SET display_name = $2, email = $3, phone = $4, role = $5,
               permissions = $6::text[], custom_fields = $7::jsonb, updated_at = now()
           WHERE id = $1::uuid AND is_active = true`,
					[targetId, displayName, email, phone, role, permissions, customFields],
				);
				if (rowCount === 0) {
					errors.push(`Row ${row.rowIndex}: user not found`);
				} else {
					updated++;
				}
			}
		} catch (err) {
			if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
				errors.push(`Row ${row.rowIndex}: A user with that email already exists`);
			} else {
				errors.push(
					`Row ${row.rowIndex}: ${err instanceof Error ? err.message : 'Save failed'}`,
				);
			}
		}
	}

	return { created, updated, errors };
}

/**
 * @param {import('./types.mjs').ImportApplyRow} row
 */
function resolveUserFields(row) {
	if (row.status !== 'conflict' || !row.existing || !row.resolution) {
		return row.imported;
	}
	/** @type {Record<string, string>} */
	const out = { ...row.imported };
	for (const [key, source] of Object.entries(row.resolution)) {
		if (source === 'existing' && key in row.existing) {
			out[key] = row.existing[key];
		}
	}
	return out;
}
