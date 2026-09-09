import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Group, Loader, Text, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
	Camera,
	CheckCircle,
	ChevronLeft,
	Image,
	MapPin,
	MessageSquare,
	Navigation,
	Package,
	Phone,
	Play,
} from 'lucide-react';
import { getTask, createCrewEvent, type CrewEventType } from '../api/tasks';
import {
	listAttachments,
	mediaLibraryAcceptAttr,
	uploadAttachment,
	validateAttachmentFile,
} from '../api/attachments';
import {
	AddressCatalogModals,
	type AddressCatalogModalsHandle,
} from '../components/AddressCatalogModals';
import { TaskDestinationPinModal } from '../components/TaskDestinationPinModal';
import { MultiShotCamera } from '../components/MultiShotCamera';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import { TaskAttachments } from '../components/TaskAttachments';
import { TaskDescHtml } from '../components/TaskDescHtml';
import { TaskHistory } from '../components/TaskHistory';
import { captureRequiredGeo } from '../captureGeo';
import { TaskStartedCrew } from '../components/TaskStartedCrew';
import { TaskStatusBadge } from '../components/TaskStatusBadge';
import { useAlert } from '../context/AlertContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { notifyError, notifyWarning } from '../notify';
import { useCurrentUser } from '../context/CurrentUserContext';
import { visibleLabeledCustomFieldDefs } from '../customFields';
import { customFieldValueNode } from '../components/CustomFieldValueText';
import { useDocumentTitle } from '../documentTitle';
import { isEmptyTaskDesc } from '../taskDescHtml';
import { formatShortName } from '../formatName';
import { RelativeTime } from '../components/RelativeTime';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useFieldPullToRefresh } from '../hooks/useFieldPullToRefresh';
import {
	hasDestinationCoords,
	openMapsNavigationCoords,
} from '../openMapsNavigation';
import { AG_GRID_MOBILE_MQ } from '../agGridDefaults';
import type {
	TaskAttachment,
	TaskCompletionNote,
	TaskContact,
	TaskDetail,
	TaskStatus,
} from '../types/task';

function TaskWindow({ start, end }: { start: string | null; end: string | null }) {
	return (
		<>
			<RelativeTime value={start} variant='shortWithAgo' />
			{' – '}
			<RelativeTime value={end} variant='shortWithAgo' />
		</>
	);
}

function CompletionCallout({
	outcome,
	entries,
}: {
	outcome: 'Completed' | 'Failed';
	entries: TaskCompletionNote[];
}) {
	return (
		<div
			className={
				outcome === 'Failed'
					? 'task-view-callout task-view-callout--failed'
					: 'task-view-callout'
			}
		>
			{entries.map((entry) => (
				<div key={entry.userId}>
					{entry.notes?.trim() ? (
						<p className='task-view-callout-notes'>{entry.notes.trim()}</p>
					) : null}
					<p className='task-view-callout-meta'>
						{outcome} at{' '}
						<RelativeTime
							value={entry.updatedAt || entry.createdAt}
							variant='absolute'
						/>{' '}
						by {formatShortName(entry.displayName)}
					</p>
				</div>
			))}
		</div>
	);
}

/** Cancelled / outcome / in-progress callouts, mirroring the desktop task view. */
function TaskViewBanners({ task }: { task: TaskDetail }) {
	const completedEntries =
		task.completionNotes?.filter((n) => n.outcome === 'Completed') ?? [];
	const failedEntries =
		task.completionNotes?.filter((n) => n.outcome === 'Failed') ?? [];
	const archiveAt =
		task.status === 'Cancelled' ? (task.archiveAt ?? null) : null;

	return (
		<div className='task-view-banners'>
			{task.status === 'Cancelled' && task.cancelledAt ? (
				<Alert color='orange' title='Cancelled'>
					{archiveAt ? (
						<>
							Scheduled for archival on{' '}
							<RelativeTime value={archiveAt} variant='absolute' />.
						</>
					) : (
						<>This task will not be automatically archived.</>
					)}
				</Alert>
			) : null}

			{completedEntries.length > 0 ? (
				<CompletionCallout outcome='Completed' entries={completedEntries} />
			) : null}

			{failedEntries.length > 0 ? (
				<CompletionCallout outcome='Failed' entries={failedEntries} />
			) : null}

			<TaskStartedCrew status={task.status} crewMembers={task.crewMembers} />
		</div>
	);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className='task-view-field'>
			<span className='task-view-field-label'>{label}</span>
			<span className='task-view-field-value'>{value || '—'}</span>
		</div>
	);
}

function ContactBlock({ contact }: { contact: TaskContact }) {
	const phone = contact.phone.trim();
	const canCall = Boolean(phone);

	return (
		<div
			className={
				contact.isPoc
					? 'task-view-contact task-view-contact--poc'
					: 'task-view-contact'
			}
		>
			<div className='task-view-contact-info'>
				<div className='task-view-contact-name'>
					<span>{contact.name}</span>
					{contact.isPoc ? (
						<span className='task-view-contact-poc'>POC</span>
					) : null}
				</div>
				{contact.title.trim() ? (
					<div className='task-view-contact-title'>{contact.title.trim()}</div>
				) : null}
				{phone ? (
					<a className='task-view-contact-email' href={`tel:${phone}`}>
						{phone}
					</a>
				) : contact.email ? (
					<a
						className='task-view-contact-email'
						href={`mailto:${contact.email}`}
					>
						{contact.email}
					</a>
				) : null}
			</div>
			<div className='task-view-contact-actions'>
				<button
					type='button'
					className='task-view-contact-btn'
					disabled={!canCall}
					onClick={() => {
						window.location.href = `sms:${phone}`;
					}}
				>
					<MessageSquare size={16} strokeWidth={2} aria-hidden />
					Text
				</button>
				<button
					type='button'
					className='task-view-contact-btn'
					disabled={!canCall}
					onClick={() => {
						window.location.href = `tel:${phone}`;
					}}
				>
					<Phone size={16} strokeWidth={2} aria-hidden />
					Call
				</button>
			</div>
		</div>
	);
}

function ActionButton({
	label,
	icon: Icon,
	onClick,
	disabled,
	/** Keep the disabled look but still receive presses (e.g. to toast a reason). */
	explainDisabled,
}: {
	label: string;
	icon: typeof Navigation;
	onClick?: () => void;
	disabled?: boolean;
	explainDisabled?: boolean;
}) {
	const softDisabled = Boolean(disabled && explainDisabled);
	return (
		<button
			type='button'
			className='task-view-action'
			onClick={onClick}
			disabled={disabled && !softDisabled}
			aria-disabled={softDisabled || undefined}
		>
			<Icon size={22} strokeWidth={2} aria-hidden />
			<span>{label}</span>
		</button>
	);
}

function PhotoActionButton({
	disabled,
	onTakePhoto,
	onPickLibrary,
}: {
	disabled?: boolean;
	onTakePhoto: () => void;
	onPickLibrary: () => void;
}) {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			if (!wrapRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	return (
		<div
			ref={wrapRef}
			className={
				open ? 'task-view-photo task-view-photo--open' : 'task-view-photo'
			}
		>
			<button
				type='button'
				className='task-view-action'
				aria-expanded={open}
				aria-haspopup='dialog'
				disabled={disabled}
				onClick={() => setOpen((prev) => !prev)}
			>
				<Camera size={22} strokeWidth={2} aria-hidden />
				<span>Photo</span>
			</button>
			{open ? (
				<div
					className='task-view-photo-popover'
					role='dialog'
					aria-label='Photo options'
				>
					<button
						type='button'
						className='task-view-photo-option'
						onClick={() => {
							setOpen(false);
							onTakePhoto();
						}}
					>
						<Camera size={22} strokeWidth={2} aria-hidden />
						<span>Camera</span>
					</button>
					<button
						type='button'
						className='task-view-photo-option'
						onClick={() => {
							setOpen(false);
							onPickLibrary();
						}}
					>
						<Image size={22} strokeWidth={2} aria-hidden />
						<span>Library</span>
					</button>
				</div>
			) : null}
		</div>
	);
}

function isTerminalStatus(status: TaskStatus): boolean {
	return (
		status === 'Completed' ||
		status === 'Failed' ||
		status === 'Undetermined' ||
		status === 'Cancelled'
	);
}

/** Why Start / Load is blocked, or null when the action is allowed. */
function getStartBlockedReason(
	task: TaskDetail,
	me: TaskDetail['crewMembers'][number] | undefined,
	isDelivery: boolean,
	busy: boolean,
): string | null {
	if (busy) return 'Please wait…';
	if (!me) return "You're not assigned to this task";
	// Completed / Undetermined can be reopened by starting again; other terminals cannot.
	if (task.status === 'Completed' || task.status === 'Undetermined') {
		return null;
	}
	if (isTerminalStatus(task.status)) {
		return `This task is ${task.status} and can't be started`;
	}
	if (me.startedAt) {
		return isDelivery
			? 'Items already loaded'
			: "You've already started this task";
	}
	return null;
}

/** Why End / Deliver is blocked, or null when the action is allowed. */
function getEndBlockedReason(
	task: TaskDetail,
	me: TaskDetail['crewMembers'][number] | undefined,
	isDelivery: boolean,
	busy: boolean,
): string | null {
	if (busy) return 'Please wait…';
	if (!me) return "You're not assigned to this task";
	if (isTerminalStatus(task.status)) {
		return `This task is already ${task.status}`;
	}
	if (!me.startedAt) {
		return isDelivery ? 'Load the items first' : 'Start the task first';
	}
	if (me.endedAt) {
		return isDelivery
			? 'You already delivered the items'
			: "You've already ended this task";
	}
	return null;
}

function TaskViewBody({
	task,
	userId,
	onCrewEvent,
	onEndTask,
	onAttachmentsChange,
	onTaskRefresh,
}: {
	task: TaskDetail;
	userId: string | null;
	onCrewEvent: (eventType: CrewEventType) => Promise<void>;
	onEndTask: () => void;
	onAttachmentsChange: (attachments: TaskAttachment[]) => void;
	onTaskRefresh: () => Promise<void>;
}) {
	const libraryInputRef = useRef<HTMLInputElement>(null);
	const cameraFallbackInputRef = useRef<HTMLInputElement>(null);
	const catalogModalsRef = useRef<AddressCatalogModalsHandle>(null);
	const { settings: orgSettings } = useOrgSettings();
	const { confirm } = useAlert();
	const [eventBusy, setEventBusy] = useState(false);
	const [mediaBusy, setMediaBusy] = useState(false);
	const [cameraOpen, setCameraOpen] = useState(false);
	const [pinOpen, setPinOpen] = useState(false);
	const address = task.destinationAddress.trim();
	const destinationName = task.destinationAddressName.trim();
	const hasCoords = hasDestinationCoords(task);
	const hasDestinationText = Boolean(address || destinationName);
	const canNavigate = hasCoords;
	const canGeoLocate = !hasCoords && hasDestinationText;
	const isDelivery = task.taskType === 'Delivery';

	const me = userId ? task.crewMembers.find((m) => m.id === userId) : undefined;
	const startBlockedReason = getStartBlockedReason(
		task,
		me,
		isDelivery,
		eventBusy || mediaBusy,
	);
	const canStart = startBlockedReason == null;
	const endBlockedReason = getEndBlockedReason(
		task,
		me,
		isDelivery,
		eventBusy || mediaBusy,
	);
	const canEnd = endBlockedReason == null;

	const openDestinationDetail = () => {
		if (task.destinationAddressId != null) {
			catalogModalsRef.current?.openDetail(task.destinationAddressId);
		}
	};

	const openCamera = () => {
		setCameraOpen(true);
	};

	const openLibrary = () => {
		libraryInputRef.current?.click();
	};

	const uploadMediaFiles = async (files: File[]) => {
		if (files.length === 0) return;
		if (!userId) {
			notifyError('Select a current user before uploading');
			return;
		}

		setMediaBusy(true);
		try {
			for (const file of files) {
				const validationError = validateAttachmentFile(file);
				if (validationError) {
					throw new Error(validationError);
				}
				await uploadAttachment(task.id, file, userId);
			}
			const next = await listAttachments(task.id);
			onAttachmentsChange(next);
		} catch (err: unknown) {
			notifyError(err instanceof Error ? err.message : 'Upload failed');
		} finally {
			setMediaBusy(false);
			if (libraryInputRef.current) libraryInputRef.current.value = '';
			if (cameraFallbackInputRef.current) {
				cameraFallbackInputRef.current.value = '';
			}
		}
	};

	const logCrewEvent = async (eventType: CrewEventType) => {
		if (eventBusy) return;
		if (
			eventType === 'started' &&
			(task.status === 'Completed' || task.status === 'Undetermined')
		) {
			const ok = await confirm(
				`This task is ${task.status.toLowerCase()}. Starting it will change the task to In Progress. Continue?`,
			);
			if (!ok) return;
		}
		setEventBusy(true);
		try {
			await onCrewEvent(eventType);
		} catch (err: unknown) {
			notifyError(
				err instanceof Error ? err.message : 'Failed to update check-in',
			);
		} finally {
			setEventBusy(false);
		}
	};

	return (
		<div className='task-view-body'>
			{cameraOpen ? (
				<MultiShotCamera
					onCancel={() => setCameraOpen(false)}
					onUnavailable={() => {
						setCameraOpen(false);
						window.setTimeout(() => {
							cameraFallbackInputRef.current?.click();
						}, 0);
					}}
					onComplete={(files) => {
						setCameraOpen(false);
						void uploadMediaFiles(files);
					}}
				/>
			) : null}
			<input
				ref={cameraFallbackInputRef}
				type='file'
				accept='image/*'
				capture='environment'
				hidden
				aria-hidden
				tabIndex={-1}
				disabled={mediaBusy}
				onChange={(e) =>
					void uploadMediaFiles(Array.from(e.target.files ?? []))
				}
			/>
			<input
				ref={libraryInputRef}
				type='file'
				accept={mediaLibraryAcceptAttr()}
				multiple
				hidden
				aria-hidden
				tabIndex={-1}
				disabled={mediaBusy}
				onChange={(e) =>
					void uploadMediaFiles(Array.from(e.target.files ?? []))
				}
			/>
			<div className='task-view-actions' role='group' aria-label='Task actions'>
				{canNavigate ? (
					<ActionButton
						label='Navigate'
						icon={Navigation}
						disabled={eventBusy || mediaBusy}
						onClick={() =>
							openMapsNavigationCoords({
								latitude: task.destinationLatitude!,
								longitude: task.destinationLongitude!,
							})
						}
					/>
				) : canGeoLocate ? (
					<ActionButton
						label='Geo-locate'
						icon={MapPin}
						disabled={eventBusy || mediaBusy}
						onClick={() => setPinOpen(true)}
					/>
				) : (
					<ActionButton
						label='Navigate'
						icon={Navigation}
						disabled
					/>
				)}
				<ActionButton
					label={isDelivery ? 'Load items' : 'Start task'}
					icon={isDelivery ? Package : Play}
					disabled={!canStart}
					explainDisabled={!canStart}
					onClick={() => {
						if (startBlockedReason) {
							notifyWarning(startBlockedReason);
							return;
						}
						void logCrewEvent('started');
					}}
				/>
				<ActionButton
					label={isDelivery ? 'Deliver items' : 'End task'}
					icon={CheckCircle}
					disabled={!canEnd}
					explainDisabled={!canEnd}
					onClick={() => {
						if (endBlockedReason) {
							notifyWarning(endBlockedReason);
							return;
						}
						onEndTask();
					}}
				/>
				<PhotoActionButton
					disabled={eventBusy || mediaBusy}
					onTakePhoto={openCamera}
					onPickLibrary={openLibrary}
				/>
			</div>

			<TaskViewBanners task={task} />


			<div className='task-view-section'>
				{task.jobTitle?.trim() ? (
					<p className='task-view-job-title'>{task.jobTitle.trim()}</p>
				) : null}
				<p className='task-view-address'>{address || 'No address'}</p>
				{destinationName ? (
					task.destinationAddressId != null ? (
						<UnstyledButton
							type='button'
							className='task-view-destination-name task-view-destination-name--link'
							onClick={openDestinationDetail}
						>
							{destinationName}
						</UnstyledButton>
					) : (
						<p className='task-view-destination-name'>{destinationName}</p>
					)
				) : null}

				<p className='task-view-window'>
					<TaskWindow
						start={task.windowStartAt}
						end={task.windowEndAt}
					/>
				</p>
			</div>

			<div className='task-view-section'>
				<div className='task-view-meta'>
					<div className='task-view-field'>
						<span className='task-view-field-label'>Status</span>
						<TaskStatusBadge status={task.status} />
					</div>
					<Field
						label='Created by'
						value={
							task.createdByName ? formatShortName(task.createdByName) : ''
						}
					/>
					{visibleLabeledCustomFieldDefs(
						task.customFieldDefs?.length
							? task.customFieldDefs
							: orgSettings.customFieldDefs.task,
						task.taskType,
					).map((def) => (
						<Field
							key={def.slot}
							label={def.label}
							value={customFieldValueNode(
								def,
								task.customFields?.[String(def.slot)],
								task.customFieldDisplays?.[String(def.slot)],
							)}
						/>
					))}
				</div>
			</div>

			{!isEmptyTaskDesc(task.description) ? (
				<div className='task-view-section'>
					<TaskDescHtml
						value={task.description}
						className='task-view-description'
					/>
				</div>
			) : null}

			<div className='task-view-section'>
				<div className='task-view-field'>
					<span className='task-view-field-label'>Contacts</span>
					{task.contacts.length === 0 ? (
						<span className='task-view-field-value'>None</span>
					) : (
						<div className='task-view-contacts'>
							{task.contacts.map((contact) => (
								<ContactBlock key={contact.id} contact={contact} />
							))}
						</div>
					)}
				</div>
			</div>

			<div className='task-view-section'>
				<span className='task-view-field-label'>Crew</span>
				{task.crewMembers.length === 0 ? (
					<span className='task-view-field-value'>Unassigned</span>
				) : (
					<div className='task-view-crew'>
						{task.crewMembers.map((member) => (
							<div
								key={member.id}
								className={
									member.isLead
										? 'task-view-crew-member task-view-crew-member--lead'
										: 'task-view-crew-member'
								}
							>
								<span className='task-view-crew-member-name'>
									{formatShortName(member.displayName)}
								</span>
								<span className='task-view-crew-member-role'>
									{member.isLead ? 'Lead' : 'Sub'}
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			<div className='task-view-section'>
				<TaskAttachments
					taskId={task.id}
					initialAttachments={task.attachments}
					variant='plain'
				/>
			</div>

			<div className='task-view-section'>
				<TaskHistory
					taskId={task.id}
					refreshKey={`${task.status}:${task.updatedAt}`}
				/>
			</div>

			<TaskDestinationPinModal
				taskId={task.id}
				destinationAddressName={task.destinationAddressName}
				destinationAddress={task.destinationAddress}
				destinationBuilding={task.destinationBuilding}
				opened={pinOpen}
				onClose={() => setPinOpen(false)}
				onSaved={onTaskRefresh}
			/>
			<AddressCatalogModals
				ref={catalogModalsRef}
				allowAddAnother={false}
				onMutated={onTaskRefresh}
			/>
		</div>
	);
}

export function TaskViewPage() {
	const { taskId: taskIdParam } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useCurrentUser();
	const taskId = Number(taskIdParam);

	const [task, setTask] = useState<TaskDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useDocumentTitle(
		task?.externalKey ? task.externalKey : task ? 'Task' : null,
	);

	const goBack = () => {
		// First load / deep link has no in-app history to pop.
		if (location.key === 'default') {
			navigate('/my-tasks');
			return;
		}
		navigate(-1);
	};

	useAndroidBackHandler(goBack, true);

	const refreshTask = useCallback(
		async (signal?: AbortSignal) => {
			if (!Number.isFinite(taskId) || taskId <= 0) {
				setTask(null);
				setError('Invalid task id');
				return;
			}
			setError(null);
			try {
				const next = await getTask(taskId, signal);
				if (!signal?.aborted) setTask(next);
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError(err instanceof Error ? err.message : 'Failed to load task');
			}
		},
		[taskId],
	);

	useEffect(() => {
		if (!Number.isFinite(taskId) || taskId <= 0) {
			setTask(null);
			setError('Invalid task id');
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setTask(null);

		void refreshTask(controller.signal).finally(() => {
			if (!controller.signal.aborted) setLoading(false);
		});

		return () => controller.abort();
	}, [taskId, refreshTask]);

	// Task view stays mounted when the tab/app is backgrounded (e.g. geo added on
	// desktop). Re-fetch when the user returns so Navigate reflects new coords.
	useEffect(() => {
		if (!Number.isFinite(taskId) || taskId <= 0) return;

		const refreshIfVisible = () => {
			if (document.visibilityState === 'visible') {
				void refreshTask();
			}
		};
		const refreshFromBackForwardCache = (event: PageTransitionEvent) => {
			if (event.persisted) refreshIfVisible();
		};

		document.addEventListener('visibilitychange', refreshIfVisible);
		window.addEventListener('focus', refreshIfVisible);
		window.addEventListener('pageshow', refreshFromBackForwardCache);
		return () => {
			document.removeEventListener('visibilitychange', refreshIfVisible);
			window.removeEventListener('focus', refreshIfVisible);
			window.removeEventListener('pageshow', refreshFromBackForwardCache);
		};
	}, [taskId, refreshTask]);

	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const {
		scrollRef: ptrScrollRef,
		pullPosition,
		isRefreshing: ptrRefreshing,
	} = useFieldPullToRefresh({
		enabled: Boolean(isMobile),
		onRefresh: () => refreshTask(),
	});

	const handleCrewEvent = async (eventType: CrewEventType) => {
		if (!task || !user) {
			throw new Error('Select a user before starting or ending a task');
		}
		const geo = await captureRequiredGeo();
		const { event, task: updated } = await createCrewEvent(task.id, {
			userId: user.id,
			eventType,
			latitude: geo.latitude,
			longitude: geo.longitude,
			accuracyMeters: geo.accuracyMeters,
			recordedAt: geo.recordedAt,
		});
		setTask((prev) =>
			prev
				? {
						...prev,
						status: updated.status,
						completedAt: updated.completedAt,
						completedNotes: updated.completedNotes,
						failedReason: updated.failedReason,
						completionNotes: updated.completionNotes ?? prev.completionNotes,
						crewMembers: prev.crewMembers.map((m) =>
							m.id === user.id
								? {
										...m,
										startedAt:
											eventType === 'started' ? event.recordedAt : m.startedAt,
										endedAt:
											eventType === 'started'
												? null
												: eventType === 'ended'
													? event.recordedAt
													: m.endedAt,
									}
								: m,
						),
					}
				: prev,
		);
	};

	return (
		<Box ref={ptrScrollRef} className='task-view-page'>
			{isMobile ? (
				<PullToRefreshIndicator
					pullPosition={pullPosition}
					isRefreshing={ptrRefreshing}
				/>
			) : null}
			<header className='task-view-header'>
				<UnstyledButton
					onClick={goBack}
					aria-label='Back'
					className='task-view-back'
				>
					<ChevronLeft size={28} strokeWidth={2} aria-hidden />
				</UnstyledButton>
				<Text fw={700} fz='lg' lineClamp={1} className='task-view-title'>
					{task?.externalKey
						? task.externalKey
						: Number.isFinite(taskId) && taskId > 0
							? `Task #${taskId}`
							: 'Task'}
				</Text>
				{task ? (
					<Text fw={800} fz='lg' className='task-view-type'>
						{task.taskType}
					</Text>
				) : (
					<span className='task-view-type' aria-hidden />
				)}
			</header>

			{loading && !task ? (
				<Group justify='center' py='xl'>
					<Loader size='sm' />
				</Group>
			) : task ? (
				<TaskViewBody
					task={task}
					userId={user?.id ?? null}
					onCrewEvent={handleCrewEvent}
					onEndTask={() =>
						navigate(
							task.taskType === 'Delivery'
								? `/task/${task.id}/deliver`
								: `/task/${task.id}/complete`,
						)
					}
					onAttachmentsChange={(attachments) =>
						setTask((prev) => (prev ? { ...prev, attachments } : prev))
					}
					onTaskRefresh={refreshTask}
				/>
			) : error ? (
				<Alert color='red' title='Could not load task'>
					{error}
				</Alert>
			) : null}
		</Box>
	);
}
