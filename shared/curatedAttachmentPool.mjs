/**
 * Pick attachment storage keys from fixtures/curated/files (manifest + catalog).
 * Used by bulk-generated dev seeds and demo filler tasks.
 */
import catalogData from "../fixtures/curated/attachment-catalog.json";
import manifestData from "../fixtures/curated/files/manifest.json";
import { demoCuratedStorageKey } from "./curatedTasks.mjs";

const manifest = manifestData;
const catalog = catalogData;

/** @param {string[]} arr */
function unique(arr) {
	return [...new Set(arr)];
}

function buildStoragePools() {
	/** @type {Record<string, string[]>} */
	const byKind = {
		photo: [],
		document: [],
		signature: [],
		video: [],
	};

	for (const entry of catalog.attachments ?? []) {
		const kind = String(entry.kind ?? "photo");
		if (!byKind[kind]) byKind[kind] = [];
		for (const variant of entry.variants ?? []) {
			const meta = manifest.files[variant.fileRef];
			if (meta?.storageKey) byKind[kind].push(meta.storageKey);
		}
	}

	for (const meta of Object.values(manifest.files ?? {})) {
		if (meta.mimeType === "image/gif") {
			byKind.signature.push(meta.storageKey);
		} else if (meta.mimeType === "video/mp4") {
			byKind.video.push(meta.storageKey);
		}
	}

	return {
		photo: unique(byKind.photo),
		document: unique(byKind.document),
		signature: unique(byKind.signature),
		video: unique(byKind.video),
	};
}

const STORAGE_POOLS = buildStoragePools();

/** @type {Map<string, { storageKey: string, relativePath: string, byteSize: number, fileName: string, mimeType: string }>} */
const metaByStorageKey = new Map(
	Object.values(manifest.files ?? {}).map((meta) => [meta.storageKey, meta]),
);

/** @type {Record<string, string[]>} */
const POOL_BY_KIND = {
	photo: STORAGE_POOLS.photo,
	document: STORAGE_POOLS.document,
	signature: STORAGE_POOLS.signature,
	video: STORAGE_POOLS.video,
	delivery_docket: STORAGE_POOLS.document,
	pod: STORAGE_POOLS.document,
	shipping_label: STORAGE_POOLS.document,
};

/**
 * @param {string} kind
 * @param {number} seed
 */
export function pickCuratedAttachmentStorageKey(kind, seed) {
	const pool = POOL_BY_KIND[kind] ?? STORAGE_POOLS.photo;
	if (pool.length === 0) {
		throw new Error(`No curated attachment pool for kind: ${kind}`);
	}
	const index = Math.abs(Number(seed) || 0) % pool.length;
	return pool[index];
}

/**
 * Demo static assets under public/demo/curated/.
 * @param {string} kind
 * @param {number} seed
 */
export function pickCuratedDemoAttachmentStorageKey(kind, seed) {
	const storageKey = pickCuratedAttachmentStorageKey(kind, seed);
	const meta = metaByStorageKey.get(storageKey);
	if (!meta) {
		return demoCuratedStorageKey(storageKey.replace(/^.*[/\\]/, ""));
	}
	return demoCuratedStorageKey(meta.relativePath);
}

/** @param {string} storageKey */
export function curatedAttachmentByteSize(storageKey) {
	const direct = metaByStorageKey.get(storageKey);
	if (direct) return direct.byteSize;
	for (const meta of Object.values(manifest.files ?? {})) {
		if (demoCuratedStorageKey(meta.relativePath) === storageKey) {
			return meta.byteSize;
		}
	}
	return null;
}

/** @param {string} storageKey attachments/curated/… or demo/curated/… */
export function curatedAttachmentFileName(storageKey) {
	const direct = metaByStorageKey.get(storageKey);
	if (direct) return direct.fileName;
	for (const meta of Object.values(manifest.files ?? {})) {
		if (demoCuratedStorageKey(meta.relativePath) === storageKey) {
			return meta.fileName;
		}
	}
	return null;
}
