import { describe, expect, it } from 'vitest';
import {
	ACCENT_TEXT_DARK,
	ACCENT_TEXT_LIGHT,
	UNSET_ACCENT,
	UNSET_ACCENT_SHADES,
	accentCssText,
	accentEmailReplacements,
	accentPalette,
	contrastTextOn,
	isAccentHex,
	normalizeAccentHex,
	parseAccentHexOrThrow,
	trackingPageTextColors,
} from '../shared/orgAccent.js';

describe('normalizeAccentHex', () => {
	it('lowercases a valid hex', () => {
		expect(normalizeAccentHex('#B45309')).toBe('#b45309');
		expect(accentPalette('#b45309').shades).toHaveLength(10);
	});

	it('uses neutral unset accent for missing input', () => {
		expect(normalizeAccentHex('purple')).toBe(UNSET_ACCENT);
		expect(normalizeAccentHex('')).toBe(UNSET_ACCENT);
		expect(accentPalette(UNSET_ACCENT).shades).toEqual([...UNSET_ACCENT_SHADES]);
		expect(isAccentHex('#b45309')).toBe(true);
		expect(isAccentHex('#732e7')).toBe(false);
	});

	it('expands #RGB', () => {
		expect(normalizeAccentHex('#abc')).toBe('#aabbcc');
	});
});

describe('parseAccentHexOrThrow', () => {
	it('rejects invalid values', () => {
		expect(() => parseAccentHexOrThrow('red')).toThrow(/hex color/);
	});
});

describe('contrastTextOn', () => {
	it('picks #111 or #eee by contrast ratio', () => {
		expect(contrastTextOn('#b45309')).toBe(ACCENT_TEXT_LIGHT);
		expect(contrastTextOn('#ffff00')).toBe(ACCENT_TEXT_DARK);
		expect(contrastTextOn('#111111')).toBe(ACCENT_TEXT_LIGHT);
	});
});

describe('accentPalette', () => {
	it('derives a 10-shade scale around a custom hex', () => {
		const p = accentPalette('#1c7ed6');
		expect(p.accent).toBe('#1c7ed6');
		expect(p.shades).toHaveLength(10);
		expect(p.shades[6]).toBe('#1c7ed6');
		expect(p.subtle).not.toBe(p.accent);
		expect(p.hover).not.toBe(p.accent);
	});

	it('includes readable text for every derived surface', () => {
		const p = accentPalette('#ffff00');
		expect(p.onAccent).toBe(ACCENT_TEXT_DARK);
		expect(p.onSubtle).toBe(ACCENT_TEXT_DARK);
		expect(p.onShades).toHaveLength(10);
		for (const text of p.onShades) {
			expect([ACCENT_TEXT_DARK, ACCENT_TEXT_LIGHT]).toContain(text);
		}
	});
});

describe('trackingPageTextColors', () => {
	it('stays readable when the org accent is white', () => {
		const colors = trackingPageTextColors('#ffffff');
		expect(colors.emphasis).not.toBe('#ffffff');
		expect(colors.label).not.toBe('#ffffff');
		expect(colors.link).not.toBe('#ffffff');
	});
});

describe('accentCssText', () => {
	it('emits on-accent tokens for CSS consumers', () => {
		const css = accentCssText('#b45309');
		expect(css).toContain('--color-on-accent:');
		expect(css).toContain('--color-on-accent-subtle:');
		expect(css).toContain('--color-tracking-page-emphasis:');
		expect(css).toContain('--mantine-primary-color-contrast:');
		expect(css).toContain('--mantine-primary-color-filled:');
		expect(css).toContain('.mantine-Button-root:not([style*=\'--button-bg:\'])');
	});
});

describe('accentEmailReplacements', () => {
	it('uses names that are not prefixes of each other', () => {
		const keys = Object.keys(accentEmailReplacements(UNSET_ACCENT));
		for (const a of keys) {
			for (const b of keys) {
				if (a === b) continue;
				expect(a.includes(b)).toBe(false);
			}
		}
	});

	it('includes contrast tokens for email templates', () => {
		const reps = accentEmailReplacements('#ffff00');
		expect(reps['{{accent_on}}']).toBe(ACCENT_TEXT_DARK);
		expect(reps['{{accent_on_subtle}}']).toBe(ACCENT_TEXT_DARK);
	});
});
