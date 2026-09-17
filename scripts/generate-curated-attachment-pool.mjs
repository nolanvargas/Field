/**
 * One-off generator: 10 curated attachment identities × 2 variants (20 files).
 * Mostly phone-style JPEGs + a few PDFs with dummy field-service data.
 *
 *   node scripts/generate-curated-attachment-pool.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
	CURATED_FILES_DIR,
	CURATED_FILES_MANIFEST_PATH,
} from "./lib/curatedTasksPaths.mjs";
import {
	CURATED_SCHEMA_VERSION,
	curatedStorageKeyForHash,
} from "../shared/curatedTasks.mjs";

const PHONE_W = 1200;
const PHONE_H = 1600;

const CURATED_SOURCES_DIR = path.join(
	path.dirname(CURATED_FILES_MANIFEST_PATH),
	"..",
	"sources",
);

/** One photorealistic PNG per identity × variant (distinct scenes, not crops of the same file). */
const PHOTO_SOURCE_FILES = {
	"porch-delivery": {
		1: "curated-porch-delivery-v1.png",
		2: "curated-porch-delivery-v2.png",
	},
	"pallet-freight": {
		1: "curated-pallet-freight-v1.png",
		2: "curated-pallet-freight-v2.png",
	},
	"meter-closeup": {
		1: "curated-meter-closeup-v1.png",
		2: "curated-meter-closeup-v2.png",
	},
	"damaged-carton": {
		1: "curated-damaged-carton-v1.png",
		2: "curated-damaged-carton-v2.png",
	},
	"hallway-delivery": {
		1: "curated-hallway-delivery-v1.png",
		2: "curated-hallway-delivery-v2.png",
	},
	"van-cargo": {
		1: "curated-van-cargo-v1.png",
		2: "curated-van-cargo-v2.png",
	},
	"install-complete": {
		1: "curated-install-complete-v1.png",
		2: "curated-install-complete-v2.png",
	},
	"signed-receipt": {
		1: "curated-signed-receipt-v1.png",
		2: "curated-signed-receipt-v2.png",
	},
};

/** @typedef {{ id: string, fileName: string, mimeType: string, kind: 'photo' | 'document', attachmentTypeSlug?: string, variant: 1 | 2, build: () => Promise<Buffer> }} PoolEntry */

/** @param {Buffer} inputBuffer */
async function phoneJpegFromPhotoSource(inputBuffer) {
	return sharp(inputBuffer)
		.resize(PHONE_W, PHONE_H, { fit: "cover" })
		.jpeg({ quality: 80, mozjpeg: true })
		.toBuffer();
}

/** @param {string} id @param {1 | 2} variant */
function buildPhotoFromSource(id, variant) {
	return async () => {
		const byVariant = PHOTO_SOURCE_FILES[id];
		const name = byVariant?.[variant];
		if (!name) throw new Error(`No photo source mapped for ${id} v${variant}`);
		const raw = await readFile(path.join(CURATED_SOURCES_DIR, name));
		return phoneJpegFromPhotoSource(raw);
	};
}

/** @returns {Promise<Buffer>} */
function packingSlipPdf(variant) {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: "LETTER", margin: 54 });
		/** @type {Buffer[]} */
		const chunks = [];
		doc.on("data", (c) => chunks.push(c));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		const order = variant === 1 ? "PO-2026-0142" : "PO-2026-0188";
		doc.fontSize(20).text("Packing slip", { align: "left" });
		doc.moveDown(0.5);
		doc.fontSize(11).fillColor("#444");
		doc.text(`Showcase INC · Warehouse dispatch`);
		doc.text(`Order ${order} · Ship date 17 Sep 2026`);
		doc.moveDown();
		doc.fontSize(10).fillColor("#000");
		const rows = [
			["SKU", "Description", "Qty"],
			["BX-440", "Corrugated carton 18×12×10", "24"],
			["TL-200", "Packaging tape (6 roll)", "2"],
			["LB-010", "Thermal shipping labels", "1"],
		];
		let y = doc.y;
		for (const row of rows) {
			doc.text(row.join("    "), 54, y);
			y += 18;
		}
		doc.moveDown(2);
		doc.fontSize(9).fillColor("#666").text("Received in good condition: ___________________");
		doc.end();
	});
}

/** @returns {Promise<Buffer>} */
function siteInspectionPdf(variant) {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: "LETTER", margin: 54 });
		/** @type {Buffer[]} */
		const chunks = [];
		doc.on("data", (c) => chunks.push(c));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		const site = variant === 1 ? "Riverside Medical — Wing B" : "Harbor View Offices — Lvl 3";
		doc.fontSize(18).text("Site inspection checklist");
		doc.moveDown(0.5);
		doc.fontSize(11).fillColor("#444");
		doc.text(site);
		doc.text(`Inspector: A. Morgan · ${variant === 1 ? "16" : "17"} Sep 2026`);
		doc.moveDown();
		const items = [
			"[x] Access route clear for delivery vehicle",
			"[x] Loading dock hours confirmed",
			"[ ] Elevator reservation (pending)",
			"[x] PPE requirements posted",
			"[x] Meter location photographed",
		];
		doc.fontSize(10).fillColor("#000");
		for (const line of items) doc.text(line);
		doc.moveDown();
		doc.fontSize(9).fillColor("#666").text("Notes: Minor obstruction at roll-up door; crew notified.");
		doc.end();
	});
}

/** @type {PoolEntry[]} */
const POOL = [
	{
		id: "porch-delivery",
		fileName: "porch-delivery",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: buildPhotoFromSource("porch-delivery", 1),
	},
	{
		id: "porch-delivery",
		fileName: "porch-delivery",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: buildPhotoFromSource("porch-delivery", 2),
	},
	{
		id: "pallet-freight",
		fileName: "pallet-freight",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: buildPhotoFromSource("pallet-freight", 1),
	},
	{
		id: "pallet-freight",
		fileName: "pallet-freight",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: buildPhotoFromSource("pallet-freight", 2),
	},
	{
		id: "meter-closeup",
		fileName: "meter-reading",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "meter",
		variant: 1,
		build: buildPhotoFromSource("meter-closeup", 1),
	},
	{
		id: "meter-closeup",
		fileName: "meter-reading",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "meter",
		variant: 2,
		build: buildPhotoFromSource("meter-closeup", 2),
	},
	{
		id: "damaged-carton",
		fileName: "damaged-carton",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: buildPhotoFromSource("damaged-carton", 1),
	},
	{
		id: "damaged-carton",
		fileName: "damaged-carton",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: buildPhotoFromSource("damaged-carton", 2),
	},
	{
		id: "hallway-delivery",
		fileName: "hallway-delivery",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: buildPhotoFromSource("hallway-delivery", 1),
	},
	{
		id: "hallway-delivery",
		fileName: "hallway-delivery",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: buildPhotoFromSource("hallway-delivery", 2),
	},
	{
		id: "van-cargo",
		fileName: "van-cargo",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: buildPhotoFromSource("van-cargo", 1),
	},
	{
		id: "van-cargo",
		fileName: "van-cargo",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: buildPhotoFromSource("van-cargo", 2),
	},
	{
		id: "install-complete",
		fileName: "install-complete",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: buildPhotoFromSource("install-complete", 1),
	},
	{
		id: "install-complete",
		fileName: "install-complete",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: buildPhotoFromSource("install-complete", 2),
	},
	{
		id: "signed-receipt",
		fileName: "signed-receipt",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: buildPhotoFromSource("signed-receipt", 1),
	},
	{
		id: "signed-receipt",
		fileName: "signed-receipt",
		mimeType: "image/jpeg",
		kind: "photo",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: buildPhotoFromSource("signed-receipt", 2),
	},
	{
		id: "packing-slip",
		fileName: "packing-slip",
		mimeType: "application/pdf",
		kind: "document",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: () => packingSlipPdf(1),
	},
	{
		id: "packing-slip",
		fileName: "packing-slip",
		mimeType: "application/pdf",
		kind: "document",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: () => packingSlipPdf(2),
	},
	{
		id: "site-inspection",
		fileName: "site-inspection",
		mimeType: "application/pdf",
		kind: "document",
		attachmentTypeSlug: "completion_photos",
		variant: 1,
		build: () => siteInspectionPdf(1),
	},
	{
		id: "site-inspection",
		fileName: "site-inspection",
		mimeType: "application/pdf",
		kind: "document",
		attachmentTypeSlug: "completion_photos",
		variant: 2,
		build: () => siteInspectionPdf(2),
	},
];

/** @param {string} base @param {1 | 2} variant @param {string} mimeType */
function displayFileName(base, variant, mimeType) {
	const ext =
		mimeType === "application/pdf"
			? ".pdf"
			: mimeType === "image/jpeg"
				? ".jpg"
				: "";
	return `${base}-v${variant}${ext}`;
}

async function main() {
	await mkdir(CURATED_FILES_DIR, { recursive: true });

	const existingRaw = await readFile(CURATED_FILES_MANIFEST_PATH, "utf8").catch(
		() => '{"schemaVersion":1,"files":{}}',
	);
	const manifest = JSON.parse(existingRaw);
	manifest.schemaVersion = CURATED_SCHEMA_VERSION;
	for (const meta of Object.values(manifest.files ?? {})) {
		if (meta && typeof meta === "object" && "relativePath" in meta) {
			try {
				await unlink(path.join(CURATED_FILES_DIR, String(meta.relativePath)));
			} catch {
				/* missing on disk */
			}
		}
	}
	manifest.files = {};

	/** @type {Record<string, { id: string, variant: 1 | 2, fileRef: string, fileName: string, kind: string, attachmentTypeSlug?: string }[]>} */
	const catalogById = {};

	for (const entry of POOL) {
		const body = await entry.build();
		const sha256 = createHash("sha256").update(body).digest("hex");
		const safeName = displayFileName(entry.fileName, entry.variant, entry.mimeType);
		const ext = safeName.includes(".")
			? safeName.slice(safeName.lastIndexOf("."))
			: "";
		const relativePath = `${sha256.slice(0, 32)}${ext}`;
		const destPath = path.join(CURATED_FILES_DIR, relativePath);

		await writeFile(destPath, body);

		manifest.files[sha256] = {
			storageKey: curatedStorageKeyForHash(sha256, safeName),
			relativePath,
			mimeType: entry.mimeType,
			fileName: safeName,
			byteSize: body.length,
		};

		if (!catalogById[entry.id]) catalogById[entry.id] = [];
		catalogById[entry.id].push({
			id: entry.id,
			variant: entry.variant,
			fileRef: sha256,
			fileName: safeName,
			kind: entry.kind,
			attachmentTypeSlug: entry.attachmentTypeSlug,
		});

		console.log(`${entry.id} v${entry.variant} → ${relativePath} (${body.length} bytes)`);
	}

	await writeFile(
		CURATED_FILES_MANIFEST_PATH,
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);

	const catalogPath = path.join(
		path.dirname(CURATED_FILES_MANIFEST_PATH),
		"..",
		"attachment-catalog.json",
	);
	const catalog = {
		schemaVersion: 1,
		description:
			"Logical attachment identities for curated tasks (2 variants each). Use fileRef in task JSON attachments[].",
		attachments: Object.entries(catalogById).map(([id, variants]) => ({
			id,
			kind: variants[0]?.kind,
			attachmentTypeSlug: variants[0]?.attachmentTypeSlug,
			variants: variants.sort((a, b) => a.variant - b.variant),
		})),
	};
	await writeFile(catalogPath, `${JSON.stringify(catalog, null, "\t")}\n`);

	console.log(`Wrote manifest (${Object.keys(manifest.files).length} files) and attachment-catalog.json`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
