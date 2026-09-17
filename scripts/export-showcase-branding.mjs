/**
 * Rasterize Showcase INC vector logos to transparent PNGs for the demo build.
 * Source: assets/org-logos/showcase-inc-*.svg → public/demo/showcase-*.png
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EXPORTS = [
	{
		svg: path.join(ROOT, 'assets', 'org-logos', 'showcase-inc-logo.svg'),
		png: path.join(ROOT, 'public', 'demo', 'showcase-logo.png'),
		width: 584,
	},
	{
		svg: path.join(ROOT, 'assets', 'org-logos', 'showcase-inc-mark.svg'),
		png: path.join(ROOT, 'public', 'demo', 'showcase-mark.png'),
		width: 128,
	},
];

for (const { svg, png, width } of EXPORTS) {
	const input = await readFile(svg);
	const meta = await sharp(input).resize({ width }).png().toFile(png);
	if (!meta.channels || meta.channels < 4) {
		throw new Error(`Expected RGBA PNG for ${png}`);
	}
	const stats = await sharp(png).stats();
	const alphaMin = stats.channels[3]?.min;
	if (alphaMin !== 0) {
		throw new Error(`${png}: expected transparent background (alpha min ${alphaMin})`);
	}
}

console.log('Showcase demo branding PNGs written to public/demo/');
