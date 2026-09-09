import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
	Box,
	Button,
	Group,
	Loader,
	ScrollArea,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	TextInput,
} from '@mantine/core';
import { Eye, Plus, Save } from 'lucide-react';
import { listDocumentTypes } from '../../shared/documentTypes.js';
import { getTask } from '../api/tasks';
import {
	fetchDevPrintTemplate,
	listDevPrintTemplateTags,
	listDevPrintTemplates,
	previewDevPrintTemplate,
	saveDevPrintTemplate,
	SAMPLE_PREVIEW_TASK,
	type DevPrintTemplateSummary,
} from '../api/devPrintTemplates';
import { PageHeader } from '../components/PageHeader';
import { NewPrintTemplateModal } from '../components/NewPrintTemplateModal';
import { RelativeTime } from '../components/RelativeTime';

function formatJson(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function shortHash(hash: string): string {
	if (hash.length <= 12) return hash;
	return `${hash.slice(0, 8)}…`;
}

export function DevDocumentTemplatesPage() {
	const documentTypeOptions = useMemo(
		() =>
			listDocumentTypes().map((t) => ({
				value: t.key,
				label: t.label,
			})),
		[],
	);

	const [templates, setTemplates] = useState<DevPrintTemplateSummary[]>([]);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [selectedSummary, setSelectedSummary] =
		useState<DevPrintTemplateSummary | null>(null);
	const [jsonText, setJsonText] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [taskIdInput, setTaskIdInput] = useState('');
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [orgFilter, setOrgFilter] = useState('1');
	const [documentTypeFilter, setDocumentTypeFilter] = useState<string | null>(
		null,
	);
	const [contextFilter, setContextFilter] = useState<string | null>(null);
	const [nameFilter, setNameFilter] = useState('');
	const [createModalOpen, setCreateModalOpen] = useState(false);

	const tagOptions = useMemo(
		() => tags.map((tag) => ({ value: tag, label: tag })),
		[tags],
	);

	const parsedMeta = useMemo(() => {
		try {
			const t = JSON.parse(jsonText) as {
				context?: string;
				surfaces?: { taskMenu?: boolean };
				persist?: boolean;
				requiresStatus?: string | null;
			};
			return {
				context: t.context ?? null,
				taskMenu: t.surfaces?.taskMenu === true,
				persist: t.persist === true,
				requiresStatus: t.requiresStatus ?? null,
			};
		} catch {
			return null;
		}
	}, [jsonText]);

	const loadTemplate = useCallback(async (id: number) => {
		setError(null);
		const { summary, template } = await fetchDevPrintTemplate(id);
		setSelectedId(id);
		setSelectedSummary(summary);
		setJsonText(formatJson(template));
	}, []);

	const refreshList = useCallback(async () => {
		const list = await listDevPrintTemplates({
			orgId: orgFilter.trim() || undefined,
			documentType: documentTypeFilter ?? undefined,
			context: contextFilter ?? undefined,
			q: nameFilter.trim() || undefined,
		});
		setTemplates(list);
		return list;
	}, [orgFilter, documentTypeFilter, contextFilter, nameFilter]);

	useEffect(() => {
		if (!import.meta.env.DEV) return;
		const controller = new AbortController();
		setLoading(true);
		Promise.all([refreshList(), listDevPrintTemplateTags()])
			.then(([list, tagList]) => {
				if (controller.signal.aborted) return;
				setTags(tagList);
				if (list.length > 0) {
					void loadTemplate(list[0].id);
				} else {
					setSelectedId(null);
					setSelectedSummary(null);
					setJsonText('');
				}
			})
			.catch((err: unknown) => {
				if (!controller.signal.aborted) {
					setError(
						err instanceof Error ? err.message : 'Failed to load templates',
					);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [loadTemplate, refreshList]);

	useEffect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	}, [previewUrl]);

	if (!import.meta.env.DEV) {
		return <Navigate to='/' replace />;
	}

	const parseEditorJson = () => {
		try {
			return JSON.parse(jsonText) as unknown;
		} catch {
			throw new Error('Template JSON is invalid');
		}
	};

	const resolvePreviewTask = async (): Promise<Record<string, unknown>> => {
		const trimmed = taskIdInput.trim();
		if (!trimmed) return SAMPLE_PREVIEW_TASK;
		const id = Number(trimmed);
		if (!Number.isFinite(id)) {
			throw new Error('Task ID must be a number');
		}
		return (await getTask(id)) as Record<string, unknown>;
	};

	const handleSave = async () => {
		if (!selectedId || busy) return;
		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			const template = parseEditorJson();
			await saveDevPrintTemplate(
				selectedId,
				template,
				selectedSummary?.name,
			);
			const list = await refreshList();
			const updated = list.find((t) => t.id === selectedId);
			if (updated) setSelectedSummary(updated);
			setNotice('Template saved to database.');
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Save failed');
		} finally {
			setBusy(false);
		}
	};

	const handlePreview = async () => {
		if (!selectedId || busy) return;
		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			const template = parseEditorJson();
			const task = await resolvePreviewTask();
			const blob = await previewDevPrintTemplate(selectedId, task, template);
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			setPreviewUrl(URL.createObjectURL(blob));
			setNotice('Preview updated.');
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Preview failed');
		} finally {
			setBusy(false);
		}
	};

	const insertTag = (tag: string | null) => {
		if (!tag) return;
		setJsonText((prev) => `${prev}{{${tag}}}`);
	};

	const handleApplyFilters = () => {
		setLoading(true);
		setError(null);
		void refreshList()
			.then((list) => {
				if (list.length > 0) {
					void loadTemplate(list[0].id);
				} else {
					setSelectedId(null);
					setSelectedSummary(null);
					setJsonText('');
				}
			})
			.catch((err: unknown) => {
				setError(
					err instanceof Error ? err.message : 'Failed to load templates',
				);
			})
			.finally(() => setLoading(false));
	};

	const handleTemplateCreated = async (id: number) => {
		setNotice(null);
		setError(null);
		const list = await refreshList();
		const created = list.find((t) => t.id === id);
		if (created) {
			await loadTemplate(id);
			setNotice(
				`Created ${created.name} (${created.documentTypeLabel}, org ${created.orgId}).`,
			);
		} else {
			await loadTemplate(id);
			setNotice('Template created.');
		}
	};

	return (
		<Box className='tasks-page dev-doc-templates-page'>
			<PageHeader title='Print templates' />

			<Box className='dev-doc-templates-toolbar'>
				<Text size='sm' c='dimmed'>
					Browse and edit per-org print templates stored in{' '}
					<code>org_print_templates</code>. Task users see document types, not
					template names.
				</Text>

				<Group align='flex-end' wrap='wrap' gap='sm'>
					<Box maw={100} style={{ flex: '0 1 6rem' }}>
						<TextInput
							label='Org'
							value={orgFilter}
							onChange={(e) => setOrgFilter(e.currentTarget.value)}
						/>
					</Box>
					<Box maw={240} style={{ flex: '1 1 12rem' }}>
						<Select
							label='Document type'
							placeholder='All types'
							data={documentTypeOptions}
							value={documentTypeFilter}
							onChange={setDocumentTypeFilter}
							clearable
							searchable
						/>
					</Box>
					<Box maw={160} style={{ flex: '0 1 10rem' }}>
						<Select
							label='Context'
							placeholder='All'
							data={[
								{ value: 'task', label: 'Task' },
								{ value: 'report', label: 'Report' },
							]}
							value={contextFilter}
							onChange={setContextFilter}
							clearable
						/>
					</Box>
					<Box maw={240} style={{ flex: '1 1 12rem' }}>
						<TextInput
							label='Template name'
							placeholder='Search name…'
							value={nameFilter}
							onChange={(e) => setNameFilter(e.currentTarget.value)}
						/>
					</Box>
					<Button variant='light' onClick={handleApplyFilters}>
						Apply filters
					</Button>
					<Button
						leftSection={<Plus size={16} />}
						onClick={() => setCreateModalOpen(true)}
					>
						New template
					</Button>
				</Group>

				{parsedMeta && selectedSummary ? (
					<Text size='sm' c='dimmed'>
						Editing <strong>{selectedSummary.name}</strong> (
						{selectedSummary.documentTypeLabel}, org {selectedSummary.orgId})
						{' · '}
						Context: <strong>{parsedMeta.context ?? '—'}</strong>
						{parsedMeta.context === 'task' ? (
							<>
								{' · '}
								task menu: {parsedMeta.taskMenu ? 'yes' : 'no'}
								{' · '}
								persist: {parsedMeta.persist ? 'yes' : 'no'}
								{parsedMeta.requiresStatus
									? ` · requires status: ${parsedMeta.requiresStatus}`
									: ''}
							</>
						) : parsedMeta.context === 'report' ? (
							<> · preview not available (report context stub)</>
						) : null}
					</Text>
				) : null}

				{loading ? (
					<Loader size='sm' />
				) : (
					<>
						{error ? (
							<div
								className='dev-doc-templates-callout dev-doc-templates-callout--error'
								role='alert'
							>
								{error}
							</div>
						) : null}
						{notice ? (
							<div
								className='dev-doc-templates-callout dev-doc-templates-callout--success'
								role='status'
							>
								{notice}
							</div>
						) : null}

						<ScrollArea type='auto' offsetScrollbars>
							<Table highlightOnHover striped withTableBorder>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Org</Table.Th>
										<Table.Th>Name</Table.Th>
										<Table.Th>Type</Table.Th>
										<Table.Th>Context</Table.Th>
										<Table.Th>Hash</Table.Th>
										<Table.Th>Updated</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{templates.length === 0 ? (
										<Table.Tr>
											<Table.Td colSpan={6}>
												<Stack align='center' gap='sm' py='md'>
													<Text size='sm' c='dimmed' ta='center'>
														No templates match these filters.
													</Text>
													<Button
														variant='light'
														leftSection={<Plus size={16} />}
														onClick={() => setCreateModalOpen(true)}
													>
														Create template
													</Button>
												</Stack>
											</Table.Td>
										</Table.Tr>
									) : (
										templates.map((row) => (
											<Table.Tr
												key={row.id}
												onClick={() => void loadTemplate(row.id)}
												style={{
													cursor: 'pointer',
													background:
														row.id === selectedId
															? 'var(--mantine-color-blue-light)'
															: undefined,
												}}
											>
												<Table.Td>{row.orgId}</Table.Td>
												<Table.Td>{row.name}</Table.Td>
												<Table.Td>{row.documentTypeLabel}</Table.Td>
												<Table.Td>{row.context}</Table.Td>
												<Table.Td>
													<Text ff='monospace' size='xs'>
														{shortHash(row.contentHash)}
													</Text>
												</Table.Td>
												<Table.Td>
													<RelativeTime
														value={row.updatedAt}
														variant='absolute'
													/>
												</Table.Td>
											</Table.Tr>
										))
									)}
								</Table.Tbody>
							</Table>
						</ScrollArea>

						{selectedId ? (
							<Group align='flex-end' wrap='wrap' gap='sm'>
								<Box maw={240} style={{ flex: '0 1 14rem' }}>
									<Select
										label='Insert tag'
										placeholder='Pick a tag'
										data={tagOptions}
										value={null}
										onChange={insertTag}
										clearable
										searchable
									/>
								</Box>
								<Box maw={160} style={{ flex: '0 1 10rem' }}>
									<TextInput
										label='Preview task ID'
										placeholder='Sample data'
										value={taskIdInput}
										onChange={(e) => setTaskIdInput(e.currentTarget.value)}
									/>
								</Box>
								<Group
									gap='xs'
									style={{ flex: '0 0 auto', marginLeft: 'auto' }}
								>
									<Button
										leftSection={<Save size={16} />}
										onClick={() => void handleSave()}
										loading={busy}
									>
										Save
									</Button>
									<Button
										variant='light'
										leftSection={<Eye size={16} />}
										onClick={() => void handlePreview()}
										loading={busy}
										disabled={selectedSummary?.context === 'report'}
									>
										Preview PDF
									</Button>
								</Group>
							</Group>
						) : null}
					</>
				)}
			</Box>

			{!loading && selectedId ? (
				<Box className='dev-doc-templates-panes'>
					<Box className='dev-doc-templates-pane'>
						<Text className='dev-doc-templates-pane-title' size='sm' fw={600}>
							Template JSON
						</Text>
						<Textarea
							className='dev-doc-templates-editor'
							aria-label='Template JSON'
							value={jsonText}
							onChange={(e) => setJsonText(e.currentTarget.value)}
							autosize={false}
							styles={{
								root: {
									flex: 1,
									display: 'flex',
									flexDirection: 'column',
									minHeight: 0,
								},
								wrapper: { flex: 1, display: 'flex', minHeight: 0 },
								input: {
									flex: 1,
									minHeight: 0,
									height: '100%',
									border: 'none',
									borderRadius: 0,
									fontFamily:
										'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
									fontSize: 13,
									lineHeight: 1.45,
									resize: 'none',
								},
							}}
						/>
					</Box>

					<Box className='dev-doc-templates-pane'>
						<Text className='dev-doc-templates-pane-title' size='sm' fw={600}>
							Preview
						</Text>
						{previewUrl ? (
							<iframe
								className='dev-doc-templates-preview-frame'
								title='Print template preview'
								src={previewUrl}
							/>
						) : (
							<Box className='dev-doc-templates-preview-empty'>
								<Text size='sm' c='dimmed' ta='center'>
									Click Preview PDF to render the current template.
								</Text>
							</Box>
						)}
					</Box>
				</Box>
			) : null}

			<NewPrintTemplateModal
				opened={createModalOpen}
				onClose={() => setCreateModalOpen(false)}
				defaultOrgId={orgFilter}
				templates={templates}
				onCreated={handleTemplateCreated}
			/>
		</Box>
	);
}
