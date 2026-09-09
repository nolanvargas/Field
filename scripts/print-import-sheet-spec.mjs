/**
 * Write CSV files for populating hosted Google Sheet import workbooks.
 * Output: ./import-sheet-spec/{entity}-template.csv and {entity}-sample.csv
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPORT_ENTITIES } from '../shared/importColumns.js';
import { buildImportCsv } from '../server/bulkImport/rows.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const outDir = join(root, 'import-sheet-spec');

await mkdir(outDir, { recursive: true });

for (const entity of IMPORT_ENTITIES) {
	for (const mode of ['blank', 'sample']) {
		const csv = await buildImportCsv(entity, mode);
		const suffix = mode === 'blank' ? 'template' : 'sample';
		const fileName = `${entity}-${suffix}.csv`;
		const filePath = join(outDir, fileName);
		await writeFile(filePath, csv, 'utf8');
		console.log(`Wrote ${filePath}`);
	}
}

console.log(
	'\nUpload each CSV into the matching Google Sheet tab (see docs/import-google-sheets.md).',
);
