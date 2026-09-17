import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
	Box,
	Button,
	Checkbox,
	ColorInput,
	Group,
	Loader,
	Select,
	Stack,
	Switch,
	Tabs,
	Text,
	TextInput,
	Title,
	UnstyledButton,
} from '@mantine/core';
import { ExternalLink, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import {
	updateOrgSettings,
	type CustomFieldDefsByEntity,
	type OrgAttachmentTypeDef,
	type OrgCustomFieldDef,
	type OrgSettings,
	type OrgTaskType,
} from '../api/orgSettings';
import { useAlert } from '../context/AlertContext';
import { useCurrentUser } from '../context/CurrentUserContext';
import {
	useBeforeUnloadWhenDirty,
	useRegisterNavigationGuard,
} from '../context/NavigationGuardContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { resetWebAuthConfigCache } from '../auth/webAuthConfig';
import { isOrgSettingsDraftDirty } from '../../shared/orgSettingsDraft.js';
import { defaultTrackingPageTemplate } from '../../shared/trackingPageTemplate.js';
import { FIELD_BRAND_ACCENT } from '../../shared/fieldBrand.js';
import { hasPermission, PERMISSIONS } from '../../shared/permissions.js';
import { OrgTaskIconPicker } from '../components/OrgTaskIconPicker';
import {
	SettingsGrid,
	type SettingsGridColumn,
} from '../components/SettingsGrid';
import { labeledCustomFieldDefs } from '../customFields';
import {
	ALL_REQUIRED_TASK_FIELDS,
	isTaskFieldRequired,
	requiredTaskFieldLabel,
} from '../../shared/requiredTaskFields.js';
import { ManagementImportExportSection } from '../components/ManagementImportExportSection';
import { CustomFieldDefsEditor } from '../components/CustomFieldDefsEditor';
import { AttachmentTypeDefsEditor } from '../components/AttachmentTypeDefsEditor';
import { TaskTypeNameCombobox } from '../components/TaskTypeNameCombobox';
import {
	ALL_CUSTOM_FIELD_ENTITIES,
	CUSTOM_FIELD_ENTITIES,
	CUSTOM_FIELD_ENTITY_LABELS,
	type CustomFieldEntity,
} from '../../shared/customFieldEntities.js';
import { notifyError, notifySuccess } from '../notify';
import { TrackingPageBlockEditor } from '../components/TrackingPageBlockEditor';
import type { WebAuthSource } from '../../shared/webAuthConfig.js';
import { applyOrgAccent } from '../applyOrgAccent';
import { UNSET_ACCENT, normalizeAccentHex } from '../../shared/orgAccent.js';
import { openTrackingPagePreview } from '../trackingPagePreviewStorage';
import {
	deleteOrgLogo,
	uploadOrgLogo,
	validateOrgLogoFile,
} from '../api/orgLogo';
import { orgLogoSrc } from '../orgLogoSrc';

const RETENTION_OPTIONS = [
	{ value: '3', label: '3 days' },
	{ value: '7', label: '7 days' },
	{ value: '14', label: '14 days' },
	{ value: '30', label: '30 days' },
	{ value: 'never', label: 'Never' },
];

const TASK_TYPE_COLUMNS: SettingsGridColumn[] = [
	{ key: 'enabled', header: 'Enabled', width: '4.75rem', align: 'center' },
	{ key: 'name', header: 'Name' },
	{ key: 'plural', header: 'Plural name' },
	{ key: 'icon', header: 'Icon', width: '4.5rem' },
];

const ACCENT_SWATCHES = [
	FIELD_BRAND_ACCENT,
	'#1c7ed6',
	'#0c8599',
	'#2f9e44',
	'#e8590c',
	'#c92a2a',
	'#5c5f66',
];

const MANAGEMENT_SECTIONS = [
	{ id: 'branding', label: 'Branding' },
	{ id: 'cancel-retention', label: 'Cancel retention' },
	{ id: 'attachment-types', label: 'Attachment types' },
	{ id: 'custom-fields', label: 'Custom fields' },
	{ id: 'external-key', label: 'External key' },
	{ id: 'import-export', label: 'Import / export' },
	{ id: 'required-fields', label: 'Required fields' },
	{ id: 'task-types', label: 'Task types' },
	{ id: 'tracking-page', label: 'Tracking page' },
	{ id: 'web-auth', label: 'Web sign-in' },
] as const;

type ManagementSectionId = (typeof MANAGEMENT_SECTIONS)[number]['id'];

function emptyCustomField(slot: number): OrgCustomFieldDef {
	return {
		slot,
		label: '',
		dataType: 'text',
		required: false,
		lookupTable: null,
		options: [],
		showWhen: null,
	};
}

function slugifyTaskType(name: string): string {
	return String(name ?? '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const WEB_AUTH_SOURCE_OPTIONS = [
	{ value: 'env', label: 'Server environment (AZURE_* variables)' },
	{ value: 'stub', label: 'Dev stub (user picker)' },
	{ value: 'entra', label: 'Microsoft Entra ID' },
];

function cloneSettings(settings: OrgSettings): OrgSettings {
	return {
		...settings,
		requiredTaskFields: [...settings.requiredTaskFields],
		webAuthConfig: { ...settings.webAuthConfig },
		taskTypes: settings.taskTypes.map((t) => ({
			...t,
			trackingPageTemplate: structuredClone(t.trackingPageTemplate),
		})),
		customFieldDefs: mapCustomFieldDefs(settings.customFieldDefs, (defs) =>
			defs.map((d) => ({
				...d,
				options: [...(d.options ?? [])],
				showWhen: d.showWhen
					? { taskTypeNames: [...d.showWhen.taskTypeNames] }
					: null,
			})),
		),
		attachmentTypeDefs: (settings.attachmentTypeDefs ?? []).map((d) => ({
			...d,
			allowedMimeCategories: [...d.allowedMimeCategories],
			showWhen: d.showWhen
				? { taskTypeNames: [...d.showWhen.taskTypeNames] }
				: null,
		})),
	};
}

function mapCustomFieldDefs(
	byEntity: CustomFieldDefsByEntity,
	fn: (defs: OrgCustomFieldDef[]) => OrgCustomFieldDef[],
): CustomFieldDefsByEntity {
	return {
		task: fn(byEntity.task ?? []),
		user: fn(byEntity.user ?? []),
		contact: fn(byEntity.contact ?? []),
		address: fn(byEntity.address ?? []),
	};
}

function remapTaskShowWhenNames(
	defs: OrgCustomFieldDef[],
	fromName: string,
	toName: string | null,
): OrgCustomFieldDef[] {
	if (!fromName) return defs;
	return defs.map((def) => {
		const names = def.showWhen?.taskTypeNames;
		if (!names?.includes(fromName)) return def;
		const next = names
			.map((n) => (n === fromName ? toName : n))
			.filter((n): n is string => Boolean(n && n.trim()));
		return {
			...def,
			showWhen: next.length > 0 ? { taskTypeNames: next } : null,
		};
	});
}

export function ManagementPage() {
	const { confirmUnsavedChanges } = useAlert();
	const { user, loading: userLoading } = useCurrentUser();
	const { settings: loaded, loading, refresh } = useOrgSettings();
	const [draft, setDraft] = useState<OrgSettings | null>(null);
	const [saving, setSaving] = useState(false);
	const [activeSection, setActiveSection] =
		useState<ManagementSectionId>('branding');
	const [trackingPageTaskTypeIndex, setTrackingPageTaskTypeIndex] = useState(0);
	const [customFieldEntity, setCustomFieldEntity] = useState<CustomFieldEntity>(
		CUSTOM_FIELD_ENTITIES.task,
	);
	const [logoUploading, setLogoUploading] = useState(false);
	const logoFileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (loaded) setDraft(cloneSettings(loaded));
	}, [loaded]);

	useEffect(() => {
		if (!draft) return;
		applyOrgAccent(draft.accentColor);
		return () => applyOrgAccent(loaded.accentColor);
	}, [draft, loaded]);

	const hasUnsavedChanges = useMemo(
		() => (draft && loaded ? isOrgSettingsDraftDirty(draft, loaded) : false),
		[draft, loaded],
	);

	const onLogoFileSelected = async (file: File | null) => {
		if (!file || !user) return;
		const validationError = validateOrgLogoFile(file);
		if (validationError) {
			notifyError(validationError);
			return;
		}
		setLogoUploading(true);
		try {
			await uploadOrgLogo(file, user.id);
			await refresh();
			notifySuccess('Org logo uploaded');
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Upload failed');
		} finally {
			setLogoUploading(false);
			if (logoFileInputRef.current) logoFileInputRef.current.value = '';
		}
	};

	const onRemoveLogo = async () => {
		if (!user) return;
		setLogoUploading(true);
		try {
			await deleteOrgLogo(user.id);
			await refresh();
			notifySuccess('Org logo removed');
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Remove failed');
		} finally {
			setLogoUploading(false);
		}
	};

	const enabledTrackingPageTaskTypes = useMemo(
		() =>
			draft
				? draft.taskTypes
						.map((taskType, index) => ({ taskType, index }))
						.filter(
							({ taskType }) => taskType.enabled && taskType.name.trim(),
						)
				: [],
		[draft],
	);

	const activeTrackingPageTaskType =
		enabledTrackingPageTaskTypes[
			Math.min(trackingPageTaskTypeIndex, enabledTrackingPageTaskTypes.length - 1)
		] ?? null;

	const discardDraft = useCallback(() => {
		if (loaded) setDraft(cloneSettings(loaded));
	}, [loaded]);

	const persistDraft = useCallback(async (): Promise<boolean> => {
		if (!draft || !user) return false;
		setSaving(true);
		try {
			await updateOrgSettings({
				settings: {
					externalKeyLabel: draft.externalKeyLabel,
					cancelRetentionDays: draft.cancelRetentionDays,
					requiredTaskFields: draft.requiredTaskFields,
					webAuthSource: draft.webAuthSource,
					webAuthConfig: draft.webAuthConfig,
					accentColor: normalizeAccentHex(draft.accentColor),
					logoHighContrast: draft.logoHighContrast,
				},
				taskTypes: draft.taskTypes,
				customFieldDefs: mapCustomFieldDefs(draft.customFieldDefs, (defs) =>
					defs.filter((d) => d.label.trim()),
				),
				attachmentTypeDefs: draft.attachmentTypeDefs
					.filter((d) => d.label.trim())
					.map((d, index) => ({ ...d, sortOrder: index })),
				actorUserId: user.id,
			});
			await refresh();
			resetWebAuthConfigCache();
			notifySuccess('Settings saved.');
			return true;
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Save failed');
			return false;
		} finally {
			setSaving(false);
		}
	}, [draft, user, refresh]);

	const resolveUnsavedChanges = useCallback(async (): Promise<boolean> => {
		if (!hasUnsavedChanges) return true;
		const result = await confirmUnsavedChanges();
		if (result === 'stay') return false;
		if (result === 'save') return await persistDraft();
		discardDraft();
		return true;
	}, [confirmUnsavedChanges, discardDraft, hasUnsavedChanges, persistDraft]);

	useRegisterNavigationGuard(
		hasUnsavedChanges,
		discardDraft,
		persistDraft,
		Boolean(draft && loaded),
	);
	useBeforeUnloadWhenDirty(hasUnsavedChanges);

	const requestSection = useCallback(
		async (section: ManagementSectionId) => {
			if (section === activeSection) return;
			if (!(await resolveUnsavedChanges())) return;
			setActiveSection(section);
		},
		[activeSection, resolveUnsavedChanges],
	);

	const updateDraft = useCallback((patch: Partial<OrgSettings>) => {
		setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
	}, []);

	const updateTaskTypeTrackingPageTemplate = useCallback(
		(index: number, trackingPageTemplate: OrgTaskType['trackingPageTemplate']) => {
			setDraft((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					taskTypes: prev.taskTypes.map((t, i) =>
						i === index ? { ...t, trackingPageTemplate } : t,
					),
				};
			});
		},
		[],
	);

	const updateTaskType = useCallback((index: number, patch: Partial<OrgTaskType>) => {
		setDraft((prev) => {
			if (!prev) return prev;
			const previousName = prev.taskTypes[index]?.name;
			const taskTypes = prev.taskTypes.map((t, i) => {
				if (i !== index) return t;
				const updated = { ...t, ...patch };
				if (patch.name !== undefined) {
					updated.slug = slugifyTaskType(patch.name);
				}
				return updated;
			});
			let customFieldDefs = prev.customFieldDefs;
			if (
				patch.name !== undefined &&
				previousName &&
				previousName !== patch.name
			) {
				customFieldDefs = {
					...prev.customFieldDefs,
					task: remapTaskShowWhenNames(
						prev.customFieldDefs.task ?? [],
						previousName,
						patch.name,
					),
				};
			}
			return { ...prev, taskTypes, customFieldDefs };
		});
	}, []);

	const addTaskType = useCallback(() => {
		setDraft((prev) => {
			if (!prev) return prev;
			const sortOrder = prev.taskTypes.length;
			return {
				...prev,
				taskTypes: [
					...prev.taskTypes,
					{
						name: '',
						slug: '',
						icon: 'CircleHelp',
						enabled: true,
						sortOrder,
						pluralName: '',
						trackingPageTemplate: defaultTrackingPageTemplate(''),
					},
				],
			};
		});
	}, []);

	const removeTaskType = useCallback((index: number) => {
		setDraft((prev) => {
			if (!prev) return prev;
			const removedName = prev.taskTypes[index]?.name;
			return {
				...prev,
				taskTypes: prev.taskTypes
					.filter((_, i) => i !== index)
					.map((t, i) => ({ ...t, sortOrder: i })),
				customFieldDefs: {
					...prev.customFieldDefs,
					task: remapTaskShowWhenNames(
						prev.customFieldDefs.task ?? [],
						removedName ?? '',
						null,
					),
				},
			};
		});
	}, []);

	const moveTaskType = useCallback((index: number, direction: -1 | 1) => {
		setDraft((prev) => {
			if (!prev) return prev;
			const next = [...prev.taskTypes];
			const target = index + direction;
			if (target < 0 || target >= next.length) return prev;
			[next[index], next[target]] = [next[target], next[index]];
			return {
				...prev,
				taskTypes: next.map((t, i) => ({ ...t, sortOrder: i })),
			};
		});
	}, []);

	const setEntityDefs = useCallback(
		(
			entity: CustomFieldEntity,
			fn: (defs: OrgCustomFieldDef[]) => OrgCustomFieldDef[],
		) => {
			setDraft((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					customFieldDefs: {
						...prev.customFieldDefs,
						[entity]: fn(prev.customFieldDefs[entity] ?? []),
					},
				};
			});
		},
		[],
	);

	const updateCustomField = useCallback(
		(
			entity: CustomFieldEntity,
			slot: number,
			patch: Partial<OrgCustomFieldDef>,
		) => {
			setEntityDefs(entity, (defs) =>
				defs.some((d) => d.slot === slot)
					? defs.map((d) => (d.slot === slot ? { ...d, ...patch } : d))
					: [...defs, { ...emptyCustomField(slot), ...patch }],
			);
		},
		[setEntityDefs],
	);

	const addCustomField = useCallback(
		(entity: CustomFieldEntity) => {
			setEntityDefs(entity, (defs) => [
				...defs,
				emptyCustomField(defs.reduce((max, d) => Math.max(max, d.slot), 0) + 1),
			]);
		},
		[setEntityDefs],
	);

	const removeCustomField = useCallback(
		(entity: CustomFieldEntity, slot: number) => {
			setEntityDefs(entity, (defs) => defs.filter((d) => d.slot !== slot));
		},
		[setEntityDefs],
	);

	const sortedAttachmentTypes = useCallback((defs: OrgAttachmentTypeDef[]) => {
		return [...defs].sort((a, b) => a.sortOrder - b.sortOrder);
	}, []);

	const updateAttachmentTypeDef = useCallback(
		(sortedIndex: number, patch: Partial<OrgAttachmentTypeDef>) => {
			setDraft((prev) => {
				if (!prev) return prev;
				const sorted = sortedAttachmentTypes(prev.attachmentTypeDefs);
				const target = sorted[sortedIndex];
				if (!target) return prev;
				return {
					...prev,
					attachmentTypeDefs: prev.attachmentTypeDefs.map((d) =>
						d === target ? { ...d, ...patch } : d,
					),
				};
			});
		},
		[sortedAttachmentTypes],
	);

	const addAttachmentTypeDef = useCallback(() => {
		setDraft((prev) => {
			if (!prev) return prev;
			const nextOrder = prev.attachmentTypeDefs.length;
			return {
				...prev,
				attachmentTypeDefs: [
					...prev.attachmentTypeDefs,
					{
						label: '',
						slug: '',
						allowedMimeCategories: ['image', 'video', 'pdf', 'other'],
						showWhen: null,
						sortOrder: nextOrder,
					},
				],
			};
		});
	}, []);

	const removeAttachmentTypeDef = useCallback(
		(sortedIndex: number) => {
			setDraft((prev) => {
				if (!prev) return prev;
				const sorted = sortedAttachmentTypes(prev.attachmentTypeDefs);
				const target = sorted[sortedIndex];
				if (!target) return prev;
				return {
					...prev,
					attachmentTypeDefs: prev.attachmentTypeDefs.filter(
						(d) => d !== target,
					),
				};
			});
		},
		[sortedAttachmentTypes],
	);

	const onSave = () => {
		void persistDraft();
	};

	if (userLoading) {
		return (
			<Box py='xl'>
				<Loader size='sm' />
			</Box>
		);
	}

	if (!hasPermission(user?.permissions, PERMISSIONS.manageOrg)) {
		return <Navigate to='/' replace />;
	}

	if (loading || !draft) {
		return (
			<Box py='xl'>
				<Loader size='sm' />
			</Box>
		);
	}

	const requiredCustomFields = labeledCustomFieldDefs(
		draft.customFieldDefs.task,
	);
	const configuredTaskTypeNames = draft.taskTypes.map((t) => t.name);

	return (
		<div className='field-management-page'>
			<PageHeader
				title='Management'
				right={
					<Button onClick={onSave} loading={saving}>
						Save changes
					</Button>
				}
			/>

			<div className='field-management-body'>
				<nav className='field-management-nav' aria-label='Management sections'>
					{MANAGEMENT_SECTIONS.map((section) => (
						<UnstyledButton
							key={section.id}
							type='button'
							className='field-management-nav-btn'
							data-active={activeSection === section.id || undefined}
							aria-current={activeSection === section.id ? 'page' : undefined}
							onClick={() => void requestSection(section.id)}
						>
							{section.label}
						</UnstyledButton>
					))}
				</nav>

				<div className='field-management-divider' aria-hidden='true' />

				<div className='field-management-content'>
					{activeSection === 'branding' ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Branding
							</Title>
							<Text size='sm' c='dimmed' mb='md'>
								Org logo and accent color for customer-facing surfaces. Status
								colors stay as they are.
							</Text>
							<Text size='sm' fw={500} mb={6}>
								Org logo
							</Text>
							<Group align='center' gap='md' mb='md' wrap='nowrap' style={{ background: '#fff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '48px' }}> 
								{loaded.logoUrl ? (
									<img
										src={orgLogoSrc(loaded.logoUrl) ?? ''}
										alt='Org logo preview'
										style={{
											display: 'block',
											maxHeight: 48,
											maxWidth: 160,
											objectFit: 'contain',
											border: '1px solid #ddd'
										}}
									/>
								) : (
									<Text size='sm' c='dimmed'>No logo uploaded</Text>
								)}
							</Group>
							<Group gap='sm' mb='lg'>
								<input
									ref={logoFileInputRef}
									type='file'
									accept='image/png,image/jpeg,image/webp,image/svg+xml'
									hidden
									onChange={(e) => {
										const file = e.target.files?.[0] ?? null;
										void onLogoFileSelected(file);
									}}
								/>
								<Button
									variant='light'
									size='compact-sm'
									loading={logoUploading}
									onClick={() => logoFileInputRef.current?.click()}
								>
									{loaded.logoUrl ? 'Replace logo' : 'Upload logo'}
								</Button>
								{loaded.logoUrl ? (
									<Button
										variant='subtle'
										size='compact-sm'
										color='red'
										loading={logoUploading}
										onClick={() => void onRemoveLogo()}
									>
										Remove
									</Button>
								) : null}
							</Group>
							<Switch
								label='High contrast mode'
								description='Show the sidebar logo row on a white background when your logo is hard to read on dark navigation.'
								checked={draft.logoHighContrast}
								onChange={(e) =>
									updateDraft({ logoHighContrast: e.currentTarget.checked })
								}
								mb='lg'
								color='brand'
							/>
							<ColorInput
								label='Accent color'
								format='hex'
								swatches={ACCENT_SWATCHES}
								value={draft.accentColor}
								onChange={(value) =>
									updateDraft({
										accentColor: value || UNSET_ACCENT,
									})
								}
								maw={240}
							/>
						</Box>
					) : null}

					{activeSection === 'external-key' ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								External key
							</Title>
							<Text size='sm' c='dimmed' mb='sm'>
								Column label for the external key field in the task grid and
								forms. Values are free-form text entered per task.
							</Text>
							<Stack gap='sm'>
								<TextInput
									label='Column label'
									value={draft.externalKeyLabel}
									onChange={(e) =>
										updateDraft({ externalKeyLabel: e.currentTarget.value })
									}
								/>
							</Stack>
						</Box>
					) : null}

					{activeSection === 'web-auth' ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Web sign-in
							</Title>
							<Text size='sm' c='dimmed' mb='sm'>
								How web users authenticate. Mobile crew use QR activation
								regardless. Entra changes apply on the next full page reload.
							</Text>
							<Stack gap='sm'>
								<Select
									label='Identity source'
									data={WEB_AUTH_SOURCE_OPTIONS}
									value={draft.webAuthSource}
									onChange={(v) =>
										updateDraft({
											webAuthSource: (v ?? 'env') as WebAuthSource,
										})
									}
									maw={400}
								/>
								{draft.webAuthSource === 'entra' ? (
									<>
										<TextInput
											label='Application (client) ID'
											value={draft.webAuthConfig.clientId}
											onChange={(e) =>
												updateDraft({
													webAuthConfig: {
														...draft.webAuthConfig,
														clientId: e.currentTarget.value,
													},
												})
											}
										/>
										<TextInput
											label='Directory (tenant) ID'
											value={draft.webAuthConfig.tenantId}
											onChange={(e) =>
												updateDraft({
													webAuthConfig: {
														...draft.webAuthConfig,
														tenantId: e.currentTarget.value,
													},
												})
											}
										/>
									</>
								) : null}
							</Stack>
						</Box>
					) : null}

					{activeSection === 'task-types' ? (
						<Box>
							<Group justify='space-between' mb='sm'>
								<Title order={4}>Task types</Title>
								<Button
									variant='light'
									leftSection={<Plus size={14} />}
									onClick={addTaskType}
								>
									Add type
								</Button>
							</Group>
							<Text size='sm' c='dimmed' mb='sm'>
								Changes apply to new tasks. Renaming or disabling retires the
								previous catalog row; existing tasks keep their assigned type.
							</Text>
							<SettingsGrid
								label='Task types'
								columns={TASK_TYPE_COLUMNS}
								onMove={moveTaskType}
								onRemove={removeTaskType}
								emptyMessage='No task types yet. Add one to get started.'
								rows={draft.taskTypes.map((taskType, index) => ({
									key:
										taskType.id != null
											? `type-id-${taskType.id}`
											: `type-new-${index}`,
									label: taskType.name || 'task type',
									cells: {
										enabled: (
											<Checkbox
												aria-label={`Enabled — ${taskType.name}`}
												checked={taskType.enabled}
												onChange={(e) =>
													updateTaskType(index, {
														enabled: e.currentTarget.checked,
													})
												}
											/>
										),
										name: (
											<TaskTypeNameCombobox
												value={taskType.name}
												usedNames={configuredTaskTypeNames}
												onNameChange={(name) =>
													updateTaskType(index, { name })
												}
												onPresetSelect={(preset) =>
													updateTaskType(index, {
														name: preset.name,
														pluralName: preset.pluralName,
														icon: preset.icon,
													})
												}
											/>
										),
										plural: (
											<TextInput
												aria-label={`Plural name — ${taskType.name}`}
												placeholder='Plural form'
												value={taskType.pluralName}
												onChange={(e) =>
													updateTaskType(index, {
														pluralName: e.currentTarget.value,
													})
												}
											/>
										),
										icon: (
											<OrgTaskIconPicker
												hideLabel
												value={taskType.icon}
												onChange={(icon) => updateTaskType(index, { icon })}
											/>
										),
									},
								}))}
							/>
						</Box>
					) : null}

					{activeSection === 'tracking-page' ? (
						<Box className='field-management-tracking-page'>
							<Group justify='space-between' align='flex-start' mb='xs' wrap='wrap'>
								<Title order={4}>Tracking page</Title>
								{activeTrackingPageTaskType ? (
									<Button
										variant='light'
										size='compact-sm'
										leftSection={<ExternalLink size={14} />}
										onClick={() =>
											openTrackingPagePreview({
												taskTypeName: activeTrackingPageTaskType.taskType.name,
												trackingPageTemplate:
													activeTrackingPageTaskType.taskType.trackingPageTemplate,
												accentColor: normalizeAccentHex(draft.accentColor),
												logoUrl: loaded.logoUrl,
											})
										}
									>
										Preview full page
									</Button>
								) : null}
							</Group>
							<Text size='sm' c='dimmed' mb='md'>
								Layout for customer tracking links ({'/t/:token'}). Each enabled
								task type has its own block list — add, reorder, and configure
								blocks below.
							</Text>
							{enabledTrackingPageTaskTypes.length === 0 ? (
								<Text size='sm' c='dimmed'>
									Add at least one enabled task type to configure a tracking page.
								</Text>
							) : (
								<>
									<Tabs
										value={String(
											Math.min(
												trackingPageTaskTypeIndex,
												enabledTrackingPageTaskTypes.length - 1,
											),
										)}
										onChange={(v) => setTrackingPageTaskTypeIndex(Number(v ?? 0))}
										mb='md'
									>
										<Tabs.List>
											{enabledTrackingPageTaskTypes.map(
												({ taskType, index }, tabIndex) => (
													<Tabs.Tab
														key={taskType.id ?? index}
														value={String(tabIndex)}
													>
														{taskType.name}
													</Tabs.Tab>
												),
											)}
										</Tabs.List>
									</Tabs>
									{activeTrackingPageTaskType ? (
										<TrackingPageBlockEditor
											taskTypeName={activeTrackingPageTaskType.taskType.name}
											value={activeTrackingPageTaskType.taskType.trackingPageTemplate}
											logoUrl={loaded.logoUrl}
											attachmentTypeDefs={draft.attachmentTypeDefs.map(
												(d) => ({
													slug: d.slug,
													label: d.label,
												}),
											)}
											onChange={(template) =>
												updateTaskTypeTrackingPageTemplate(
													activeTrackingPageTaskType.index,
													template,
												)
											}
										/>
									) : null}
								</>
							)}
						</Box>
					) : null}

					{activeSection === 'attachment-types' ? (
						<Box maw={900}>
							<AttachmentTypeDefsEditor
								defs={draft.attachmentTypeDefs}
								taskTypeNames={draft.taskTypes
									.filter((t) => t.enabled !== false && t.name.trim())
									.map((t) => t.name.trim())}
								onAdd={addAttachmentTypeDef}
								onRemove={removeAttachmentTypeDef}
								onUpdate={updateAttachmentTypeDef}
							/>
						</Box>
					) : null}

					{activeSection === 'custom-fields' ? (
						<Box>
							<Tabs
								value={customFieldEntity}
								onChange={(v) =>
									setCustomFieldEntity(
										(v as CustomFieldEntity) ?? CUSTOM_FIELD_ENTITIES.task,
									)
								}
								mb='md'
							>
								<Tabs.List>
									{ALL_CUSTOM_FIELD_ENTITIES.map((entity) => (
										<Tabs.Tab key={entity} value={entity}>
											{CUSTOM_FIELD_ENTITY_LABELS[entity]}
										</Tabs.Tab>
									))}
								</Tabs.List>
							</Tabs>
							<CustomFieldDefsEditor
								title={`${CUSTOM_FIELD_ENTITY_LABELS[customFieldEntity]} custom fields`}
								description={
									customFieldEntity === CUSTOM_FIELD_ENTITIES.task
										? 'Renames apply everywhere. New fields appear when editing tasks (Show when still applies). Data type changes apply per task only after someone edits that field. Deleted fields stay read-only on tasks that still have a value — use Remove from task to clear them.'
										: 'Applies immediately to every record — these are living records, so edits always use the current definitions.'
								}
								defs={draft.customFieldDefs[customFieldEntity] ?? []}
								taskTypeNames={
									customFieldEntity === CUSTOM_FIELD_ENTITIES.task
										? draft.taskTypes
												.filter((t) => t.enabled !== false && t.name.trim())
												.map((t) => t.name.trim())
										: undefined
								}
								onAdd={() => addCustomField(customFieldEntity)}
								onRemove={(slot) => removeCustomField(customFieldEntity, slot)}
								onUpdate={(slot, patch) =>
									updateCustomField(customFieldEntity, slot, patch)
								}
							/>
						</Box>
					) : null}

					{activeSection === 'required-fields' ? (
						<Box maw={560}>
							<Title order={4} mb='xs'>
								Required fields
							</Title>
							<Text size='sm' c='dimmed' mb='sm'>
								Checked fields must be filled when creating or editing a
								task.
							</Text>
							<Stack gap='lg'>
								<Stack gap='xs'>
									<Title order={5}>Task form</Title>
									{ALL_REQUIRED_TASK_FIELDS.map((key) => (
										<Checkbox
											key={key}
											label={requiredTaskFieldLabel(key, {
												externalKeyLabel: draft.externalKeyLabel,
											})}
											checked={isTaskFieldRequired(
												draft.requiredTaskFields,
												key,
											)}
											onChange={(e) => {
												const checked = e.currentTarget.checked;
												setDraft((prev) => {
													if (!prev) return prev;
													const next = checked
														? prev.requiredTaskFields.includes(key)
															? prev.requiredTaskFields
															: [...prev.requiredTaskFields, key]
														: prev.requiredTaskFields.filter((k) => k !== key);
													return { ...prev, requiredTaskFields: next };
												});
											}}
										/>
									))}
								</Stack>
								<Stack gap='xs'>
									<Title order={5}>Custom fields</Title>
									{requiredCustomFields.length === 0 ? (
										<Text size='sm' c='dimmed'>
											No custom fields defined.
										</Text>
									) : (
										requiredCustomFields.map((def) => (
											<Checkbox
												key={`custom-${def.slot}`}
												label={def.label.trim()}
												checked={def.required}
												onChange={(e) =>
													updateCustomField(
														CUSTOM_FIELD_ENTITIES.task,
														def.slot,
														{ required: e.currentTarget.checked },
													)
												}
											/>
										))
									)}
								</Stack>
							</Stack>
						</Box>
					) : null}

					{activeSection === 'cancel-retention' ? (
						<Box maw={560}>
							<Title order={4} mb='sm'>
								Cancel retention
							</Title>
							<Text size='sm' c='dimmed' mb='sm'>
								How long cancelled tasks stay visible before archival.
							</Text>
							<Select
								label='Retention'
								data={RETENTION_OPTIONS}
								value={
									draft.cancelRetentionDays == null
										? 'never'
										: String(draft.cancelRetentionDays)
								}
								onChange={(v) =>
									updateDraft({
										cancelRetentionDays:
											v == null || v === 'never' ? null : Number(v),
									})
								}
								maw={240}
							/>
						</Box>
					) : null}

					{activeSection === 'import-export' ? (
						<ManagementImportExportSection />
					) : null}
				</div>
			</div>
		</div>
	);
}
