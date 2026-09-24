/**
 * Regenerate iOS + Android launch splash and launcher icons from public/logo.svg.
 * Run after logo.svg changes: npm run branding:native-splash
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logoSvg = path.join(root, 'public', 'logo.svg');
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
const black = { r: 0, g: 0, b: 0 };

/** Full-screen legacy splashes — logo share of the short edge. */
const FULLSCREEN_LOGO_RATIO = 0.28;
/** Android 12+ masks the animated icon to a circle (~160dp in 240dp). */
const SPLASH_ICON_INSET_PERCENT = 30;

async function logoAtWidth(width) {
	return sharp(await readFile(logoSvg)).resize({ width }).png().toBuffer();
}

async function centeredLogoPng(canvasSize, logoWidth) {
	const logoPng = await logoAtWidth(logoWidth);
	return sharp({
		create: {
			width: canvasSize,
			height: canvasSize,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite([{ input: logoPng, gravity: 'center' }])
		.png()
		.toBuffer();
}

async function splashCanvas(width, height, logoWidth) {
	const logoPng = await logoAtWidth(logoWidth);
	return sharp({
		create: {
			width,
			height,
			channels: 3,
			background: black,
		},
	})
		.composite([{ input: logoPng, gravity: 'center' }])
		.png()
		.toBuffer();
}

const iosSize = 2732;
const iosLogoWidth = Math.round(iosSize * FULLSCREEN_LOGO_RATIO);
const iosSplash = await splashCanvas(iosSize, iosSize, iosLogoWidth);

const iosDir = path.join(
	root,
	'ios',
	'App',
	'App',
	'Assets.xcassets',
	'Splash.imageset',
);
for (const name of [
	'splash-2732x2732.png',
	'splash-2732x2732-1.png',
	'splash-2732x2732-2.png',
]) {
	await writeFile(path.join(iosDir, name), iosSplash);
}

const androidDrawable = path.join(androidRes, 'drawable');
await mkdir(androidDrawable, { recursive: true });
/** Bitmap for layer-list / inset source (not full-bleed). */
const splashMark = await centeredLogoPng(512, Math.round(512 * 0.52));
await writeFile(path.join(androidDrawable, 'splash_mark.png'), splashMark);

const splashScreenIconXml = `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/splash_mark"
    android:insetLeft="${SPLASH_ICON_INSET_PERCENT}%"
    android:insetTop="${SPLASH_ICON_INSET_PERCENT}%"
    android:insetRight="${SPLASH_ICON_INSET_PERCENT}%"
    android:insetBottom="${SPLASH_ICON_INSET_PERCENT}%" />
`;
await writeFile(
	path.join(androidDrawable, 'splash_screen_icon.xml'),
	splashScreenIconXml,
	'utf8',
);

const splashXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/black" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_mark" />
    </item>
</layer-list>
`;
await writeFile(path.join(androidDrawable, 'splash.xml'), splashXml, 'utf8');

/** Capacitor default orientation-qualified splashes (override stale purple assets). */
const resEntries = await readdir(androidRes, { withFileTypes: true });
for (const entry of resEntries) {
	if (!entry.isDirectory()) continue;
	if (!/^drawable-(port|land)-/.test(entry.name)) continue;
	const splashPath = path.join(androidRes, entry.name, 'splash.png');
	try {
		const meta = await sharp(splashPath).metadata();
		const w = meta.width ?? 1080;
		const h = meta.height ?? 1920;
		const logoWidth = Math.round(Math.min(w, h) * FULLSCREEN_LOGO_RATIO);
		const png = await splashCanvas(w, h, logoWidth);
		await writeFile(splashPath, png);
		console.log(`  ${entry.name}/splash.png (${w}×${h})`);
	} catch {
		// missing splash in this qualifier
	}
}

/** Launcher mipmaps (Android 12+ splash uses the adaptive foreground icon). */
const mipmapNames = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];
for (const entry of resEntries) {
	if (!entry.isDirectory() || !entry.name.startsWith('mipmap-')) continue;
	if (entry.name === 'mipmap-anydpi-v26') continue;
	const dir = path.join(androidRes, entry.name);
	for (const fileName of mipmapNames) {
		const filePath = path.join(dir, fileName);
		try {
			const meta = await sharp(filePath).metadata();
			const size = meta.width ?? 96;
			const logoWidth = Math.round(size * 0.58);
			const png = await centeredLogoPng(size, logoWidth);
			await writeFile(filePath, png);
		} catch {
			// optional density folder
		}
	}
	console.log(`  ${entry.name} launcher icons`);
}

console.log('Native splash + launcher assets updated from public/logo.svg.');
