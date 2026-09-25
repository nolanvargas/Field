/**
 * Apply devtools/responsively-field.json to Responsively App user config.
 * Close Responsively before running so it does not overwrite changes on exit.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DESKTOP_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const presetPath = join(repoRoot, 'devtools', 'responsively-field.json');
const preset = JSON.parse(readFileSync(presetPath, 'utf8'));

const configPath = join(
	homedir(),
	'AppData',
	'Roaming',
	'ResponsivelyApp',
	'config.json',
);

if (!existsSync(configPath)) {
	console.error(
		`Responsively config not found at ${configPath}. Install Responsively App first.`,
	);
	process.exit(1);
}

function heightForWidth(width, aspectRatio) {
	if (aspectRatio === '16:9') {
		return Math.round((width * 9) / 16);
	}
	return 900;
}

function buildWidths(minWidth, maxWidth, step, extraWidths = []) {
	const widths = new Set([minWidth, maxWidth, ...extraWidths]);
	for (let w = minWidth; w <= maxWidth; w += step) {
		widths.add(w);
	}
	return [...widths].sort((a, b) => a - b);
}

function deviceId(prefix, width) {
	const hex = width.toString(16).padStart(4, '0');
	return `${prefix}-0000-4000-8000-00000000${hex}`;
}

function makeDesktopDevice(width, { minWidth, maxWidth, aspectRatio }) {
	const height = heightForWidth(width, aspectRatio);
	const label =
		width === minWidth
			? `Field desktop min — ${width}×${height}`
			: width === maxWidth
				? `Field desktop max — ${width}×${height}`
				: `Field desktop — ${width}×${height}`;
	return {
		id: deviceId('f1e1d000', width),
		name: label,
		width,
		height,
		userAgent: DESKTOP_UA,
		type: 'notebook',
		dpr: 1,
		isTouchCapable: false,
		isMobileCapable: false,
		capabilities: [],
		isCustom: true,
	};
}

function makeMobileDevice(width, { minWidth, maxWidth, heightRatio }) {
	const height = Math.round(width * heightRatio);
	const label =
		width === minWidth
			? `Field crew min — ${width}×${height}`
			: width === maxWidth
				? `Field crew max — ${width}×${height}`
				: `Field crew — ${width}×${height}`;
	return {
		id: deviceId('f1e1d001', width),
		name: label,
		width,
		height,
		userAgent: IPHONE_UA,
		type: 'phone',
		dpr: 3,
		isTouchCapable: true,
		isMobileCapable: true,
		capabilities: ['touch', 'mobile'],
		isCustom: true,
	};
}

/** Landscape phone — shortSide is viewport height (matches portrait width range). */
function makeMobileLandscapeDevice(shortSide, { minShortSide, maxShortSide, longShortRatio }) {
	const height = shortSide;
	const width = Math.round(shortSide * longShortRatio);
	const label =
		shortSide === minShortSide
			? `Field crew landscape min — ${width}×${height}`
			: shortSide === maxShortSide
				? `Field crew landscape max — ${width}×${height}`
				: `Field crew landscape — ${width}×${height}`;
	return {
		id: deviceId('f1e1d004', shortSide),
		name: label,
		width,
		height,
		userAgent: IPHONE_UA,
		type: 'phone',
		dpr: 3,
		isTouchCapable: true,
		isMobileCapable: true,
		capabilities: ['touch', 'mobile'],
		isCustom: true,
	};
}

function makeBreakpointDevice({ width, height, name }) {
	return {
		id: deviceId('f1e1d002', width),
		name,
		width,
		height,
		userAgent: DESKTOP_UA,
		type: width < 896 ? 'phone' : 'notebook',
		dpr: 1,
		isTouchCapable: width < 896,
		isMobileCapable: width < 896,
		capabilities: width < 896 ? ['touch', 'mobile'] : [],
		isCustom: true,
	};
}

function makeTrackingDevice(width) {
	const height =
		width <= 430 ? Math.round(width * 2.165) : heightForWidth(width, '16:9');
	const label =
		width <= 430
			? `Field tracking phone — ${width}×${height}`
			: `Field tracking — ${width}×${height}`;
	return {
		id: deviceId('f1e1d003', width),
		name: label,
		width,
		height,
		userAgent: width <= 430 ? IPHONE_UA : DESKTOP_UA,
		type: width <= 430 ? 'phone' : 'notebook',
		dpr: width <= 430 ? 3 : 1,
		isTouchCapable: width <= 768,
		isMobileCapable: width <= 430,
		capabilities: width <= 430 ? ['touch', 'mobile'] : [],
		isCustom: true,
	};
}

function buildAllDevices(p) {
	const desktopRange = p.desktopRange;
	const desktopWidths = buildWidths(
		desktopRange.minWidth,
		desktopRange.maxWidth,
		desktopRange.step ?? 256,
		desktopRange.extraWidths ?? [],
	);
	const desktopDevices = desktopWidths.map((w) =>
		makeDesktopDevice(w, desktopRange),
	);

	const mobileRange = p.mobileCrewRange;
	const mobileWidths = buildWidths(
		mobileRange.minWidth,
		mobileRange.maxWidth,
		mobileRange.step ?? 16,
		mobileRange.extraWidths ?? [],
	);
	const mobileDevices = mobileWidths.map((w) =>
		makeMobileDevice(w, mobileRange),
	);

	const mobileLandscapeRange = p.mobileCrewLandscapeRange;
	const mobileLandscapeDevices = mobileLandscapeRange
		? buildWidths(
				mobileLandscapeRange.minShortSide,
				mobileLandscapeRange.maxShortSide,
				mobileLandscapeRange.step ?? 16,
				mobileLandscapeRange.extraShortSides ?? [],
			).map((shortSide) => makeMobileLandscapeDevice(shortSide, mobileLandscapeRange))
		: [];

	const breakpointDevices = (p.layoutBreakpoints ?? []).map(makeBreakpointDevice);

	const trackingDevices = (p.trackingWidths ?? []).map(makeTrackingDevice);

	const byId = new Map();
	for (const device of [
		...desktopDevices,
		...mobileDevices,
		...mobileLandscapeDevices,
		...breakpointDevices,
		...trackingDevices,
	]) {
		byId.set(device.id, device);
	}
	return byId;
}

function deviceIdsForSuite(suiteDef, devicesById, preset) {
	if (suiteDef.kind === 'desktopRange') {
		const { minWidth, maxWidth, step = 256, extraWidths = [] } =
			preset.desktopRange;
		return buildWidths(minWidth, maxWidth, step, extraWidths).map((w) =>
			deviceId('f1e1d000', w),
		);
	}
	if (suiteDef.kind === 'mobileCrewRange') {
		const { minWidth, maxWidth, step = 16, extraWidths = [] } =
			preset.mobileCrewRange;
		return buildWidths(minWidth, maxWidth, step, extraWidths).map((w) =>
			deviceId('f1e1d001', w),
		);
	}
	if (suiteDef.kind === 'mobileCrewLandscapeRange') {
		const {
			minShortSide,
			maxShortSide,
			step = 16,
			extraShortSides = [],
		} = preset.mobileCrewLandscapeRange;
		return buildWidths(minShortSide, maxShortSide, step, extraShortSides).map(
			(shortSide) => deviceId('f1e1d004', shortSide),
		);
	}
	if (suiteDef.kind === 'layoutBreakpoints') {
		return (preset.layoutBreakpoints ?? []).map((b) =>
			deviceId('f1e1d002', b.width),
		);
	}
	if (suiteDef.kind === 'tracking') {
		return (preset.trackingWidths ?? []).map((w) => deviceId('f1e1d003', w));
	}
	if (suiteDef.deviceWidths?.length) {
		const familyPrefix = {
			desktop: 'f1e1d000',
			mobile: 'f1e1d001',
			mobileLandscape: 'f1e1d004',
			breakpoint: 'f1e1d002',
			tracking: 'f1e1d003',
		}[suiteDef.deviceFamily ?? 'desktop'];
		return suiteDef.deviceWidths.map((w) => {
			const id = deviceId(familyPrefix, w);
			if (!devicesById.has(id)) {
				throw new Error(
					`Suite references width ${w} (${suiteDef.deviceFamily ?? 'desktop'}) but no device was generated.`,
				);
			}
			return id;
		});
	}
	throw new Error(`Unknown suite definition: ${JSON.stringify(suiteDef)}`);
}

const devicesById = buildAllDevices(preset);
const customDevices = [...devicesById.values()].sort(
	(a, b) => a.width - b.width || a.name.localeCompare(b.name),
);

const previewSuites = Object.entries(preset.suites).map(([id, suiteDef]) => ({
	id,
	name: suiteDef.name,
	devices: deviceIdsForSuite(suiteDef, devicesById, preset),
}));

const defaultSuite = preset.defaultActiveSuite ?? previewSuites[0]?.id;
const activeSuite = previewSuites.find((s) => s.id === defaultSuite);
if (!activeSuite) {
	console.error(`defaultActiveSuite "${defaultSuite}" not found in suites.`);
	process.exit(1);
}

const screenshotDir = resolve(repoRoot, preset.screenshotDir ?? 'storage/responsively-screenshots');
mkdirSync(screenshotDir, { recursive: true });

const config = JSON.parse(readFileSync(configPath, 'utf8'));

if (preset.homepage) {
	config.homepage = preset.homepage;
}

config.deviceManager = {
	...config.deviceManager,
	activeDevices: activeSuite.devices,
	previewSuites,
	customDevices,
};

config.bookmarks = preset.bookmarks ?? config.bookmarks;

config.webPermissions = preset.webPermissions ?? config.webPermissions;

config.userPreferences = {
	...config.userPreferences,
	screenshot: {
		...config.userPreferences?.screenshot,
		saveLocation: screenshotDir,
	},
};

writeFileSync(configPath, `${JSON.stringify(config, null, '\t')}\n`, 'utf8');

console.log(`Updated ${configPath}`);
console.log(`Homepage: ${config.homepage}`);
console.log(`Active suite: ${activeSuite.name} (${activeSuite.devices.length} panes)`);
console.log(`Preview suites: ${previewSuites.map((s) => s.name).join(' · ')}`);
console.log(`Bookmarks: ${config.bookmarks.length}`);
console.log(`Screenshots: ${screenshotDir}`);
console.log('Restart Responsively App to load changes.');
