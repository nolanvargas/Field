export const DEFAULT_ACCENT: '#732e75';
export const DEFAULT_ACCENT_SHADES: readonly string[];
export const ACCENT_TEXT_DARK: '#111111';
export const ACCENT_TEXT_LIGHT: '#eeeeee';

export interface AccentPalette {
	accent: string;
	hover: string;
	dark: string;
	light: string;
	muted: string;
	subtle: string;
	darkSubtle: string;
	wash: string;
	footer: string;
	footerBorder: string;
	shades: string[];
	onAccent: string;
	onHover: string;
	onDark: string;
	onLight: string;
	onMuted: string;
	onSubtle: string;
	onDarkSubtle: string;
	onWash: string;
	onFooter: string;
	onSidebarActive: string;
	onShades: string[];
}

export function isAccentHex(value: unknown): boolean;
export function normalizeAccentHex(value: unknown): string;
export function parseAccentHexOrThrow(value: unknown): string;
export function contrastTextOn(value: unknown): string;
export interface TrackingPageTextColors {
	emphasis: string;
	label: string;
	link: string;
}
export function trackingPageTextColors(value: unknown): TrackingPageTextColors;
export function accentPalette(value: unknown): AccentPalette;
export function accentCssText(value: unknown): string;
export function accentEmailReplacements(value: unknown): Record<string, string>;
