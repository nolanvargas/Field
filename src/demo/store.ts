import type { AppUser } from '../api/users';
import type { OrgSettings } from '../api/orgSettings';
import type { OrgPrintTemplatesResponse } from '../api/printTemplates';
import {
	buildBootOrgSettings,
	buildBootPrintTemplates,
	buildBootUsers,
} from './fixtures/boot';
import { buildBootTasks, type DemoTaskRecord } from './fixtures/tasks';

export type DemoStore = {
	users: AppUser[];
	orgSettings: OrgSettings;
	printTemplates: OrgPrintTemplatesResponse;
	taskRecords: DemoTaskRecord[];
};

function cloneBootStore(): DemoStore {
	return {
		users: buildBootUsers().map((u) => ({ ...u, permissions: [...u.permissions] })),
		orgSettings: buildBootOrgSettings(),
		printTemplates: buildBootPrintTemplates(),
		taskRecords: buildBootTasks(),
	};
}

let store: DemoStore = cloneBootStore();

export function getDemoStore(): DemoStore {
	return store;
}

export function resetDemoStore(): void {
	store = cloneBootStore();
}
