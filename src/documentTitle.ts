import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useOrgSettings } from './context/OrgSettingsContext';
import { resolveTaskListTypeFilters } from '../shared/resolveTaskListTypeFilters.js';
import { taskListPageLabels } from '../shared/taskListPageLabels.js';
import { useTaskListTypeFilters } from './taskListTypeFilters';

const APP_NAME = 'Field';

const EXACT_TITLES: Record<string, string> = {
	'/': APP_NAME,
	'/contacts': 'Contacts',
	'/addresses': 'Addresses',
	'/users': 'Users',
	'/management': 'Management',
	'/development': 'Development',
	'/development/tests': 'Tests',
	'/development/scripts': 'NPM scripts',
	'/development/status-transitions': 'Status transitions',
	'/development/document-templates': 'Print templates',
	'/crew-map': 'Crew Map',
	'/more': 'More',
	'/settings': 'Settings',
	'/notifications': 'Notifications',
};

function pageTitleForPath(
	pathname: string,
	orgFilters: string[],
	taskTypes: { name: string; pluralName?: string }[],
): string {
	if (pathname === '/tasks' || pathname === '/my-tasks') {
		const labels = taskListPageLabels(orgFilters, taskTypes);
		if (pathname === '/my-tasks') return labels.mine;
		return labels.all;
	}

	const exact = EXACT_TITLES[pathname];
	if (exact) return exact;

	if (/^\/t\/[^/]+\/?$/.test(pathname)) return 'Order tracking';
	if (/^\/task\/[^/]+\/complete\/?$/.test(pathname)) return 'Complete Task';
	if (/^\/task\/[^/]+\/deliver\/?$/.test(pathname)) return 'Deliver Task';
	if (/^\/task\/[^/]+\/?$/.test(pathname)) return 'Task';

	return APP_NAME;
}

export function formatDocumentTitle(page?: string | null): string {
	if (!page || page === APP_NAME) return APP_NAME;
	return `${page}`;
}

/** Sets `document.title` from the current route (`Page · Field`). */
export function DocumentTitle() {
	const { pathname } = useLocation();
	const { settings } = useOrgSettings();
	const [userTypeFilters] = useTaskListTypeFilters();
	const enabledTaskTypeNames = useMemo(
		() =>
			settings.taskTypes
				.filter((type) => type.enabled)
				.map((type) => type.name),
		[settings.taskTypes],
	);
	const activeTypeFilters = useMemo(
		() =>
			resolveTaskListTypeFilters({
				userFilters: userTypeFilters,
				enabledTypeNames: enabledTaskTypeNames,
			}),
		[userTypeFilters, enabledTaskTypeNames],
	);

	const title = useMemo(
		() => pageTitleForPath(pathname, activeTypeFilters, settings.taskTypes),
		[pathname, activeTypeFilters, settings.taskTypes],
	);

	useEffect(() => {
		document.title = formatDocumentTitle(title);
	}, [title]);

	return null;
}

/** Override the document title for a specific screen (e.g. sign-in, task detail). */
export function useDocumentTitle(page: string | null | undefined) {
	useEffect(() => {
		if (page == null) return;
		const previous = document.title;
		document.title = formatDocumentTitle(page);
		return () => {
			document.title = previous;
		};
	}, [page]);
}
