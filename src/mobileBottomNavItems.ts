import type { MobileBottomNavPins, MobileNavPinId } from './mobileBottomNavPrefs';

export type MobileBottomNavItem = {
	to: string;
	end: boolean;
	label: string;
};

export type MorePageCatalogLink = {
	to: string;
	label: string;
	pinId: MobileNavPinId;
};

type BuildOptions = {
	pageLabels: { mine: string; all: string };
	showAllTasksNav: boolean;
	pins: MobileBottomNavPins;
};

function isAllTasksPinned(showAllTasksNav: boolean, pins: MobileBottomNavPins): boolean {
	return showAllTasksNav && pins.allTasks;
}

/** Ordered mobile footer tabs: My Tasks, optional pins, More. */
export function buildMobileBottomNavItems({
	pageLabels,
	showAllTasksNav,
	pins,
}: BuildOptions): MobileBottomNavItem[] {
	const items: MobileBottomNavItem[] = [
		{ to: '/my-tasks', end: false, label: pageLabels.mine },
	];

	if (isAllTasksPinned(showAllTasksNav, pins)) {
		items.push({ to: '/tasks', end: false, label: pageLabels.all });
	}
	if (pins.contacts) {
		items.push({ to: '/contacts', end: false, label: 'Contacts' });
	}
	if (pins.addresses) {
		items.push({ to: '/addresses', end: false, label: 'Addresses' });
	}

	items.push({ to: '/more', end: false, label: 'More' });
	return items;
}

/** Catalog pages shown under More → Pages when not pinned to the tab bar. */
export function getMorePageUnpinnedCatalogLinks({
	pageLabels,
	showAllTasksNav,
	pins,
}: BuildOptions): MorePageCatalogLink[] {
	const links: MorePageCatalogLink[] = [];

	if (showAllTasksNav && !pins.allTasks) {
		links.push({
			to: '/tasks',
			label: pageLabels.all,
			pinId: 'allTasks',
		});
	}
	if (!pins.contacts) {
		links.push({
			to: '/contacts',
			label: 'Contacts',
			pinId: 'contacts',
		});
	}
	if (!pins.addresses) {
		links.push({
			to: '/addresses',
			label: 'Addresses',
			pinId: 'addresses',
		});
	}

	return links;
}
