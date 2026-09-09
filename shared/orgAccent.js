/**
 * Org accent color: one hex, derived UI/email shades.
 * Default matches the Field purple leftover (#732e75).
 */

export const DEFAULT_ACCENT = '#732e75';

/** Readable text on saturated accent surfaces. */
export const ACCENT_TEXT_DARK = '#111111';
export const ACCENT_TEXT_LIGHT = '#eeeeee';

/** @type {readonly string[]} */
export const DEFAULT_ACCENT_SHADES = Object.freeze([
	'#f8f0f8',
	'#f0e0f0',
	'#e0c0e1',
	'#c99aca',
	'#b06bb2',
	'#8f4491',
	'#732e75',
	'#5a245c',
	'#3f1941',
	'#2a102b',
]);

const HEX6 = /^#[0-9a-f]{6}$/i;
const HEX3 = /^#[0-9a-f]{3}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAccentHex(value) {
	if (typeof value !== 'string') return false;
	return HEX6.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAccentHex(value) {
	if (typeof value !== 'string') return DEFAULT_ACCENT;
	let s = value.trim();
	if (HEX3.test(s)) {
		s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
	}
	if (!HEX6.test(s)) return DEFAULT_ACCENT;
	return s.toLowerCase();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function parseAccentHexOrThrow(value) {
	if (typeof value !== 'string' || !value.trim()) {
		throw Object.assign(new Error('accentColor is required'), { status: 400 });
	}
	const s = value.trim();
	if (!HEX6.test(s) && !HEX3.test(s)) {
		throw Object.assign(
			new Error('accentColor must be a hex color (#RGB or #RRGGBB)'),
			{ status: 400 },
		);
	}
	return normalizeAccentHex(s);
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
	const n = parseInt(hex.slice(1), 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function rgbToHex(r, g, b) {
	const h = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
	return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * @param {string} a
 * @param {string} b
 * @param {number} t weight of b (0 = a, 1 = b)
 */
function mixHex(a, b, t) {
	const A = hexToRgb(a);
	const B = hexToRgb(b);
	return rgbToHex(
		A.r + (B.r - A.r) * t,
		A.g + (B.g - A.g) * t,
		A.b + (B.b - A.b) * t,
	);
}

/**
 * sRGB relative luminance (WCAG).
 * @param {string} hex
 */
function relativeLuminance(hex) {
	const { r, g, b } = hexToRgb(hex);
	const toLinear = (c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * @param {string} bg
 * @param {string} fg
 */
function contrastRatio(bg, fg) {
	const l1 = relativeLuminance(bg);
	const l2 = relativeLuminance(fg);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick #111 or #eee — whichever contrasts better on `hex`.
 * @param {unknown} value
 * @returns {string}
 */
export function contrastTextOn(value) {
	const hex = normalizeAccentHex(value);
	const darkRatio = contrastRatio(hex, ACCENT_TEXT_DARK);
	const lightRatio = contrastRatio(hex, ACCENT_TEXT_LIGHT);
	return darkRatio >= lightRatio ? ACCENT_TEXT_DARK : ACCENT_TEXT_LIGHT;
}

const MIN_BODY_TEXT_CONTRAST = 4.5;
const PUBLIC_PAGE_WHITE = '#ffffff';

/**
 * Prefer accent-derived hues; fall back to #111 / #eee when none meet contrast.
 * @param {string} bg
 * @param {string[]} candidates
 * @returns {string}
 */
function readableTextOn(bg, candidates) {
	for (const fg of candidates) {
		if (contrastRatio(bg, fg) >= MIN_BODY_TEXT_CONTRAST) return fg;
	}
	return contrastTextOn(bg);
}

/**
 * Text colors for the customer tracking page (always light theme).
 * @param {unknown} value
 * @returns {{ emphasis: string, label: string, link: string }}
 */
export function trackingPageTextColors(value) {
	const p = accentPalette(value);
	const { shades } = p;
	return {
		emphasis: readableTextOn(PUBLIC_PAGE_WHITE, [
			shades[8],
			shades[9],
			shades[7],
			p.accent,
		]),
		label: readableTextOn(p.subtle, [shades[8], shades[9], p.accent, p.onSubtle]),
		link: readableTextOn(p.footer, [shades[7], shades[8], shades[9], p.accent]),
	};
}

/**
 * @param {Record<string, string>} colors
 */
function mapContrastOn(colors) {
	return Object.fromEntries(
		Object.entries(colors).map(([key, hex]) => [key, contrastTextOn(hex)]),
	);
}

/**
 * @param {string} hex
 * @returns {string[]}
 */
function generateShades(hex) {
	return [
		mixHex(hex, '#ffffff', 0.92),
		mixHex(hex, '#ffffff', 0.84),
		mixHex(hex, '#ffffff', 0.68),
		mixHex(hex, '#ffffff', 0.48),
		mixHex(hex, '#ffffff', 0.28),
		mixHex(hex, '#ffffff', 0.12),
		hex,
		mixHex(hex, '#000000', 0.22),
		mixHex(hex, '#000000', 0.45),
		mixHex(hex, '#000000', 0.64),
	];
}

/**
 * @typedef {{
 *   accent: string,
 *   hover: string,
 *   dark: string,
 *   light: string,
 *   muted: string,
 *   subtle: string,
 *   darkSubtle: string,
 *   wash: string,
 *   footer: string,
 *   footerBorder: string,
 *   shades: string[],
 *   onAccent: string,
 *   onHover: string,
 *   onDark: string,
 *   onLight: string,
 *   onMuted: string,
 *   onSubtle: string,
 *   onDarkSubtle: string,
 *   onWash: string,
 *   onFooter: string,
 *   onSidebarActive: string,
 *   onShades: string[],
 * }} AccentPalette
 */

/**
 * @param {unknown} value
 * @returns {AccentPalette}
 */
export function accentPalette(value) {
	const accent = normalizeAccentHex(value);
	const base =
		accent === DEFAULT_ACCENT
			? {
					accent,
					hover: DEFAULT_ACCENT_SHADES[7],
					dark: DEFAULT_ACCENT_SHADES[8],
					light: DEFAULT_ACCENT_SHADES[4],
					muted: DEFAULT_ACCENT_SHADES[2],
					subtle: DEFAULT_ACCENT_SHADES[0],
					darkSubtle: '#2a1f2b',
					wash: '#f3f0f4',
					footer: '#faf7fb',
					footerBorder: '#eadfea',
					shades: [...DEFAULT_ACCENT_SHADES],
				}
			: (() => {
					const shades = generateShades(accent);
					return {
						accent,
						hover: shades[7],
						dark: shades[8],
						light: shades[4],
						muted: shades[2],
						subtle: shades[0],
						darkSubtle: mixHex(accent, '#141414', 0.82),
						wash: mixHex(accent, '#ececec', 0.9),
						footer: mixHex(accent, '#ffffff', 0.94),
						footerBorder: mixHex(accent, '#d4d4d4', 0.55),
						shades,
					};
				})();
	const on = mapContrastOn({
		accent: base.accent,
		hover: base.hover,
		dark: base.dark,
		light: base.light,
		muted: base.muted,
		subtle: base.subtle,
		darkSubtle: base.darkSubtle,
		wash: base.wash,
		footer: base.footer,
		sidebarActive: base.dark,
	});
	return {
		...base,
		onAccent: on.accent,
		onHover: on.hover,
		onDark: on.dark,
		onLight: on.light,
		onMuted: on.muted,
		onSubtle: on.subtle,
		onDarkSubtle: on.darkSubtle,
		onWash: on.wash,
		onFooter: on.footer,
		onSidebarActive: on.sidebarActive,
		onShades: base.shades.map((hex) => contrastTextOn(hex)),
	};
}

/**
 * CSS custom properties for the live theme (Field tokens + Mantine brand scale).
 * @param {unknown} value
 */
export function accentCssText(value) {
	const p = accentPalette(value);
	const trackingPage = trackingPageTextColors(value);
	const brandVars = p.shades
		.map((hex, i) => `--mantine-color-brand-${i}: ${hex} !important;`)
		.join('\n  ');
	return `:root,
[data-mantine-color-scheme],
.light-color-scheme-scope {
  --color-accent: ${p.accent} !important;
  --color-accent-hover: ${p.hover} !important;
  --color-accent-dark: ${p.dark} !important;
  --color-accent-light: ${p.light} !important;
  --color-accent-muted: ${p.muted} !important;
  --color-accent-subtle: ${p.subtle} !important;
  --color-accent-wash: ${p.wash} !important;
  --color-accent-footer: ${p.footer} !important;
  --color-accent-footer-border: ${p.footerBorder} !important;
  --color-sidebar-active: ${p.dark} !important;
  --color-on-accent: ${p.onAccent} !important;
  --color-on-accent-hover: ${p.onHover} !important;
  --color-on-accent-dark: ${p.onDark} !important;
  --color-on-accent-light: ${p.onLight} !important;
  --color-on-accent-muted: ${p.onMuted} !important;
  --color-on-accent-subtle: ${p.onSubtle} !important;
  --color-on-accent-wash: ${p.onWash} !important;
  --color-on-accent-footer: ${p.onFooter} !important;
  --color-on-sidebar-active: ${p.onSidebarActive} !important;
  --color-tracking-page-emphasis: ${trackingPage.emphasis} !important;
  --color-tracking-page-label: ${trackingPage.label} !important;
  --color-tracking-page-link: ${trackingPage.link} !important;
  ${brandVars}
  --mantine-color-brand-filled: ${p.shades[6]} !important;
  --mantine-color-brand-filled-hover: ${p.shades[7]} !important;
  --mantine-color-brand-light: ${p.subtle} !important;
  --mantine-color-brand-light-hover: ${p.shades[1]} !important;
  --mantine-color-brand-light-color: ${p.onSubtle} !important;
  --mantine-color-brand-outline: ${p.shades[6]} !important;
  --mantine-color-brand-outline-hover: ${p.shades[7]} !important;
  --mantine-primary-color-filled: ${p.shades[6]} !important;
  --mantine-primary-color-filled-hover: ${p.shades[7]} !important;
  --mantine-primary-color-contrast: ${p.onAccent} !important;
}

[data-mantine-color-scheme='dark'] {
  --color-accent-subtle: ${p.darkSubtle} !important;
  --color-on-accent-subtle: ${p.onDarkSubtle} !important;
  --mantine-color-brand-light: ${p.darkSubtle} !important;
  --mantine-color-brand-light-hover: ${p.shades[8]} !important;
  --mantine-color-brand-light-color: ${p.onDarkSubtle} !important;
}

/* Mantine filled brand controls use live --mantine-color-brand-filled. */
[style*='--button-bg: var(--mantine-color-brand-filled)'] {
  --button-color: var(--color-on-accent) !important;
  color: var(--color-on-accent) !important;
}

/* Default <Button> (no color prop) only sets --button-color inline; bg falls back to primary filled. */
.mantine-Button-root:not([style*='--button-bg:']) {
  --button-color: var(--color-on-accent) !important;
  color: var(--color-on-accent) !important;
}

:where([data-combobox-selected]) {
  color: var(--color-on-accent) !important;
}
`;
}

/**
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
export function accentEmailReplacements(value) {
	const p = accentPalette(value);
	return {
		'{{accent_color}}': p.accent,
		'{{accent_hover}}': p.hover,
		'{{accent_subtle}}': p.subtle,
		'{{accent_muted}}': p.muted,
		'{{accent_wash}}': p.wash,
		'{{accent_footer_bg}}': p.footer,
		'{{accent_footer_border}}': p.footerBorder,
		'{{accent_on}}': p.onAccent,
		'{{accent_on_subtle}}': p.onSubtle,
		'{{accent_on_wash}}': p.onWash,
		'{{accent_on_footer}}': p.onFooter,
	};
}
