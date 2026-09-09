import Busboy from 'busboy';

/**
 * Parse multipart upload and return the CSV file buffer.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
export function readMultipartCsv(req) {
	return new Promise((resolve, reject) => {
		const contentType = req.headers['content-type'] ?? '';
		if (!contentType.includes('multipart/form-data')) {
			reject(
				Object.assign(new Error('Content-Type must be multipart/form-data'), {
					status: 400,
				}),
			);
			return;
		}

		/** @type {Buffer[]} */
		const chunks = [];
		let found = false;
		let fileName = '';

		const busboy = Busboy({
			headers: /** @type {Record<string, string>} */ (req.headers),
			limits: { fileSize: 5 * 1024 * 1024, files: 1 },
		});

		busboy.on('file', (field, stream, info) => {
			if (field !== 'file') {
				stream.resume();
				return;
			}
			found = true;
			fileName = info.filename ?? '';
			stream.on('data', (chunk) => chunks.push(chunk));
			stream.on('limit', () => {
				reject(
					Object.assign(new Error('CSV file exceeds 5 MB limit'), {
						status: 400,
					}),
				);
			});
		});

		busboy.on('error', (err) => reject(err));
		busboy.on('finish', () => {
			if (!found) {
				reject(Object.assign(new Error('file field is required'), { status: 400 }));
				return;
			}
			const lower = fileName.toLowerCase();
			if (lower && !lower.endsWith('.csv')) {
				reject(
					Object.assign(new Error('Only .csv files are accepted'), {
						status: 400,
					}),
				);
				return;
			}
			resolve(Buffer.concat(chunks));
		});

		req.pipe(busboy);
	});
}
