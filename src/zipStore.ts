const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	CRC_TABLE[i] = c >>> 0;
}

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function concat(chunks: Uint8Array[]): Uint8Array {
	const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

function u16(value: number): Uint8Array {
	const bytes = new Uint8Array(2);
	new DataView(bytes.buffer).setUint16(0, value, true);
	return bytes;
}

function u32(value: number): Uint8Array {
	const bytes = new Uint8Array(4);
	new DataView(bytes.buffer).setUint32(0, value, true);
	return bytes;
}

export function uniqueZipFileName(name: string, used: Set<string>): string {
	const safe =
		name.replace(/[/\\?%*:|"<>]/g, '_').replace(/^\.+/, '').trim() ||
		'completion-image';
	const key = (candidate: string) => candidate.toLowerCase();
	if (!used.has(key(safe))) {
		used.add(key(safe));
		return safe;
	}
	const dot = safe.lastIndexOf('.');
	const stem = dot > 0 ? safe.slice(0, dot) : safe;
	const ext = dot > 0 ? safe.slice(dot) : '';
	let n = 2;
	let next = `${stem}-${n}${ext}`;
	while (used.has(key(next))) {
		n += 1;
		next = `${stem}-${n}${ext}`;
	}
	used.add(key(next));
	return next;
}

/** Uncompressed ZIP (store only) for in-browser multi-file downloads. */
export function zipStoreFiles(
	files: Array<{ name: string; data: Uint8Array }>,
): Blob {
	const encoder = new TextEncoder();
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const name = encoder.encode(file.name);
		const crc = crc32(file.data);
		const size = file.data.length;
		const local = concat([
			u32(0x04034b50),
			u16(20),
			u16(0x0800),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(size),
			u32(size),
			u16(name.length),
			u16(0),
			name,
		]);
		locals.push(local, file.data);
		centrals.push(
			concat([
				u32(0x02014b50),
				u16(20),
				u16(20),
				u16(0x0800),
				u16(0),
				u16(0),
				u16(0),
				u32(crc),
				u32(size),
				u32(size),
				u16(name.length),
				u16(0),
				u16(0),
				u16(0),
				u16(0),
				u32(0),
				u32(offset),
				name,
			]),
		);
		offset += local.length + size;
	}

	const central = concat(centrals);
	const eocd = concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(central.length),
		u32(offset),
		u16(0),
	]);

	return new Blob(
		[concat(locals), central, eocd] as BlobPart[],
		{ type: 'application/zip' },
	);
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.rel = 'noopener';
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
