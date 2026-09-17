/**
 * One-time migration: write BASE_TASKS from seed-dev-tasks into fixtures/curated.
 *
 * Usage: node scripts/export-base-tasks-to-curated.mjs
 */
import { writeSeedStorageFiles } from "./lib/seedStorage.mjs";
import { BASE_TASKS } from "./seed-dev-tasks.mjs";
import { seedTaskToCuratedFixture } from "./lib/seedTaskToCuratedFixture.mjs";
import {
	loadCuratedFilesManifest,
	writeCuratedIndexAndManifest,
	writeCuratedTaskFixture,
} from "./lib/curatedTasks.mjs";
import { CURATED_SCHEMA_VERSION } from "../shared/curatedTasks.mjs";

await writeSeedStorageFiles();

const capturedAt = new Date().toISOString();
const manifest = await loadCuratedFilesManifest();
const filesMap = { ...manifest.files };

/** @type {{ slug: string, seedId: number }[]} */
const indexTasks = [];

for (const task of BASE_TASKS) {
	const fixture = await seedTaskToCuratedFixture(task, capturedAt, filesMap);
	await writeCuratedTaskFixture(fixture.slug, fixture);
	indexTasks.push({ slug: fixture.slug, seedId: fixture.seedId });
}

await writeCuratedIndexAndManifest(
	{ schemaVersion: CURATED_SCHEMA_VERSION, tasks: indexTasks },
	{ schemaVersion: CURATED_SCHEMA_VERSION, files: filesMap },
);

console.log(
	`Exported ${indexTasks.length} base tasks to fixtures/curated (${Object.keys(filesMap).length} unique files).`,
);
