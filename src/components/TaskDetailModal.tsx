import { useEffect, useMemo, useRef, useState, Fragment, type ReactNode } from 'react';
import {
	Stack,
	Group,
	Text,
	Loader,
	Alert,
	Button,
	Badge,
	Divider,
	Anchor,
	Title,
	Menu,
	Textarea,
} from '@mantine/core';
import {
	Ellipsis,
	ExternalLink,
	FileText,
	Pencil,
	Printer,
	RefreshCw,
	Ban,
	Copy,
} from 'lucide-react';
import { getTask, updateTaskStatus } from '../api/tasks';
import {
	openPrintTemplate,
	type PrintTemplateMenuItem,
} from '../api/printTemplates';
import {
	getCachedPrintMenuItems,
	groupPrintMenuItems,
	syncPrintTemplateCache,
} from '../printTemplateCache';
import { useAlert } from '../context/AlertContext';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { notifyError } from '../notify';
import {
	isRestoreWindowOpenFromArchiveAt,
} from '../../shared/cancelRetention.js';
import { visibleLabeledCustomFieldDefs } from '../customFields';
import { customFieldValueNode } from './CustomFieldValueText';
import { formatShortName } from '../formatName';
import { RelativeTime } from './RelativeTime';
import { isEmptyTaskDesc } from '../taskDescHtml';
import type { TaskDetail, TaskStatus } from '../types/task';
import { statusTransitionsFor } from '../../shared/statusTransitions.js';
import { CloneTaskModal } from './CloneTaskModal';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import {
	AddressCatalogModals,
	type AddressCatalogModalsHandle,
} from './AddressCatalogModals';
import { TaskDestinationPinModal } from './TaskDestinationPinModal';
import { TaskDescHtml } from './TaskDescHtml';
import { TaskDestinationDisplay } from './TaskDestinationDisplay';
import { TaskAttachments } from './TaskAttachments';
import { TaskHistory } from './TaskHistory';
import { TaskStartedCrew } from './TaskStartedCrew';
import { TaskStatusBadge } from './TaskStatusBadge';

interface TaskDetailModalProps {
	taskId: number | null;
	opened: boolean;
	onClose: () => void;
	onEdit?: (task: TaskDetail) => void;
	onDelete?: (task: TaskDetail) => Promise<void>;
	onRestore?: (task: TaskDetail) => Promise<void>;
	onStatusChange?: (task: { id: number; status: TaskStatus }) => void;
	onCloned?: (newTaskId: number) => void | Promise<void>;
}

function formatDuration(
	startIso: string | null,
	endIso: string | null,
): string {
	if (!startIso || !endIso) return '—';
	const start = new Date(startIso);
	const end = new Date(endIso);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
	const ms = end.getTime() - start.getTime();
	if (ms < 0) return '—';

	const totalMinutes = Math.round(ms / 60_000);
	if (totalMinutes === 0) return '0m';

	const days = Math.floor(totalMinutes / (60 * 24));
	const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
	const minutes = totalMinutes % 60;
	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
	return parts.join(' ');
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
	return (
		<>
			<dt className='task-detail-field-key'>{label}</dt>
			<dd className='task-detail-field-value'>{value || '—'}</dd>
		</>
	);
}

function DetailFields({ children }: { children: ReactNode }) {
	return <dl className='task-detail-fields'>{children}</dl>;
}

function Section({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<Stack gap='sm' className={className}>
			<Divider
				label={
					<Text size='xs' fw={700} tt='uppercase' c='dimmed'>
						{label}
					</Text>
				}
				labelPosition='left'
			/>
			{children}
		</Stack>
	);
}

export function TaskDetailModal({
	taskId,
	opened,
	onClose,
	onEdit,
	onDelete,
	onRestore,
	onStatusChange,
	onCloned,
}: TaskDetailModalProps) {
	const { confirm } = useAlert();
	const { user } = useCurrentUser();
	const { settings: orgSettings } = useOrgSettings();
	const [task, setTask] = useState<TaskDetail | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [actionBusy, setActionBusy] = useState(false);
	const [actionNotice, setActionNotice] = useState<string | null>(null);
	const [cloneOpen, setCloneOpen] = useState(false);
	const [pinOpen, setPinOpen] = useState(false);
	const [printMenuItems, setPrintMenuItems] = useState<PrintTemplateMenuItem[]>(
		[],
	);
	const [pendingOutcome, setPendingOutcome] = useState<
		'Completed' | 'Failed' | null
	>(null);
	const [statusNotes, setStatusNotes] = useState('');
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const catalogModalsRef = useRef<AddressCatalogModalsHandle>(null);
	const archiveAt =
		task?.status === 'Cancelled' ? (task.archiveAt ?? null) : null;
	const canRestore =
		task?.status === 'Cancelled'
			? isRestoreWindowOpenFromArchiveAt(task.archiveAt ?? null)
			: true;

	useEffect(() => {
		if (!pendingOutcome) return;
		scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
	}, [pendingOutcome]);

	useEffect(() => {
		if (!opened || taskId == null) {
			setTask(null);
			setError(null);
			setLoading(false);
			setActionBusy(false);
			setActionNotice(null);
			setPendingOutcome(null);
			setStatusNotes('');
			setCloneOpen(false);
			setPinOpen(false);
			catalogModalsRef.current?.closeAll();
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setActionNotice(null);
		setPendingOutcome(null);
		setStatusNotes('');
		setTask(null);

		getTask(taskId, controller.signal)
			.then((next) => {
				if (!controller.signal.aborted) setTask(next);
			})
			.catch((err: unknown) => {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError(err instanceof Error ? err.message : 'Failed to load task');
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});

		return () => controller.abort();
	}, [opened, taskId]);

	useEffect(() => {
		if (!opened) {
			setPrintMenuItems([]);
			return;
		}
		const controller = new AbortController();
		const cached = getCachedPrintMenuItems();
		if (cached.length > 0) {
			setPrintMenuItems(cached);
		}
		syncPrintTemplateCache(orgSettings.printTemplatesRevision, controller.signal)
			.then((items) => {
				if (!controller.signal.aborted) setPrintMenuItems(items);
			})
			.catch(() => {
				if (!controller.signal.aborted) setPrintMenuItems(cached);
			});
		return () => controller.abort();
	}, [opened, orgSettings.printTemplatesRevision]);

	const groupedPrintMenu = useMemo(
		() => groupPrintMenuItems(printMenuItems),
		[printMenuItems],
	);

	const refreshTask = async () => {
		if (!task) return;
		const refreshed = await getTask(task.id);
		setTask(refreshed);
	};

	const handlePrintUnavailable = (label: string) => {
		setActionNotice(`${label} is not available yet.`);
	};

	const handleOpenPrintTemplate = async (documentType: string) => {
		if (!task || actionBusy) return;
		setActionBusy(true);
		setActionNotice(null);
		try {
			await openPrintTemplate(documentType, {
				context: 'task',
				taskId: task.id,
			});
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to open print template',
			);
		} finally {
			setActionBusy(false);
		}
	};

	const handleStatusChange = async (status: TaskStatus) => {
		if (!task || actionBusy) return;

		if (status === 'Completed' || status === 'Failed') {
			setActionNotice(null);
			setPendingOutcome(status);
			setStatusNotes('');
			return;
		}

		setActionBusy(true);
		setActionNotice(null);
		setPendingOutcome(null);
		try {
			const updated = await updateTaskStatus(task.id, status, {
				userId: user?.id,
			});
			setTask((prev) =>
				prev
					? {
							...prev,
							status: updated.status,
							completedAt: updated.completedAt,
							completedNotes: updated.completedNotes,
							failedReason: updated.failedReason,
							completionNotes: updated.completionNotes,
							completionNotesByName: updated.completionNotesByName,
						}
					: prev,
			);
			onStatusChange?.(updated);
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to change status',
			);
		} finally {
			setActionBusy(false);
		}
	};

	const handleSaveOutcome = async () => {
		if (!task || !pendingOutcome || actionBusy) return;
		if (pendingOutcome === 'Failed' && statusNotes.length === 0) {
			notifyError('Failed reason is required');
			return;
		}
		setActionBusy(true);
		setActionNotice(null);
		try {
			const updated = await updateTaskStatus(task.id, pendingOutcome, {
				notes: statusNotes,
				userId: user?.id,
			});
			setTask((prev) =>
				prev
					? {
							...prev,
							status: updated.status,
							completedAt: updated.completedAt,
							completedNotes: updated.completedNotes,
							failedReason: updated.failedReason,
							completionNotes: updated.completionNotes,
							completionNotesByName: updated.completionNotesByName,
						}
					: prev,
			);
			onStatusChange?.(updated);
			setPendingOutcome(null);
			setStatusNotes('');
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to change status',
			);
		} finally {
			setActionBusy(false);
		}
	};

	const handleDelete = async () => {
		if (!task || !onDelete) return;
		const label = task.externalKey
			? task.externalKey
			: `task #${task.id}`;
		if (!(await confirm(`Cancel ${label}?`, { danger: true }))) {
			return;
		}
		setActionBusy(true);
		setActionNotice(null);
		try {
			await onDelete(task);
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to cancel task',
			);
			setActionBusy(false);
		}
	};

	const handleRestore = async () => {
		if (!task || !onRestore) return;
		setActionBusy(true);
		setActionNotice(null);
		try {
			await onRestore(task);
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to restore task',
			);
			setActionBusy(false);
		}
	};

	const statusOptions: TaskStatus[] = task
		? ((statusTransitionsFor(task.taskType)[task.status] ?? []) as TaskStatus[])
		: [];

	const title =
		task?.externalKey != null && task.externalKey !== ''
			? task.externalKey
			: taskId != null
				? `#${taskId}`
				: 'Task';

	const completedNoteEntries =
		task?.completionNotes?.filter((n) => n.outcome === 'Completed') ?? [];
	const failedNoteEntries =
		task?.completionNotes?.filter((n) => n.outcome === 'Failed') ?? [];
	const showCompletionCallout =
		Boolean(task) &&
		(pendingOutcome != null ||
			completedNoteEntries.length > 0 ||
			failedNoteEntries.length > 0);

	const renderNoteEntries = (
		entries: NonNullable<TaskDetail['completionNotes']>,
		outcome: 'Completed' | 'Failed',
	) => (
		<div className='task-detail-completion-list'>
			{entries.map((entry) => {
				const who = formatShortName(entry.displayName);
				return (
					<div key={entry.userId} className='task-detail-completion-entry'>
						{entry.notes?.trim() ? (
							<p className='task-detail-completion-notes'>
								{entry.notes.trim()}
							</p>
						) : null}
						<p className='task-detail-completion-meta'>
							{outcome} at{' '}
							<RelativeTime
								value={entry.updatedAt || entry.createdAt}
								variant='absolute'
							/>{' '}
							by {who}
						</p>
					</div>
				);
			})}
		</div>
	);

	return (
		<>
		<KeyboardAwareModal
			opened={opened}
			onClose={onClose}
			pinFooter
			title={
				task ? (
					<Group gap='sm' wrap='nowrap'>
						<Title order={3} fz={24}>
							{title}
						</Title>
						<Badge variant='light' color='brand'>
							{task.taskType}
						</Badge>
						<TaskStatusBadge status={task.status} />
					</Group>
				) : (
					title
				)
			}
			size='1200px'
			centered
			classNames={{
				content: 'task-detail-modal',
				header: 'task-detail-modal-header',
				body: 'task-detail-modal-body',
			}}
			styles={{
				title: { fontWeight: 700 },
				header: { minHeight: 0 },
			}}
		>
			{loading ? (
				<Group justify='center' py='xl'>
					<Loader size='sm' />
				</Group>
			) : error ? (
				<Alert color='red' title='Could not load task'>
					{error}
				</Alert>
			) : task ? (
				<>
					<div className='task-detail-scroll' ref={scrollRef}>
						<Stack gap='lg' className='task-detail-scroll-stack'>
							<div className='task-detail-layout'>
								<div className='task-detail-main'>
									<Stack gap='lg'>
										{task.status === 'Cancelled' && task.cancelledAt ? (
											<Alert color='orange' title='Cancelled'>
												{archiveAt ? (
													<>
														Scheduled for archival on{' '}
														<RelativeTime
															value={archiveAt}
															variant='absolute'
														/>
														.
													</>
												) : (
													<>
														This task will not be automatically archived.
													</>
												)}
											</Alert>
										) : null}
										{showCompletionCallout ? (
											<Stack gap='sm'>
												{pendingOutcome ? (
													<div
														className={
															pendingOutcome === 'Failed'
																? 'task-detail-completion task-detail-completion--failed'
																: 'task-detail-completion'
														}
													>
														<Stack gap='sm'>
															<Textarea
																label={
																	pendingOutcome === 'Failed'
																		? 'Failed reason'
																		: 'Completed notes'
																}
																value={statusNotes}
																onChange={(e) =>
																	setStatusNotes(e.currentTarget.value)
																}
																minRows={3}
																autosize
																disabled={actionBusy}
															/>
															<Group gap='xs'>
																<Button
																	color={
																		pendingOutcome === 'Failed'
																			? 'red'
																			: 'brand'
																	}
																	loading={actionBusy}
																	disabled={
																		pendingOutcome === 'Failed' &&
																		statusNotes.length === 0
																	}
																	onClick={() => void handleSaveOutcome()}
																>
																	{pendingOutcome === 'Failed'
																		? 'Mark Failed'
																		: 'Complete'}
																</Button>
																<Button
																	variant='default'
																	disabled={actionBusy}
																	onClick={() => {
																		setPendingOutcome(null);
																		setStatusNotes('');
																	}}
																>
																	Cancel
																</Button>
															</Group>
														</Stack>
													</div>
												) : null}

												{completedNoteEntries.length > 0 ? (
													<div className='task-detail-completion'>
														{renderNoteEntries(
															completedNoteEntries,
															'Completed',
														)}
													</div>
												) : null}

												{failedNoteEntries.length > 0 ? (
													<div className='task-detail-completion task-detail-completion--failed'>
														{renderNoteEntries(failedNoteEntries, 'Failed')}
													</div>
												) : null}
											</Stack>
										) : null}

										<TaskStartedCrew
											status={task.status}
											crewMembers={task.crewMembers}
										/>

										{task.jobTitle?.trim() ? (
											<p className='task-detail-job-title'>
												{task.jobTitle.trim()}
											</p>
										) : null}

										<DetailFields>
											<DetailField
												label='Created by'
												value={
													task.createdByName
														? formatShortName(task.createdByName)
														: ''
												}
											/>
											{!isEmptyTaskDesc(task.description) ? (
												<>
													<dt className='task-detail-field-key'>Description</dt>
													<dd className='task-detail-field-value'>
														<TaskDescHtml value={task.description} />
													</dd>
												</>
											) : null}
										</DetailFields>

										<Section label='Crew'>
											{task.crewMembers.length === 0 ? (
												<Text size='sm' c='dimmed'>
													Unassigned
												</Text>
											) : (
												<DetailFields>
													{task.crewMembers.map((member) => (
														<Fragment key={member.id}>
															<dt className='task-detail-field-key'>
																{member.isLead ? 'Lead' : 'Sub'}
															</dt>
															<dd className='task-detail-field-value'>
																{formatShortName(member.displayName)}
															</dd>
														</Fragment>
													))}
												</DetailFields>
											)}
										</Section>

										<Section label='Contacts'>
											{task.contacts.length === 0 ? (
												<Text size='sm' c='dimmed'>
													None
												</Text>
											) : (
												<DetailFields>
													{task.contacts.map((contact) => (
														<Fragment key={contact.id}>
															<dt className='task-detail-field-key'>
																{contact.isPoc ? 'POC' : 'Contact'}
															</dt>
															<dd className='task-detail-field-value'>
																<span className='task-detail-contact-name'>
																	{contact.name}
																</span>
																{contact.title.trim() ? (
																	<span className='task-detail-contact-title'>
																		{contact.title.trim()}
																	</span>
																) : null}
																{(contact.phone || contact.email) && (
																	<span className='task-detail-contact-meta'>
																		{contact.phone ? (
																			<Anchor
																				href={`tel:${contact.phone}`}
																				size='sm'
																				c='dimmed'
																			>
																				{contact.phone}
																			</Anchor>
																		) : null}
																		{contact.phone && contact.email ? (
																			<span aria-hidden> · </span>
																		) : null}
																		{contact.email ? (
																			<Anchor
																				href={`mailto:${contact.email}`}
																				size='sm'
																				c='dimmed'
																			>
																				{contact.email}
																			</Anchor>
																		) : null}
																	</span>
																)}
															</dd>
														</Fragment>
													))}
												</DetailFields>
											)}
										</Section>

										<Section label='Destination'>
											<TaskDestinationDisplay
												destinationAddressId={task.destinationAddressId}
												destinationAddressName={task.destinationAddressName}
												destinationAddress={task.destinationAddress}
												destinationBuilding={task.destinationBuilding}
												destinationNotes={task.destinationNotes}
												destinationLatitude={task.destinationLatitude}
												destinationLongitude={task.destinationLongitude}
												onGeoLocate={() => setPinOpen(true)}
												onAddressNameClick={
													task.destinationAddressId != null
														? () =>
																catalogModalsRef.current?.openDetail(
																	task.destinationAddressId!,
																)
														: undefined
												}
												geoLocateDisabled={actionBusy}
											/>
										</Section>

										<Section label='Schedule & crew'>
											<DetailFields>
												<DetailField
													label='Window start'
													value={
														<RelativeTime
															value={task.windowStartAt}
															variant='absolute'
														/>
													}
												/>
												<DetailField
													label='Window end'
													value={
														<RelativeTime
															value={task.windowEndAt}
															variant='absolute'
														/>
													}
												/>
												<DetailField
													label='Window duration'
													value={formatDuration(
														task.windowStartAt,
														task.windowEndAt,
													)}
												/>
												{visibleLabeledCustomFieldDefs(
													task.customFieldDefs?.length
														? task.customFieldDefs
														: orgSettings.customFieldDefs.task,
													task.taskType,
												).map((def) => (
													<DetailField
														key={def.slot}
														label={def.label}
														value={customFieldValueNode(
															def,
															task.customFields?.[String(def.slot)],
															task.customFieldDisplays?.[String(def.slot)],
														)}
													/>
												))}
											</DetailFields>
										</Section>

										<p className='task-detail-timestamps'>
											Created{' '}
											<RelativeTime
												value={task.createdAt}
												variant='absoluteWithAgo'
											/>
											<br />
											Updated{' '}
											<RelativeTime
												value={task.updatedAt}
												variant='absoluteWithAgo'
											/>
										</p>
									</Stack>
								</div>

								<aside className='task-detail-attachments'>
									<div className='task-detail-attachments-section'>
										<TaskAttachments
											taskId={task.id}
											initialAttachments={task.attachments}
											variant='plain'
										/>
									</div>
									<TaskHistory
										taskId={task.id}
										refreshKey={`${task.status}:${task.updatedAt}`}
									/>
								</aside>
							</div>
						</Stack>
					</div>

					<div className='task-detail-footer'>
						{actionNotice ? (
							<Alert color='yellow' title='Unavailable' mb='sm'>
								{actionNotice}
							</Alert>
						) : null}

						<Group justify='space-between' gap='xs' wrap='nowrap'>
							<Button variant='default' onClick={onClose} disabled={actionBusy}>
								Close
							</Button>
							<Group gap='xs' wrap='nowrap'>
								{onEdit ? (
									<Button
										color='brand'
										leftSection={<Pencil size={16} />}
										onClick={() => onEdit(task)}
										disabled={actionBusy}
									>
										Edit
									</Button>
								) : null}
								<Menu shadow='md' width={220} position='top-end'>
									<Menu.Target>
										<Button
											variant='default'
											leftSection={<Ellipsis size={16} />}
											loading={actionBusy}
											disabled={actionBusy}
										>
											More actions
										</Button>
									</Menu.Target>
									<Menu.Dropdown>
										{task.trackingPath || task.trackingToken ? (
											<Menu.Item
												component='a'
												href={
													task.trackingPath || `/t/${task.trackingToken}`
												}
												target='_blank'
												rel='noopener noreferrer'
												leftSection={<ExternalLink size={16} />}
											>
												Open tracking page
											</Menu.Item>
										) : null}
										<Menu.Item
											leftSection={<Printer size={16} />}
											onClick={() => handlePrintUnavailable('Print task')}
										>
											Print task
										</Menu.Item>
										{groupedPrintMenu.map(({ group, items }) =>
											group ? (
												<Menu.Sub key={group}>
													<Menu.Sub.Target>
														<Menu.Sub.Item leftSection={<FileText size={16} />}>
															{group}
														</Menu.Sub.Item>
													</Menu.Sub.Target>
													<Menu.Sub.Dropdown>
														{items.map((item) => (
															<Menu.Item
																key={item.documentType}
																onClick={() =>
																	void handleOpenPrintTemplate(item.documentType)
																}
															>
																{item.label}
															</Menu.Item>
														))}
													</Menu.Sub.Dropdown>
												</Menu.Sub>
											) : (
												items.map((item) => (
													<Menu.Item
														key={item.documentType}
														leftSection={<FileText size={16} />}
														onClick={() =>
															void handleOpenPrintTemplate(item.documentType)
														}
													>
														{item.label}
													</Menu.Item>
												))
											),
										)}
										{onCloned ? (
											<Menu.Item
												leftSection={<Copy size={16} />}
												onClick={() => setCloneOpen(true)}
											>
												Clone task
											</Menu.Item>
										) : null}
										<Menu.Sub>
											<Menu.Sub.Target>
												<Menu.Sub.Item
													leftSection={<RefreshCw size={16} />}
													disabled={statusOptions.length === 0}
												>
													Change status
												</Menu.Sub.Item>
											</Menu.Sub.Target>
											<Menu.Sub.Dropdown>
												{statusOptions.map((status) => (
													<Menu.Item
														key={status}
														onClick={() => void handleStatusChange(status)}
													>
														{status}
													</Menu.Item>
												))}
											</Menu.Sub.Dropdown>
										</Menu.Sub>
										{task.status === 'Cancelled' ? (
											onRestore && canRestore ? (
												<>
													<Menu.Divider />
													<Menu.Item
														leftSection={<RefreshCw size={16} />}
														onClick={() => void handleRestore()}
													>
														Restore task
													</Menu.Item>
												</>
											) : null
										) : onDelete ? (
											<>
												<Menu.Divider />
												<Menu.Item
													color='red'
													leftSection={<Ban size={16} />}
													onClick={() => void handleDelete()}
												>
													Cancel task
												</Menu.Item>
											</>
										) : null}
									</Menu.Dropdown>
								</Menu>
							</Group>
						</Group>
					</div>
				</>
			) : null}
		</KeyboardAwareModal>
		{onCloned ? (
			<CloneTaskModal
				taskId={task?.id ?? taskId}
				opened={cloneOpen}
				onClose={() => setCloneOpen(false)}
				onCloned={onCloned}
			/>
		) : null}
		{task ? (
			<TaskDestinationPinModal
				taskId={task.id}
				destinationAddressName={task.destinationAddressName}
				destinationAddress={task.destinationAddress}
				destinationBuilding={task.destinationBuilding}
				opened={pinOpen}
				onClose={() => setPinOpen(false)}
				onSaved={refreshTask}
				zIndex={400}
			/>
		) : null}
		<AddressCatalogModals
			ref={catalogModalsRef}
			allowAddAnother={false}
			zIndex={400}
			onMutated={refreshTask}
		/>
		</>
	);
}
