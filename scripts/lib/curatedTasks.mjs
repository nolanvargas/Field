/**
 * Load curated task fixtures and sync binary files to storage / demo public dir.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	CURATED_SCHEMA_VERSION,
	materializeCuratedFixtureToSeedTask,
} from "../../shared/curatedTasks.mjs";
import {
	CURATED_FILES_DIR,
	CURATED_FILES_MANIFEST_PATH,
	CURATED_INDEX_PATH,
	CURATED_TASKS_DIR,
	PUBLIC_DEMO_CURATED_DIR,
	REPO_ROOT,
} from "./curatedTasksPaths.mjs";

/**
 * @typedef {import('./insertSeedTask.mjs').SeedTask} SeedTask
 */

/** @returns {Promise<{ schemaVersion: number, tasks: { slug: string, seedId?: number }[] }>} */
export async function loadCuratedIndex() {
	const raw = await readFile(CURATED_INDEX_PATH, "utf8");
	const data = JSON.parse(raw);
	if (Number(data.schemaVersion) !== CURATED_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported curated index schema ${data.schemaVersion} (expected ${CURATED_SCHEMA_VERSION})`,
		);
	}
	return data;
}

/** @returns {Promise<{ schemaVersion: number, files: Record<string, { storageKey: string, relativePath: string, mimeType: string, fileName: string, byteSize: number }> }>} */
export async function loadCuratedFilesManifest() {
	const raw = await readFile(CURATED_FILES_MANIFEST_PATH, "utf8");
	const data = JSON.parse(raw);
	if (Number(data.schemaVersion) !== CURATED_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported curated files schema ${data.schemaVersion} (expected ${CURATED_SCHEMA_VERSION})`,
		);
	}
	if (!data.files || typeof data.files !== "object") {
		data.files = {};
	}
	return data;
}

/**
 * @param {number} [anchorMs]
 * @returns {Promise<SeedTask[]>}
 */
export async function loadCuratedSeedTasks(anchorMs = Date.now()) {
	const index = await loadCuratedIndex();
	const manifest = await loadCuratedFilesManifest();
	if (index.tasks.length === 0) return [];

	/** @type {SeedTask[]} */
	const out = [];
	for (const entry of index.tasks) {
		const taskPath = path.join(CURATED_TASKS_DIR, `${entry.slug}.json`);
		const raw = await readFile(taskPath, "utf8");
		const fixture = JSON.parse(raw);
		const seedTask = materializeCuratedFixtureToSeedTask(fixture, anchorMs, {
			storageKeyForFileRef: (fileRef) => {
				const meta = manifest.files[fileRef];
				if (!meta) {
					throw new Error(
						`Curated task ${entry.slug} references unknown file ${fileRef}`,
					);
				}
				return meta.storageKey;
			},
			fileSizeForFileRef: (fileRef) => {
				const meta = manifest.files[fileRef];
				return meta?.byteSize ?? null;
			},
		});
		out.push(/** @type {SeedTask} */ (seedTask));
	}
	return out;
}

/** Copy fixture files into ./storage for local dev seed. */
export async function syncCuratedFilesToStorage() {
	const manifest = await loadCuratedFilesManifest();
	const storageRoot = path.join(REPO_ROOT, "storage");
	for (const meta of Object.values(manifest.files)) {
		const src = path.join(CURATED_FILES_DIR, meta.relativePath);
		const dest = path.join(storageRoot, meta.storageKey);
		await mkdir(path.dirname(dest), { recursive: true });
		await copyFile(src, dest);
	}
}

/** Copy fixture files into public/demo/curated for static demo builds. */
export async function syncCuratedFilesToPublicDemo() {
	const manifest = await loadCuratedFilesManifest();
	await mkdir(PUBLIC_DEMO_CURATED_DIR, { recursive: true });
	for (const meta of Object.values(manifest.files)) {
		const src = path.join(CURATED_FILES_DIR, meta.relativePath);
		const base = path.basename(meta.relativePath);
		const dest = path.join(PUBLIC_DEMO_CURATED_DIR, base);
		await copyFile(src, dest);
	}
}

/**
 * @param {unknown} index
 * @param {unknown} manifest
 */
export async function writeCuratedIndexAndManifest(index, manifest) {
	await mkdir(CURATED_TASKS_DIR, { recursive: true });
	await mkdir(path.dirname(CURATED_FILES_MANIFEST_PATH), { recursive: true });
	await writeFile(CURATED_INDEX_PATH, `${JSON.stringify(index, null, "\t")}\n`);
	await writeFile(
		CURATED_FILES_MANIFEST_PATH,
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);
}

/**
 * @param {string} slug
 * @param {unknown} fixture
 */
export async function writeCuratedTaskFixture(slug, fixture) {
	await mkdir(CURATED_TASKS_DIR, { recursive: true });
	const taskPath = path.join(CURATED_TASKS_DIR, `${slug}.json`);
	await writeFile(taskPath, `${JSON.stringify(fixture, null, "\t")}\n`);
}

/** @param {number} targetTotal @param {number} curatedCount */
export function bulkCountForCurated(targetTotal, curatedCount) {
	const bulk = targetTotal - curatedCount;
	if (bulk < 0) {
		throw new Error(
			`Curated task count ${curatedCount} exceeds target total ${targetTotal}`,
		);
	}
	return bulk;
}
