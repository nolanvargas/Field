/**
 * CSV parse/serialize helpers (UTF-8). Used by bulk import and CLI scripts.
 */

/**
 * @param {string} text
 */
export function stripUtf8Bom(text) {
	if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
	return text;
}

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
	const normalized = stripUtf8Bom(text);
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < normalized.length; i++) {
		const c = normalized[i];
		const next = normalized[i + 1];

		if (inQuotes) {
			if (c === '"' && next === '"') {
				field += '"';
				i++;
			} else if (c === '"') {
				inQuotes = false;
			} else {
				field += c;
			}
			continue;
		}

		if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\r' && next === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			i++;
		} else if (c === '\n' || c === '\r') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += c;
		}
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

/**
 * @param {string} value
 */
function escapeCsvField(value) {
	const s = String(value ?? '');
	if (/[",\r\n]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

/**
 * @param {string[][]} rows
 * @returns {string}
 */
export function serializeCsv(rows) {
	return rows
		.map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
		.join('\r\n');
}

/**
 * UTF-8 CSV with BOM for Excel compatibility.
 * @param {string[][]} rows
 * @returns {string}
 */
export function serializeCsvWithBom(rows) {
	return `\uFEFF${serializeCsv(rows)}`;
}
