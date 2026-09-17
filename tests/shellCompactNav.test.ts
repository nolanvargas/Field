import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	initialCompactNavOpen,
	readCompactNavOpen,
	writeCompactNavOpen,
} from '../src/shellCompactNav';

describe('shellCompactNav', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('persists open state in sessionStorage', () => {
		expect(readCompactNavOpen()).toBeNull();
		writeCompactNavOpen(true);
		expect(readCompactNavOpen()).toBe(true);
		writeCompactNavOpen(false);
		expect(readCompactNavOpen()).toBe(false);
	});

	it('defaults closed at ≤1280px and expanded above when nothing stored', () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => ({
				matches: false,
				media: '',
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		);
		expect(initialCompactNavOpen()).toBe(false);

		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => ({
				matches: true,
				media: '',
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		);
		expect(initialCompactNavOpen()).toBe(true);
	});

	it('prefers stored state over viewport default', () => {
		writeCompactNavOpen(false);
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => ({
				matches: true,
				media: '',
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		);
		expect(initialCompactNavOpen()).toBe(false);
	});
});
