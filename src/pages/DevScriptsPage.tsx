import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
	Alert,
	Box,
	Button,
	Group,
	Loader,
	Stack,
	Text,
	Textarea,
	TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { ColDef, GridApi, RowClickedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { Play, Plus, RotateCcw, Save, Square, Trash2 } from 'lucide-react';
import {
	deleteNpmScript,
	listNpmScripts,
	saveNpmScript,
	type NpmScriptDescriptionsMap,
	type NpmScriptsMap,
} from '../api/devScripts';
import { NpmScriptRunOutput } from '../components/dev/NpmScriptRunOutput';
import { PageHeader } from '../components/PageHeader';
import { useNpmScriptRun } from '../hooks/useNpmScriptRun';
import { AgGridLayoutControls } from '../components/AgGridLayoutControls';
import { useAlert } from '../context/AlertContext';
import {
	AG_GRID_MOBILE_MQ,
	buildEntityGridColumnDefs,
	DEV_SCRIPTS_COLUMN_OPTIONS,
	DEV_SCRIPTS_GRID_COLUMNS_STORAGE_KEY,
	getDefaultColDef,
	useAdaptiveGridLayout,
	useBandedColumnWidthSaveBridge,
	useEntityGridColumnPicker,
	usePersistedAgGridSession,
} from '../agGridDefaults';
import { useGridForceFullWidth } from '../agGridLayoutPrefs';

type ScriptRow = {
	name: string;
	command: string;
	description: string;
	category: string;
};

const DESTRUCTIVE_SCRIPTS = new Set([
	'db:reset',
	'db:wipe-tasks',
	'db:purge-cancelled',
	'dev:stop',
]);

function categoryFromName(name: string): string {
	const idx = name.indexOf(':');
	return idx === -1 ? 'other' : name.slice(0, idx);
}

function scriptsToRows(
	scripts: NpmScriptsMap,
	descriptions: NpmScriptDescriptionsMap,
): ScriptRow[] {
	return Object.entries(scripts)
		.map(([name, command]) => ({
			name,
			command,
			description: descriptions[name] ?? '',
			category: categoryFromName(name),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function DevScriptsPage() {
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const { confirm } = useAlert();
	const [scripts, setScripts] = useState<NpmScriptsMap>({});
	const [descriptions, setDescriptions] = useState<NpmScriptDescriptionsMap>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<string>('all');
	const [selectedName, setSelectedName] = useState<string | null>(null);
	const [draftName, setDraftName] = useState('');
	const [draftCommand, setDraftCommand] = useState('');
	const [draftDescription, setDraftDescription] = useState('');
	const [saving, setSaving] = useState(false);
	const [isNew, setIsNew] = useState(false);
	const {
		running,
		runId,
		output,
		exitCode,
		runError,
		setRunError,
		outputRef,
		startRun,
		stopRun,
	} = useNpmScriptRun();

	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);
	const [forceFullWidth, setForceFullWidth] = useGridForceFullWidth();
	const { userWidthsSaveRef, onUserColumnWidthsSettled } =
		useBandedColumnWidthSaveBridge();
	const adaptiveLayout = useAdaptiveGridLayout(!isMobile, {
		forceFullWidth,
		onUserColumnWidthsSettled,
	});
	const {
		visibleColumns,
		toggleColumn,
		builtinColumnOptions,
		customColumnOptions,
		columnVisibility,
	} = useEntityGridColumnPicker(
		DEV_SCRIPTS_GRID_COLUMNS_STORAGE_KEY,
		DEV_SCRIPTS_COLUMN_OPTIONS,
		[],
	);

	const gridSession = usePersistedAgGridSession(
		'dev-scripts',
		!isMobile,
		adaptiveLayout,
		columnVisibility,
		userWidthsSaveRef,
	);

	const rows = useMemo(
		() => scriptsToRows(scripts, descriptions),
		[scripts, descriptions],
	);

	const categories = useMemo(() => {
		const counts = new Map<string, number>();
		for (const row of rows) {
			counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
		}
		return [...counts.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([value, count]) => ({ value, count }));
	}, [rows]);

	const rowData = useMemo(() => {
		if (category === 'all') return rows;
		return rows.filter((row) => row.category === category);
	}, [rows, category]);

	const baseColumnDefs = useMemo<ColDef<ScriptRow>[]>(
		() => [
			{
				field: 'name',
				headerName: 'Script',
				minWidth: 140,
			},
			{
				field: 'description',
				headerName: 'Description',
				minWidth: 220,
				wrapText: true,
				autoHeight: true,
				tooltipField: 'description',
			},
			{
				field: 'command',
				headerName: 'Command',
				minWidth: 160,
				wrapText: true,
				autoHeight: true,
				tooltipField: 'command',
			},
		],
		[],
	);

	const columnDefs = useMemo(
		() =>
			buildEntityGridColumnDefs(
				baseColumnDefs,
				[],
				visibleColumns,
				DEV_SCRIPTS_COLUMN_OPTIONS,
			),
		[baseColumnDefs, visibleColumns],
	);

	const refreshScripts = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		setError(null);
		try {
			const next = await listNpmScripts(signal);
			if (!signal?.aborted) {
				setScripts(next.scripts);
				setDescriptions(next.descriptions);
			}
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			setError(err instanceof Error ? err.message : 'Failed to load scripts');
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void refreshScripts(controller.signal);
		return () => controller.abort();
	}, [refreshScripts]);

	const selectScript = useCallback(
		(name: string, command: string, description: string) => {
			setIsNew(false);
			setSelectedName(name);
			setDraftName(name);
			setDraftCommand(command);
			setDraftDescription(description);
		},
		[],
	);

	const onRowClicked = useCallback(
		(event: RowClickedEvent<ScriptRow>) => {
			const row = event.data;
			if (!row) return;
			selectScript(row.name, row.command, row.description);
		},
		[selectScript],
	);

	const gridApiRef = useRef<GridApi | null>(null);

	useEffect(() => {
		const api = gridApiRef.current;
		if (!api || isMobile) return;
		adaptiveLayout.apply(api, {
			debugReason: `forceFullWidth-toggle:${forceFullWidth}`,
		});
	}, [forceFullWidth, isMobile, adaptiveLayout.apply]);

	useEffect(() => {
		gridSession.onColumnDefsChanged(gridApiRef.current);
	}, [visibleColumns, gridSession.onColumnDefsChanged]);

	const startNewScript = useCallback(() => {
		setIsNew(true);
		setSelectedName(null);
		setDraftName('');
		setDraftCommand('');
		setDraftDescription('');
	}, []);

	const handleSave = useCallback(async () => {
		const name = draftName.trim();
		const command = draftCommand.trim();
		if (!name || !command) return;

		setSaving(true);
		setError(null);
		try {
			const next = await saveNpmScript(name, command, draftDescription.trim());
			setScripts(next.scripts);
			setDescriptions(next.descriptions);
			setIsNew(false);
			setSelectedName(name);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to save script');
		} finally {
			setSaving(false);
		}
	}, [draftName, draftCommand, draftDescription]);

	const handleDelete = useCallback(async () => {
		const name = selectedName?.trim();
		if (!name) return;
		if (
			!(await confirm(`Remove "${name}" from package.json?`, {
				confirmLabel: 'Delete',
				danger: true,
			}))
		) {
			return;
		}

		setSaving(true);
		setError(null);
		try {
			const next = await deleteNpmScript(name);
			setScripts(next.scripts);
			setDescriptions(next.descriptions);
			setSelectedName(null);
			setDraftName('');
			setDraftCommand('');
			setDraftDescription('');
			setIsNew(false);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to delete script');
		} finally {
			setSaving(false);
		}
	}, [selectedName, confirm]);

	const handleRun = useCallback(async () => {
		const name = draftName.trim();
		const command = draftCommand.trim();
		if (!name && !command) return;

		const scriptKey = isNew ? '' : name;
		if (
			scriptKey &&
			DESTRUCTIVE_SCRIPTS.has(scriptKey) &&
			!(await confirm(
				`"${scriptKey}" can change or delete local data. Continue?`,
				{ confirmLabel: 'Run', danger: true },
			))
		) {
			return;
		}

		setError(null);
		setRunError(null);

		const original = selectedName ? scripts[selectedName] : undefined;
		const useCustomCommand =
			command.length > 0 && command !== (original ?? '');
		await startRun(useCustomCommand ? { command } : { name });
	}, [
		draftName,
		draftCommand,
		isNew,
		selectedName,
		scripts,
		confirm,
		startRun,
		setRunError,
	]);

	const dirty =
		isNew ||
		(selectedName != null &&
			(draftName.trim() !== selectedName ||
				draftCommand.trim() !== (scripts[selectedName] ?? '') ||
				draftDescription.trim() !== (descriptions[selectedName] ?? '')));

	if (!import.meta.env.DEV) {
		return <Navigate to='/' replace />;
	}

	return (
		<Box className='tasks-page'>
			<PageHeader
				title={
					loading && rows.length === 0
						? 'NPM scripts'
						: `NPM scripts (${rows.length})`
				}
				right={
					<Group gap='xs'>
						{!isMobile ? (
							<AgGridLayoutControls
								forceFullWidth={forceFullWidth}
								onToggleForceFullWidth={() =>
									setForceFullWidth(!forceFullWidth)
								}
								columnOptions={{
									builtin: builtinColumnOptions,
									custom: customColumnOptions,
									visibleColumns,
									onToggleColumn: toggleColumn,
								}}
							/>
						) : null}
						<Button
							variant='light'
							leftSection={<Plus size={14} />}
							onClick={startNewScript}
						>
							New
						</Button>
						<Button
							variant='light'
							leftSection={<RotateCcw size={14} />}
							onClick={() => void refreshScripts()}
							loading={loading && rows.length > 0}
						>
							Refresh
						</Button>
					</Group>
				}
			/>

			<Text size='sm' c='dimmed' mb='md' maw={560}>
				View, edit, and run scripts from <code>package.json</code>. Descriptions
				are stored in <code>scripts/npm-script-descriptions.json</code>. Output
				streams live from the dev server.
			</Text>

			{error || runError ? (
				<Alert color='red' title='Error' mb='md'>
					{error ?? runError}
				</Alert>
			) : null}

			{categories.length > 0 ? (
				<div
					className='dev-tests-categories'
					role='tablist'
					aria-label='Filter scripts by category'
				>
					<button
						type='button'
						role='tab'
						aria-selected={category === 'all'}
						className='dev-tests-category-button'
						data-selected={category === 'all' || undefined}
						onClick={() => setCategory('all')}
					>
						All ({rows.length})
					</button>
					{categories.map((entry) => {
						const selected = category === entry.value;
						return (
							<button
								key={entry.value}
								type='button'
								role='tab'
								aria-selected={selected}
								className='dev-tests-category-button'
								data-selected={selected || undefined}
								onClick={() => setCategory(entry.value)}
							>
								{entry.value} ({entry.count})
							</button>
						);
					})}
				</div>
			) : null}

			<Box maw={400} mb='sm'>
				<TextInput
					placeholder='Filter scripts'
					value={query}
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
			</Box>

			<Box ref={adaptiveLayout.shellRef} className='tasks-grid-shell' mb='md'>
				<Box
					ref={adaptiveLayout.wrapRef}
					className='tasks-grid-wrap ag-theme-quartz'
					data-layout={adaptiveLayout.layoutMode}
				>
				{loading && rows.length === 0 ? (
					<Group justify='center' py='xl'>
						<Loader size='sm' />
					</Group>
				) : (
					<AgGridProvider modules={[AllCommunityModule]}>
						<AgGridReact<ScriptRow>
							rowData={rowData}
							columnDefs={columnDefs}
							defaultColDef={defaultColDef}
							initialState={gridSession.initialState}
							getRowId={(p) => p.data.name}
							quickFilterText={query}
							onRowClicked={onRowClicked}
							rowSelection={{
								mode: 'singleRow',
								checkboxes: false,
								enableClickSelection: true,
							}}
							animateRows
							suppressCellFocus
							suppressHorizontalScroll
							onGridReady={(e) => {
								gridApiRef.current = e.api;
								gridSession.onGridReady(e);
							}}
							onGridSizeChanged={gridSession.onGridSizeChanged}
							onFirstDataRendered={gridSession.onFirstDataRendered}
							onSortChanged={gridSession.onSortChanged}
							onFilterChanged={gridSession.onFilterChanged}
							onColumnResized={gridSession.onColumnResized}
						/>
					</AgGridProvider>
				)}
				</Box>
			</Box>

			{(selectedName != null || isNew) && (
				<Box maw={720} mb='md'>
					<Stack gap='sm'>
						<Text fw={600}>
							{isNew ? 'New script' : `Edit: ${selectedName}`}
						</Text>
						<TextInput
							label='Name'
							placeholder='db:my-script'
							value={draftName}
							onChange={(event) => setDraftName(event.currentTarget.value)}
							disabled={!isNew && selectedName != null}
						/>
						<Textarea
							label='Description'
							placeholder='What this script does'
							value={draftDescription}
							onChange={(event) =>
								setDraftDescription(event.currentTarget.value)
							}
							minRows={2}
							autosize
						/>
						<Textarea
							label='Command'
							placeholder='node scripts/example.mjs'
							value={draftCommand}
							onChange={(event) => setDraftCommand(event.currentTarget.value)}
							minRows={3}
							autosize
						/>
						<Group>
							<Button
								leftSection={<Save size={14} />}
								onClick={() => void handleSave()}
								loading={saving}
								disabled={!dirty || !draftName.trim() || !draftCommand.trim()}
							>
								Save to package.json
							</Button>
							<Button
								variant='light'
								color='green'
								leftSection={<Play size={14} />}
								onClick={() => void handleRun()}
								loading={running}
								disabled={!draftName.trim() && !draftCommand.trim()}
							>
								Run
							</Button>
							{running && runId ? (
								<Button
									variant='light'
									color='red'
									leftSection={<Square size={14} />}
									onClick={() => void stopRun()}
								>
									Stop
								</Button>
							) : null}
							{!isNew && selectedName ? (
								<Button
									variant='subtle'
									color='red'
									leftSection={<Trash2 size={14} />}
									onClick={() => void handleDelete()}
									loading={saving}
								>
									Delete
								</Button>
							) : null}
						</Group>
					</Stack>
				</Box>
			)}

			<NpmScriptRunOutput
				output={output}
				running={running}
				exitCode={exitCode}
				outputRef={outputRef}
			/>
		</Box>
	);
}
