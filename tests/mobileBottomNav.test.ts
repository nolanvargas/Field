import { beforeEach, describe, expect, it } from 'vitest';
import {
	buildMobileBottomNavItems,
	getMorePageUnpinnedCatalogLinks,
} from '../src/mobileBottomNavItems';
import {
	MOBILE_BOTTOM_NAV_PIN_DEFAULTS,
	type MobileBottomNavPins,
} from '../src/mobileBottomNavPrefs';

const PAGE_LABELS = { mine: 'My deliveries', all: 'All deliveries' };

describe('mobileBottomNavItems', () => {
	describe('buildMobileBottomNavItems', () => {
		it('uses defaults: My Tasks, Contacts, More; no All tasks without permission', () => {
			const items = buildMobileBottomNavItems({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: false,
				pins: { ...MOBILE_BOTTOM_NAV_PIN_DEFAULTS },
			});
			expect(items.map((i) => i.to)).toEqual([
				'/my-tasks',
				'/contacts',
				'/more',
			]);
		});

		it('includes All tasks when permitted and pinned by default', () => {
			const items = buildMobileBottomNavItems({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: true,
				pins: { ...MOBILE_BOTTOM_NAV_PIN_DEFAULTS },
			});
			expect(items.map((i) => i.to)).toEqual([
				'/my-tasks',
				'/tasks',
				'/contacts',
				'/more',
			]);
		});

		it('omits All tasks when unpinned even with permission', () => {
			const pins: MobileBottomNavPins = {
				...MOBILE_BOTTOM_NAV_PIN_DEFAULTS,
				allTasks: false,
			};
			const items = buildMobileBottomNavItems({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: true,
				pins,
			});
			expect(items.map((i) => i.to)).toEqual([
				'/my-tasks',
				'/contacts',
				'/more',
			]);
		});

		it('ignores allTasks pin when user lacks view_all_tasks', () => {
			const pins: MobileBottomNavPins = {
				...MOBILE_BOTTOM_NAV_PIN_DEFAULTS,
				allTasks: true,
			};
			const items = buildMobileBottomNavItems({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: false,
				pins,
			});
			expect(items.some((i) => i.to === '/tasks')).toBe(false);
		});

		it('pins Addresses when enabled', () => {
			const pins: MobileBottomNavPins = {
				...MOBILE_BOTTOM_NAV_PIN_DEFAULTS,
				addresses: true,
			};
			const items = buildMobileBottomNavItems({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: false,
				pins,
			});
			expect(items.map((i) => i.to)).toEqual([
				'/my-tasks',
				'/contacts',
				'/addresses',
				'/more',
			]);
		});
	});

	describe('getMorePageUnpinnedCatalogLinks', () => {
		it('lists Addresses and not Contacts under default pins', () => {
			const links = getMorePageUnpinnedCatalogLinks({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: false,
				pins: { ...MOBILE_BOTTOM_NAV_PIN_DEFAULTS },
			});
			expect(links.map((l) => l.to)).toEqual(['/addresses']);
		});

		it('lists unpinned catalog pages including All tasks', () => {
			const pins: MobileBottomNavPins = {
				contacts: false,
				addresses: false,
				allTasks: false,
			};
			const links = getMorePageUnpinnedCatalogLinks({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: true,
				pins,
			});
			expect(links.map((l) => l.to)).toEqual([
				'/tasks',
				'/contacts',
				'/addresses',
			]);
		});

		it('does not list All tasks without permission', () => {
			const pins: MobileBottomNavPins = {
				...MOBILE_BOTTOM_NAV_PIN_DEFAULTS,
				allTasks: false,
			};
			const links = getMorePageUnpinnedCatalogLinks({
				pageLabels: PAGE_LABELS,
				showAllTasksNav: false,
				pins,
			});
			expect(links.some((l) => l.to === '/tasks')).toBe(false);
		});
	});
});

describe('mobileBottomNavPrefs storage', () => {
	const STORAGE_KEY = 'field.mobileBottomNavPins';

	beforeEach(() => {
		localStorage.removeItem(STORAGE_KEY);
	});

	it('merges partial stored JSON with defaults', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ contacts: false, addresses: true }),
		);
		const { getMobileBottomNavPins } = await import('../src/mobileBottomNavPrefs');
		expect(getMobileBottomNavPins()).toEqual({
			contacts: false,
			addresses: true,
			allTasks: true,
		});
	});

	it('returns a stable snapshot reference for useSyncExternalStore', async () => {
		const { getMobileBottomNavPins } = await import('../src/mobileBottomNavPrefs');
		const first = getMobileBottomNavPins();
		const second = getMobileBottomNavPins();
		expect(second).toBe(first);
	});
});
