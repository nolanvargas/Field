/**
 * Rasterize Showcase INC mark SVG to transparent PNG for the demo build.
 * public/demo/showcase-logo.png is hand-maintained (not overwritten here).
 * Source: assets/org-logos/showcase-inc-mark.svg → public/demo/showcase-mark.png
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EXPORTS = [
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

console.log('Showcase demo mark PNG written to public/demo/showcase-mark.png');
