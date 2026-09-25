import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewTaskModal } from '../src/components/NewTaskModal';
import { OrgSettingsProvider } from '../src/context/OrgSettingsContext';
import { CurrentUserProvider } from '../src/context/CurrentUserContext';
import { renderUi } from './helpers/renderUi';

const notifyError = vi.fn();

vi.mock('../src/notify', () => ({
	notifyError: (...args: unknown[]) => notifyError(...args),
	notifySuccess: vi.fn(),
	notifyWarning: vi.fn(),
	notifyInfo: vi.fn(),
}));

vi.mock('../src/api/users', () => ({
	listUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/api/contacts', () => ({
	listContacts: vi.fn().mockResolvedValue([]),
	createContact: vi.fn(),
}));

vi.mock('../src/api/addresses', () => ({
	listAddresses: vi.fn().mockResolvedValue([]),
	createAddress: vi.fn(),
}));

vi.mock('../src/api/tasks', () => ({
	listTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/printTemplateCache', () => ({
	syncPrintTemplateCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/api/orgSettings', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../src/api/orgSettings')>();
	const { UNSET_ACCENT } = await import('../shared/orgAccent.js');
	const { defaultTrackingPageTemplate } = await import(
		'../shared/trackingPageTemplate.js'
	);
	const stubOrgSettings = {
		externalKeyLabel: '',
		cancelRetentionDays: null,
		requiredTaskFields: ['contacts'],
		webAuthSource: 'env' as const,
		webAuthConfig: { clientId: '', tenantId: '' },
		taskTypes: [
			{
				id: 1,
				name: 'Delivery',
				slug: 'delivery',
				icon: 'Package',
				enabled: true,
				sortOrder: 0,
				pluralName: 'Deliveries',
				trackingPageTemplate: defaultTrackingPageTemplate('Delivery'),
			},
		],
		customFieldDefs: { task: [], user: [], contact: [], address: [] },
		attachmentTypeDefs: [],
		printTemplatesRevision: '',
		accentColor: UNSET_ACCENT,
		logoUrl: null,
		logoHighContrast: false,
	};
	return {
		...actual,
		getOrgSettings: vi.fn().mockResolvedValue(stubOrgSettings),
	};
});

function renderNewTaskModal() {
	const onClose = vi.fn();
	renderUi(
		<CurrentUserProvider>
			<OrgSettingsProvider>
				<NewTaskModal opened onClose={onClose} />
			</OrgSettingsProvider>
		</CurrentUserProvider>,
	);
	return { onClose };
}

describe('NewTaskModal validation', () => {
	beforeEach(() => {
		notifyError.mockClear();
	});

	it('blocks save and shows required-field error when contacts are missing', async () => {
		const user = userEvent.setup();
		renderNewTaskModal();

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Delivery' })).toBeVisible();
		});

		await user.click(screen.getByRole('button', { name: 'Delivery' }));

		await user.click(screen.getByRole('button', { name: 'Save & Close' }));

		await waitFor(() => {
			expect(notifyError).toHaveBeenCalledWith('Contacts is required');
		});
	});
});
