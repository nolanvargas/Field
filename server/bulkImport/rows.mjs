import { importColumnsForMode } from '../../shared/importColumns.js';
import { serializeCsvWithBom } from '../../shared/csv.js';
import {
	SAMPLE_ADDRESS_ROWS,
	SAMPLE_CONTACT_ROWS,
	SAMPLE_USER_ROWS,
} from '../../shared/importSampleData.js';
import { formatBooleanCell } from './boolean.mjs';
import { getPool } from '../db.mjs';
import { permissionsFromDb } from '../../shared/permissions.js';
import { PERMISSIONS } from '../../shared/permissions.js';
import {
	importCustomFieldDefs,
	storedCustomFieldCells,
} from './customFields.mjs';

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {import('../../shared/importColumns.js').ImportColumnDef[]} cols
 * @param {Record<string, unknown>} record
 */
function recordToCsvRow(entity, cols, record) {
	return cols.map((col) => {
		if (col.key === 'id') {
			const id = record.id;
			return id == null || id === '' ? '' : String(id);
		}
		if (entity === 'users') {
			if (col.key === 'manageUsers') {
				return formatBooleanCell(
					permissionsFromDb(record.permissions).includes(
						PERMISSIONS.manageUsers,
					),
				);
			}
			if (col.key === 'manageOrg') {
				return formatBooleanCell(
					permissionsFromDb(record.permissions).includes(
						PERMISSIONS.manageOrg,
					),
				);
			}
			if (col.key === 'viewCrewMap') {
				return formatBooleanCell(
					permissionsFromDb(record.permissions).includes(
						PERMISSIONS.viewCrewMap,
					),
				);
			}
			if (col.key === 'viewAllTasks') {
				return formatBooleanCell(
					permissionsFromDb(record.permissions).includes(
						PERMISSIONS.viewAllTasks,
					),
				);
			}
			if (col.key === 'displayName') return String(record.displayName ?? '');
		}
		if (entity === 'contacts') {
			if (col.key === 'name') return String(record.name ?? '');
			if (col.key === 'title') return String(record.title ?? '');
			if (col.key === 'phone') return String(record.phone ?? '');
			if (col.key === 'email') return String(record.email ?? '');
		}
		if (entity === 'addresses') {
			if (col.key === 'addressName') return String(record.addressName ?? '');
			if (col.key === 'street') return String(record.street ?? '');
			if (col.key === 'city') return String(record.city ?? '');
			if (col.key === 'state') return String(record.state ?? '');
			if (col.key === 'postalCode') return String(record.postalCode ?? '');
			if (col.key === 'building') return String(record.building ?? '');
			if (col.key === 'notes') return String(record.notes ?? '');
		}
		if (col.key === 'email') return String(record.email ?? '');
		if (col.key === 'phone') return String(record.phone ?? '');
		if (col.key === 'role') return String(record.role ?? '');
		return String(record[col.key] ?? '');
	});
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {import('../../shared/importColumns.js').ImportColumnDef[]} cols
 * @param {Record<string, unknown>} sample
 */
function sampleToCsvRow(entity, cols, sample) {
	return cols.map((col) => {
		if (
			entity === 'users' &&
			(col.key === 'manageUsers' ||
				col.key === 'manageOrg' ||
				col.key === 'viewCrewMap' ||
				col.key === 'viewAllTasks')
		) {
			return formatBooleanCell(Boolean(sample[col.key]));
		}
		return String(sample[col.key] ?? '');
	});
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
async function fetchCurrentRecords(entity, defs) {
	const pool = getPool();
	if (entity === 'contacts') {
		const { rows } = await pool.query(
			`SELECT id, name, COALESCE(title, '') AS title, phone,
              COALESCE(email, '') AS email, custom_fields
       FROM contacts WHERE deleted_at IS NULL ORDER BY name`,
		);
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			title: r.title,
			phone: r.phone ?? '',
			email: r.email,
			...storedCustomFieldCells(r.custom_fields, defs),
		}));
	}
	if (entity === 'addresses') {
		const { rows } = await pool.query(
			`SELECT id, address_name, street_line, building, notes, custom_fields
       FROM addresses WHERE deleted_at IS NULL
       ORDER BY COALESCE(NULLIF(address_name, ''), street_line), id`,
		);
		return rows.map((r) => ({
			id: r.id,
			addressName: r.address_name ?? '',
			street: r.street_line ?? '',
			city: '',
			state: '',
			postalCode: '',
			building: r.building ?? '',
			notes: r.notes ?? '',
			...storedCustomFieldCells(r.custom_fields, defs),
		}));
	}
	const { rows } = await pool.query(
		`SELECT id, display_name, email, phone, role, permissions, custom_fields
     FROM users WHERE is_active = true ORDER BY display_name`,
	);
	return rows.map((r) => ({
		id: r.id,
		displayName: r.display_name,
		email: r.email ?? '',
		phone: r.phone ?? '',
		role: r.role ?? '',
		permissions: r.permissions,
		...storedCustomFieldCells(r.custom_fields, defs),
	}));
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {'blank' | 'sample' | 'current'} mode
 */
export async function buildImportCsvRows(entity, mode) {
	const defs = await importCustomFieldDefs(entity);
	const cols = importColumnsForMode(
		entity,
		mode === 'current' ? 'export' : 'template',
		defs,
	);
	/** @type {string[][]} */
	const rows = [cols.map((col) => col.header)];

	if (mode === 'blank') return rows;

	if (mode === 'sample') {
		const samples =
			entity === 'contacts'
				? SAMPLE_CONTACT_ROWS
				: entity === 'addresses'
					? SAMPLE_ADDRESS_ROWS
					: SAMPLE_USER_ROWS;
		for (const sample of samples) {
			rows.push(sampleToCsvRow(entity, cols, sample));
		}
		return rows;
	}

	const records = await fetchCurrentRecords(entity, defs);
	for (const record of records) {
		rows.push(recordToCsvRow(entity, cols, record));
	}
	return rows;
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {'blank' | 'sample' | 'current'} mode
 */
export async function buildImportCsv(entity, mode) {
	const rows = await buildImportCsvRows(entity, mode);
	return serializeCsvWithBom(rows);
}
