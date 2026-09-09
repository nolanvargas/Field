/**
 * CSV helpers for Windows-1252 contact/venue/user exports.
 */
import { readFileSync } from 'node:fs';
export { parseCsv } from '../../shared/csv.js';

/** Decode Windows-1252 export (curly quotes, en-dashes, etc.). */
export function readCsvText(path) {
	const buf = readFileSync(path);
	const cp1252 = {
		0x80: '€',
		0x82: '‚',
		0x83: 'ƒ',
		0x84: '„',
		0x85: '…',
		0x86: '†',
		0x87: '‡',
		0x88: 'ˆ',
		0x89: '‰',
		0x8a: 'Š',
		0x8b: '‹',
		0x8c: 'Œ',
		0x8e: 'Ž',
		0x91: '‘',
		0x92: '’',
		0x93: '“',
		0x94: '”',
		0x95: '•',
		0x96: '–',
		0x97: '—',
		0x98: '˜',
		0x99: '™',
		0x9a: 'š',
		0x9b: '›',
		0x9c: 'œ',
		0x9e: 'ž',
		0x9f: 'Ÿ',
	};
	let text = '';
	for (const byte of buf) {
		if (byte < 0x80) text += String.fromCharCode(byte);
		else text += cp1252[byte] ?? String.fromCharCode(byte);
	}
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
	return text;
}
