import { useCallback, useMemo, useRef, useState } from 'react';
import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	SegmentedControl,
	Stack,
	Table,
	Text,
	Title,
} from '@mantine/core';
import { Download, ExternalLink, Upload } from 'lucide-react';
import {
	IMPORT_COLUMNS,
	IMPORT_CUSTOM_FIELD_ENTITY,
	IMPORT_ENTITY_LABELS,
	customFieldImportColumns,
	importColumnsForMode,
} from '../../shared/importColumns.js';
import {
	getImportGoogleSheetUrl,
	parseImportGoogleSheets,
} from '../../shared/importGoogleSheets.js';
import {
	applyImport,
	downloadImportCsv,
	previewImport,
	type ImportApplyRow,
	type ImportEntity,
	type ImportMode,
	type ImportPreviewResult,
	type ImportPreviewRow,
} from '../api/import';
import { useCurrentUser } from '../context/CurrentUserContext';
import { notifyError, notifySuccess } from '../notify';
import { useEntityCustomFieldDefs } from './CustomFieldControl';

const ENTITIES: ImportEntity[] = ['contacts', 'addresses', 'users'];

const STATUS_COLORS: Record<ImportPreviewRow['status'], string> = {
	new: 'green',
	update: 'blue',
	conflict: 'yellow',
	error: 'red',
};

const BUILTIN_FIELD_LABELS: Record<ImportEntity, Record<string, string>> = {
	contacts: Object.fromEntries(
		IMPORT_COLUMNS.contacts.map((c) => [c.key, c.header]),
	),
	addresses: Object.fromEntries(
		IMPORT_COLUMNS.addresses.map((c) => [c.key, c.header]),
	),
	users: Object.fromEntries(
		IMPORT_COLUMNS.users.map((c) => [c.key, c.header]),
	),
};

const BUILTIN_FIELD_KEYS: Record<ImportEntity, string[]> = {
	contacts: ['name', 'title', 'phone', 'email'],
	addresses: [
		'addressName',
		'street',
		'city',
		'state',
		'postalCode',
		'building',
		'notes',
	],
	users: [
		'displayName',
		'email',
		'phone',
		'role',
		'manageUsers',
		'manageOrg',
		'viewCrewMap',
	],
};

type ResolutionMap = Record<number, Record<string, 'imported' | 'existing'>>;

function initResolutions(rows: ImportPreviewRow[]): ResolutionMap {
	const out: ResolutionMap = {};
	for (const row of rows) {
		if (row.status !== 'conflict' || !row.existing) continue;
		const keys = Object.keys(row.imported).filter(
			(k) => row.existing && row.imported[k] !== row.existing[k],
		);
		out[row.rowIndex] = Object.fromEntries(
			keys.map((k) => [k, 'imported' as const]),
		);
	}
	return out;
}

const USER_PERMISSION_BOOLEAN_HELP =
	'TRUE, FALSE, T, F, Y, or N (any case). Empty cells are treated as FALSE.';

const REQUIRED_CUSTOM_FIELD_HELP =
	'Required in the app — a blank cell imports as undefined and must be filled in before the record can be saved again.';

export function ManagementImportExportSection() {
	const { user } = useCurrentUser();
	const fileRef = useRef<HTMLInputElement>(null);
	const [entity, setEntity] = useState<ImportEntity>('contacts');
	const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
	const [resolutions, setResolutions] = useState<ResolutionMap>({});
	const [loading, setLoading] = useState(false);
	const [applying, setApplying] = useState(false);
	const [applyResult, setApplyResult] = useState<{
		created: number;
		updated: number;
		errors: string[];
	} | null>(null);

	const customFieldDefs = useEntityCustomFieldDefs(
		IMPORT_CUSTOM_FIELD_ENTITY[entity],
	);

	const columns = useMemo(
		() => importColumnsForMode(entity, 'template', customFieldDefs),
		[entity, customFieldDefs],
	);
	const fieldKeys = useMemo(
		() => [
			...BUILTIN_FIELD_KEYS[entity],
			...customFieldImportColumns(customFieldDefs).map((c) => c.key),
		],
		[entity, customFieldDefs],
	);
	const labels = useMemo(
		() => ({
			...BUILTIN_FIELD_LABELS[entity],
			...Object.fromEntries(
				customFieldImportColumns(customFieldDefs).map((c) => [
					c.key,
					c.header,
				]),
			),
		}),
		[entity, customFieldDefs],
	);
	const requiredCustomFieldKeys = useMemo(
		() =>
			new Set(
				customFieldImportColumns(
					customFieldDefs.filter((def) => def.required),
				).map((c) => c.key),
			),
		[customFieldDefs],
	);

	const conflictRows = useMemo(
		() => preview?.rows.filter((r) => r.status === 'conflict') ?? [],
		[preview],
	);

	const googleSheets = useMemo(
		() =>
			parseImportGoogleSheets(import.meta.env.VITE_IMPORT_GOOGLE_SHEETS),
		[],
	);
	const googleSheetUrl = getImportGoogleSheetUrl(entity, googleSheets);

	const onDownload = async (mode: ImportMode) => {
		try {
			await downloadImportCsv(entity, mode, user?.id);
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Download failed');
		}
	};

	const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		if (!file.name.toLowerCase().endsWith('.csv')) {
			notifyError('Only .csv files are accepted');
			return;
		}
		setLoading(true);
		setApplyResult(null);
		try {
			const result = await previewImport(entity, file, user?.id);
			setPreview(result);
			setResolutions(initResolutions(result.rows));
		} catch (err: unknown) {
			setPreview(null);
			setResolutions({});
			notifyError(err instanceof Error ? err.message : 'Preview failed');
		} finally {
			setLoading(false);
		}
	};

	const setFieldResolution = useCallback(
		(rowIndex: number, field: string, source: 'imported' | 'existing') => {
			setResolutions((prev) => ({
				...prev,
				[rowIndex]: { ...prev[rowIndex], [field]: source },
			}));
		},
		[],
	);

	const setRowResolutionBulk = useCallback(
		(rowIndex: number, source: 'imported' | 'existing', fields: string[]) => {
			setResolutions((prev) => ({
				...prev,
				[rowIndex]: Object.fromEntries(fields.map((f) => [f, source])),
			}));
		},
		[],
	);

	const onApply = async () => {
		if (!preview) return;
		setApplying(true);
		setApplyResult(null);
		try {
			const applyRows: ImportApplyRow[] = preview.rows
				.filter((r) => r.status !== 'error')
				.map((r) => ({
					rowIndex: r.rowIndex,
					status: r.status,
					imported: r.imported,
					existing: r.existing,
					matchId: r.matchId,
					resolution:
						r.status === 'conflict' ? resolutions[r.rowIndex] : undefined,
				}));
			const result = await applyImport(entity, applyRows, user?.id);
			setApplyResult(result);
			if (result.errors.length === 0) {
				setPreview(null);
				setResolutions({});
				notifySuccess(
					`Import complete: ${result.created} created, ${result.updated} updated.`,
				);
			}
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Apply failed');
		} finally {
			setApplying(false);
		}
	};

	const canApply =
		preview != null &&
		preview.summary.error < preview.rows.length &&
		(preview.summary.new > 0 ||
			preview.summary.update > 0 ||
			preview.summary.conflict > 0);

	return (
		<Box className='field-import-export' maw={560}>
			<Title order={4} mb='xs'>
				Import / export
			</Title>
			<Text size='sm' c='dimmed' mb='md'>
				Import requires a CSV file. Download a template below, or use Google
				Sheets in your browser (no install), then download as CSV and upload
				here to preview changes before applying.
			</Text>

			<SegmentedControl
				value={entity}
				onChange={(v) => {
					setEntity(v as ImportEntity);
					setPreview(null);
					setResolutions({});
					setApplyResult(null);
				}}
				data={ENTITIES.map((e) => ({
					value: e,
					label: IMPORT_ENTITY_LABELS[e],
				}))}
				mb='lg'
			/>

			<Stack gap='lg'>
				<Stack gap='xs' className='field-import-help'>
					<Title order={5}>
						Column reference — {IMPORT_ENTITY_LABELS[entity]}
					</Title>
					<div className='field-import-table-scroll'>
						<Table striped withTableBorder layout='fixed' mb='sm'>
							<Table.Thead>
								<Table.Tr>
									<Table.Th w='35%'>Column</Table.Th>
									<Table.Th>Notes</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{columns.map((col) => (
									<Table.Tr key={col.key}>
										<Table.Td>
											<Text size='sm' fw={500}>
												{col.header}
											</Text>
										</Table.Td>
										<Table.Td>
											<Text size='sm' c='dimmed'>
												{requiredCustomFieldKeys.has(col.key)
													? REQUIRED_CUSTOM_FIELD_HELP
													: col.required
														? 'Required'
														: 'Optional'}
												{entity === 'users' &&
												(col.key === 'manageUsers' ||
													col.key === 'manageOrg' ||
													col.key === 'viewCrewMap')
													? ` — ${USER_PERMISSION_BOOLEAN_HELP}`
													: ''}
											</Text>
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</div>
					{entity === 'users' ? (
						<Text size='sm' c='dimmed'>
							Permission columns accept {USER_PERMISSION_BOOLEAN_HELP}
						</Text>
					) : null}
					<Text size='sm' c='dimmed'>
						Sample files use fictional <code>@example.com</code> addresses.
						Export current includes an <code>Id</code> column for updating
						existing records.
					</Text>
				</Stack>

				<Stack gap='xs'>
					<Title order={5}>Download</Title>
					<Stack gap='xs' align='flex-start'>
						<Button
							variant='light'
							leftSection={<Download size={14} />}
							onClick={() => onDownload('blank')}
						>
							Blank template
						</Button>
						<Button
							variant='light'
							leftSection={<Download size={14} />}
							onClick={() => onDownload('sample')}
						>
							Sample (10 rows)
						</Button>
						<Button
							variant='light'
							leftSection={<Download size={14} />}
							onClick={() => onDownload('current')}
						>
							Export current
						</Button>
					</Stack>
					{googleSheetUrl ? (
						<Stack gap='xs' mt='md'>
							<Title order={5}>Edit in Google Sheets</Title>
							<Text size='sm' c='dimmed'>
								Open a copy in your browser — no spreadsheet software required.
								When finished, download as CSV and upload below.
							</Text>
							<Button
								component='a'
								href={googleSheetUrl}
								target='_blank'
								rel='noopener noreferrer'
								variant='light'
								leftSection={<ExternalLink size={14} />}
							>
								Open workbook (Template + Sample tabs)
							</Button>
							<Text size='sm' c='dimmed'>
								1. Click the link, then <strong>Make a copy</strong>
								<br />
								2. Edit the <strong>Template</strong> or <strong>Sample</strong>{' '}
								tab
								<br />
								3. <strong>File → Download → Comma Separated Values (.csv)</strong>
								<br />
								4. Upload the CSV in the section below
							</Text>
							{entity === 'users' ? (
								<Text size='sm' c='dimmed'>
									Do not rename the header row. Permission columns:{' '}
									{USER_PERMISSION_BOOLEAN_HELP}
								</Text>
							) : (
								<Text size='sm' c='dimmed'>
									Do not rename the header row.
								</Text>
							)}
						</Stack>
					) : null}
				</Stack>

				<Stack gap='xs'>
					<Title order={5}>Upload</Title>
					<input
						ref={fileRef}
						type='file'
						accept='.csv,text/csv'
						className='field-import-file-input'
						onChange={onFileChange}
					/>
					<Button
						variant='default'
						leftSection={<Upload size={14} />}
						loading={loading}
						onClick={() => fileRef.current?.click()}
					>
						Choose CSV file
					</Button>
				</Stack>
			</Stack>

			{applyResult ? (
				<Alert
					color={applyResult.errors.length > 0 ? 'yellow' : 'green'}
					mt='md'
				>
					{applyResult.errors.length === 0 ? (
						<Text size='sm'>
							Import complete: {applyResult.created} created,{' '}
							{applyResult.updated} updated.
						</Text>
					) : (
						<Stack gap='xs'>
							<Text size='sm'>
								Partial import: {applyResult.created} created,{' '}
								{applyResult.updated} updated.
							</Text>
							{applyResult.errors.map((msg) => (
								<Text key={msg} size='sm'>
									{msg}
								</Text>
							))}
						</Stack>
					)}
				</Alert>
			) : null}

			{preview ? (
				<Stack gap='md' mt='md'>
					<Group gap='sm'>
						<Badge color='green' variant='light'>
							{preview.summary.new} new
						</Badge>
						<Badge color='blue' variant='light'>
							{preview.summary.update} update
						</Badge>
						<Badge color='yellow' variant='light'>
							{preview.summary.conflict} conflict
						</Badge>
						<Badge color='red' variant='light'>
							{preview.summary.error} error
						</Badge>
					</Group>

					<div className='field-import-table-scroll'>
						<Table striped withTableBorder layout='fixed'>
							<Table.Thead>
								<Table.Tr>
									<Table.Th w={56}>Row</Table.Th>
									<Table.Th w={100}>Status</Table.Th>
									<Table.Th>Summary</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{preview.rows.map((row) => (
									<Table.Tr key={row.rowIndex}>
										<Table.Td>{row.rowIndex}</Table.Td>
										<Table.Td>
											<Badge
												color={STATUS_COLORS[row.status]}
												variant='light'
												size='sm'
											>
												{row.status}
											</Badge>
										</Table.Td>
										<Table.Td>
											{row.status === 'error' ? (
												<Text size='sm' c='red'>
													{row.errors?.join('; ')}
												</Text>
											) : (
												<Text size='sm'>
													{row.imported.name ??
														row.imported.displayName ??
														row.imported.addressName ??
														row.imported.email ??
														'—'}
												</Text>
											)}
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</div>

					{conflictRows.length > 0 ? (
						<Stack gap='md'>
							<Box>
								<Title order={5} mb={4}>
									Resolve conflicts
								</Title>
								<Text size='sm' c='dimmed'>
									Blank id rows matched an existing record. Choose which value to
									keep for each field.
								</Text>
							</Box>
							{conflictRows.map((row) => {
								const diffFields = fieldKeys.filter(
									(k) =>
										row.existing &&
										row.imported[k] !== row.existing[k],
								);
								return (
									<Box
										key={row.rowIndex}
										className='field-import-conflict-card'
									>
										<Group justify='space-between' mb='sm' wrap='wrap'>
											<Text size='sm' fw={600}>
												Row {row.rowIndex}
											</Text>
											<Group gap='xs'>
												<Button
													variant='light'
													onClick={() =>
														setRowResolutionBulk(
															row.rowIndex,
															'imported',
															diffFields,
														)
													}
												>
													Use all imported
												</Button>
												<Button
													variant='light'
													onClick={() =>
														setRowResolutionBulk(
															row.rowIndex,
															'existing',
															diffFields,
														)
													}
												>
													Keep all existing
												</Button>
											</Group>
										</Group>
										{diffFields.map((field) => {
											const chosen =
												resolutions[row.rowIndex]?.[field] ?? 'imported';
											return (
												<Stack
													key={field}
													gap='xs'
													className='field-import-conflict-field'
												>
													<Text size='sm' fw={600}>
														{labels[field] ?? field}
													</Text>
													<Text size='sm'>
														Imported: {row.imported[field] || '—'}
													</Text>
													<Text size='sm' c='dimmed'>
														Existing: {row.existing?.[field] || '—'}
													</Text>
													<SegmentedControl
														size='xs'
														value={chosen}
														onChange={(v) =>
															setFieldResolution(
																row.rowIndex,
																field,
																v as 'imported' | 'existing',
															)
														}
														data={[
															{ value: 'imported', label: 'Imported' },
															{ value: 'existing', label: 'Existing' },
														]}
													/>
												</Stack>
											);
										})}
									</Box>
								);
							})}
						</Stack>
					) : null}

					<Group>
						<Button
							onClick={onApply}
							loading={applying}
							disabled={!canApply}
						>
							Apply import
						</Button>
						<Button
							variant='subtle'
							onClick={() => {
								setPreview(null);
								setResolutions({});
							}}
						>
							Clear preview
						</Button>
					</Group>
				</Stack>
			) : null}
		</Box>
	);
}
