import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
	Alert,
	Button,
	Checkbox,
	Group,
	Loader,
	Menu,
	Select,
	Box,
	Popover,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { Calendar, Columns3, Plus } from 'lucide-react';
import type { RowClickedEvent } from 'ag-grid-community';
import {
	createTask,
	deleteTask,
	listTasks,
	restoreTask,
	updateTask,
} from '../api/tasks';
import { uploadAttachment } from '../api/attachments';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import type { Task, TaskDetail, TaskStatus } from '../types/task';
import {
	NewTaskModal,
	type NewTaskFormValues,
} from '../components/NewTaskModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskCards } from '../components/TaskCards';
import { TaskDayGrid } from '../components/TaskDayGrid';
import { TaskListViewSwitcher } from '../components/TaskListViewSwitcher';
import { TaskMonthView } from '../components/TaskMonthView';
import { TaskWeekView } from '../components/TaskWeekView';
import { PageHeader } from '../components/PageHeader';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import { useFieldPullToRefresh } from '../hooks/useFieldPullToRefresh';
import {
	AG_GRID_MOBILE_MQ,
	DEFAULT_VISIBLE_TASK_COLUMNS,
	getDefaultColDef,
	getTaskColumnDefs,
	getTaskColumnOptions,
	readVisibleTaskColumns,
	sanitizeVisibleTaskColumns,
	isBuiltinTaskColumnField,
	type TaskColumnField,
	writeVisibleTaskColumns,
} from '../agGridDefaults';
import { resolveTaskListTypeFilters } from '../../shared/resolveTaskListTypeFilters.js';
import { taskListPageLabels } from '../../shared/taskListPageLabels.js';
import { notifyError } from '../notify';
import { useTaskListTypeFilters } from '../taskListTypeFilters';
import {
	DEFAULT_STORED_DAY_FILTER,
	readPageState,
	tasksPageKey,
	writePageState,
	type StoredDayFilter,
} from '../desktopPageState';
import {
	dayKeyFromIso,
	formatPickedDayLabel,
	isSameLocalDay,
	localDayKey,
	MONTH_SHORT,
	parseDayKey,
	WEEKDAY_SHORT,
} from '../taskCalendar/dayKeys';
import { isTaskListView, type TaskListView } from '../taskCalendar/listView';

/** Desktop list filter tabs (label → matching task statuses). null = all statuses. */
const STATUS_TABS = [
	{ value: 'all', label: 'All', statuses: null },
	{ value: 'in_progress', label: 'In Progress', statuses: ['In Progress'] },
	{ value: 'completed', label: 'Completed', statuses: ['Completed'] },
	{ value: 'failed', label: 'Failed', statuses: ['Failed'] },
	{
		value: 'undetermined',
		label: 'Undetermined',
		statuses: ['Undetermined'],
	},
	{
		value: 'upcoming',
		label: 'Upcoming',
		statuses: ['Unassigned', 'Assigned'],
	},
	{ value: 'cancelled', label: 'Cancelled', statuses: ['Cancelled'] },
] as const satisfies ReadonlyArray<{
	value: string;
	label: string;
	statuses: readonly TaskStatus[] | null;
}>;

type StatusTabValue = (typeof STATUS_TABS)[number]['value'];

const STATUS_TAB_VALUES = new Set<StatusTabValue>(
	STATUS_TABS.map((tab) => tab.value),
);

function readStoredStatusTab(mode: 'all' | 'mine'): StatusTabValue {
	const stored = readPageState(tasksPageKey(mode, 'statusTab'), 'in_progress');
	return STATUS_TAB_VALUES.has(stored as StatusTabValue)
		? (stored as StatusTabValue)
		: 'in_progress';
}

type StatusTabDef = {
	value: StatusTabValue;
	label: string;
	statuses: readonly TaskStatus[] | null;
};

function parseTaskTypeFilter(
	raw: string | null,
	allowed: readonly string[],
): 'all' | string {
	if (!raw || raw === 'all') return 'all';
	return allowed.includes(raw) ? raw : 'all';
}

function matchesStatusTab(status: TaskStatus, tab: StatusTabDef): boolean {
	if (tab.statuses == null) return true;
	return tab.statuses.includes(status);
}

const DAY_FILTER_OPTIONS = [
	{ label: 'All', value: 'all' },
	{ label: 'Today', value: 'today' },
	{ label: 'Tomorrow', value: 'tomorrow' },
] as const;

type DayFilterPreset = (typeof DAY_FILTER_OPTIONS)[number]['value'];
type DayFilterValue = DayFilterPreset | 'picked';

function readStoredDayFilter(mode: 'all' | 'mine'): StoredDayFilter {
	const stored = readPageState(
		tasksPageKey(mode, 'dayFilter'),
		DEFAULT_STORED_DAY_FILTER,
	);
	const dayFilter = DAY_FILTER_OPTIONS.some((o) => o.value === stored.dayFilter)
		? stored.dayFilter
		: 'all';
	const pickedDayKey =
		dayFilter === 'picked' &&
		typeof stored.pickedDayKey === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(stored.pickedDayKey)
			? stored.pickedDayKey
			: null;
	return {
		dayFilter: dayFilter === 'picked' && !pickedDayKey ? 'all' : dayFilter,
		pickedDayKey,
	};
}

function toDateTimeLocal(iso: string | null): string {
	if (!iso) {
		const d = new Date();
		d.setSeconds(0, 0);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return toDateTimeLocal(null);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startTimeMs(iso: string | null): number {
	if (!iso) return Number.POSITIVE_INFINITY;
	const ms = new Date(iso).getTime();
	return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function taskDetailToFormValues(task: TaskDetail): NewTaskFormValues {
	// POC first so list order matches “first = POC”.
	const contacts = [...task.contacts].sort(
		(a, b) => Number(b.isPoc) - Number(a.isPoc),
	);
	const contactIds = contacts.map((c) => c.id);
	return {
		contactIds,
		pocContactId: contactIds[0] ?? null,
		receiveEmailContactIds: contacts
			.filter((c) => c.receivesEmail)
			.map((c) => c.id),
		taskType: task.taskType,
		taskTypeId: task.taskTypeId ?? null,
		externalKey: task.externalKey,
		jobTitle: task.jobTitle ?? '',
		taskDesc: task.description,
		destinationAddressId: task.destinationAddressId,
		destinationAddressName: task.destinationAddressName,
		destinationAddress: task.destinationAddress,
		destinationBuilding: task.destinationBuilding,
		destinationNotes: task.destinationNotes,
		destinationLatitude: task.destinationLatitude,
		destinationLongitude: task.destinationLongitude,
		afterDateTime: toDateTimeLocal(task.windowStartAt),
		beforeDateTime: toDateTimeLocal(task.windowEndAt),
		crewMemberIds: [...task.crewMembers]
			.sort((a, b) => Number(b.isLead) - Number(a.isLead))
			.map((m) => m.id),
		leadCrewMemberId:
			task.crewMembers.find((m) => m.isLead)?.id ??
			task.crewMembers[0]?.id ??
			null,
		customFields: { ...(task.customFields ?? {}) },
	};
}

function readStoredListView(mode: 'all' | 'mine'): TaskListView {
	const stored = readPageState(tasksPageKey(mode, 'listView'), 'day');
	return isTaskListView(stored) ? stored : 'day';
}

function readStoredFocusDayKey(mode: 'all' | 'mine'): string {
	const stored = readPageState(tasksPageKey(mode, 'focusDayKey'), '');
	if (typeof stored === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
		return stored;
	}
	return localDayKey(new Date());
}

export function TasksPage({
	mode = 'all',
}: {
	mode?: 'all' | 'mine';
}) {
	const { user } = useCurrentUser();
	const { settings: orgSettings } = useOrgSettings();
	const [userTypeFilters] = useTaskListTypeFilters();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const [newTaskOpen, setNewTaskOpen] = useState(false);
	const [editingTask, setEditingTask] = useState<TaskDetail | null>(null);
	const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const storedDayFilter = readStoredDayFilter(mode);
	const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
	const [dayFilter, setDayFilterState] = useState<DayFilterValue>(
		storedDayFilter.dayFilter,
	);
	const [pickedDayKey, setPickedDayKeyState] = useState<string | null>(
		storedDayFilter.pickedDayKey,
	);
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [statusTab, setStatusTabState] = useState<StatusTabValue>(() =>
		readStoredStatusTab(mode),
	);
	const [loading, setLoading] = useState(true);
	const [visibleColumns, setVisibleColumns] = useState<TaskColumnField[]>(
		readVisibleTaskColumns,
	);
	const [listView, setListViewState] = useState<TaskListView>(() =>
		readStoredListView(mode),
	);
	const [focusDayKey, setFocusDayKeyState] = useState<string>(() =>
		readStoredFocusDayKey(mode),
	);

	const setListView = useCallback(
		(value: TaskListView) => {
			setListViewState(value);
			writePageState(tasksPageKey(mode, 'listView'), value);
		},
		[mode],
	);

	const setFocusDayKey = useCallback(
		(value: string) => {
			setFocusDayKeyState(value);
			writePageState(tasksPageKey(mode, 'focusDayKey'), value);
		},
		[mode],
	);

	const persistDayFilter = useCallback(
		(next: StoredDayFilter) => {
			writePageState(tasksPageKey(mode, 'dayFilter'), next);
		},
		[mode],
	);

	const setDayFilter = useCallback(
		(value: DayFilterValue, picked: string | null = null) => {
			const nextPicked = value === 'picked' ? picked : null;
			setDayFilterState(value);
			setPickedDayKeyState(nextPicked);
			persistDayFilter({ dayFilter: value, pickedDayKey: nextPicked });
		},
		[persistDayFilter],
	);

	const setStatusTab = useCallback(
		(value: StatusTabValue) => {
			setStatusTabState(value);
			writePageState(tasksPageKey(mode, 'statusTab'), value);
		},
		[mode],
	);

	const dayFromQuery = useMemo(() => {
		if (mode !== 'mine') return null;
		const raw = searchParams.get('day');
		if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
		return raw;
	}, [mode, searchParams]);

	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);

	const enabledTaskTypeNames = useMemo(
		() =>
			orgSettings.taskTypes
				.filter((t) => t.enabled)
				.map((t) => t.name),
		[orgSettings.taskTypes],
	);

	const taskTypeFilterOptions = useMemo(
		() => [
			{ value: 'all', label: 'All types' },
			...enabledTaskTypeNames.map((name) => ({ value: name, label: name })),
		],
		[enabledTaskTypeNames],
	);

	const taskColumnOptions = useMemo(
		() =>
			getTaskColumnOptions(
				orgSettings.externalKeyLabel,
				orgSettings.customFieldDefs.task,
			),
		[orgSettings.externalKeyLabel, orgSettings.customFieldDefs.task],
	);

	const columnDefs = useMemo(
		() =>
			getTaskColumnDefs(
				isMobile ? DEFAULT_VISIBLE_TASK_COLUMNS : visibleColumns,
				{
					showCancelledTtl: statusTab === 'cancelled',
					externalKeyLabel: orgSettings.externalKeyLabel,
					customFieldDefs: orgSettings.customFieldDefs.task,
				},
			),
		[
			isMobile,
			visibleColumns,
			statusTab,
			orgSettings.externalKeyLabel,
			orgSettings.customFieldDefs.task,
		],
	);

	const builtinColumnOptions = useMemo(
		() => taskColumnOptions.filter((o) => isBuiltinTaskColumnField(o.field)),
		[taskColumnOptions],
	);
	const customColumnOptions = useMemo(
		() => taskColumnOptions.filter((o) => !isBuiltinTaskColumnField(o.field)),
		[taskColumnOptions],
	);

	useEffect(() => {
		setVisibleColumns((prev) => {
			const next = sanitizeVisibleTaskColumns(
				prev,
				orgSettings.customFieldDefs.task,
			);
			if (
				next.length === prev.length &&
				next.every((field, index) => field === prev[index])
			) {
				return prev;
			}
			return writeVisibleTaskColumns(next);
		});
	}, [orgSettings.customFieldDefs.task]);

	const showStatusTabs = !isMobile;
	const useCardView = mode === 'mine' && Boolean(isMobile);
	const showCalendarViews = !useCardView;
	const showWeekView = showCalendarViews && !isMobile;
	/** Day filter only applies in Day view (and not on mobile My Tasks cards). */
	const showDayFilter =
		showCalendarViews && listView === 'day' && !useCardView;

	useEffect(() => {
		if (!showWeekView && listView === 'week') {
			setListView('day');
		}
	}, [showWeekView, listView, setListView]);

	useEffect(() => {
		if (listView !== 'day' || useCardView) return;
		if (dayFilter === 'picked' && pickedDayKey) {
			setFocusDayKey(pickedDayKey);
		} else if (dayFilter === 'today') {
			setFocusDayKey(localDayKey(new Date()));
		} else if (dayFilter === 'tomorrow') {
			const d = new Date();
			d.setDate(d.getDate() + 1);
			setFocusDayKey(localDayKey(d));
		}
	}, [listView, dayFilter, pickedDayKey, useCardView, setFocusDayKey]);

	const drillToDay = useCallback(
		(dayKey: string) => {
			setFocusDayKey(dayKey);
			setListView('day');
			setDayFilter('picked', dayKey);
		},
		[setFocusDayKey, setListView, setDayFilter],
	);

	const toggleColumn = (field: TaskColumnField, checked: boolean) => {
		const option = taskColumnOptions.find((o) => o.field === field);
		if (option?.required) return;
		setVisibleColumns((prev) =>
			writeVisibleTaskColumns(
				checked ? [...prev, field] : prev.filter((f) => f !== field),
			),
		);
	};

	const taskDayKeys = useMemo(() => {
		if (mode !== 'mine') return [] as string[];
		const keys = new Set<string>();
		for (const task of tasks) {
			const key = dayKeyFromIso(task.windowStartAt);
			if (key) keys.add(key);
		}
		if (dayFromQuery) keys.add(dayFromQuery);
		return [...keys].sort();
	}, [tasks, mode, dayFromQuery]);

	/** Resolve day on render so cards never flash every day before useEffect runs. */
	const activeDayKey = useMemo(() => {
		if (!useCardView || taskDayKeys.length === 0) return null;
		if (dayFromQuery && taskDayKeys.includes(dayFromQuery)) return dayFromQuery;
		if (selectedDayKey && taskDayKeys.includes(selectedDayKey)) {
			return selectedDayKey;
		}
		const todayKey = localDayKey(new Date());
		if (taskDayKeys.includes(todayKey)) return todayKey;
		return taskDayKeys[0] ?? null;
	}, [useCardView, taskDayKeys, dayFromQuery, selectedDayKey]);

	useEffect(() => {
		if (mode !== 'mine' || taskDayKeys.length === 0) {
			setSelectedDayKey(null);
			return;
		}
		setSelectedDayKey(activeDayKey);
	}, [mode, taskDayKeys, activeDayKey]);

	const taskTypeFilter = useMemo(
		() =>
			mode === 'all'
				? parseTaskTypeFilter(searchParams.get('type'), enabledTaskTypeNames)
				: 'all',
		[mode, searchParams, enabledTaskTypeNames],
	);

	const activeTypeFilters = useMemo(
		() =>
			resolveTaskListTypeFilters({
				userFilters: userTypeFilters,
				urlTypeFilter: taskTypeFilter,
				enabledTypeNames: enabledTaskTypeNames,
			}),
		[userTypeFilters, taskTypeFilter, enabledTaskTypeNames],
	);

	const pageLabels = useMemo(
		() => taskListPageLabels(activeTypeFilters, orgSettings.taskTypes),
		[activeTypeFilters, orgSettings.taskTypes],
	);

	const setTaskTypeFilter = (value: string | null) => {
		const next = parseTaskTypeFilter(value, enabledTaskTypeNames);
		setSearchParams(
			(prev) => {
				const params = new URLSearchParams(prev);
				if (next === 'all') {
					params.delete('type');
				} else {
					params.set('type', next);
				}
				return params;
			},
			{ replace: true },
		);
	};

	/** Cancelled tab only on desktop All Tasks — not member lists. */
	const visibleStatusTabs = useMemo(() => {
		return mode === 'mine'
			? STATUS_TABS.filter((tab) => tab.value !== 'cancelled')
			: [...STATUS_TABS];
	}, [mode]);

	useEffect(() => {
		if (
			mode === 'mine' &&
			statusTab === 'cancelled' &&
			visibleStatusTabs.length > 0
		) {
			setStatusTab('in_progress');
		}
	}, [mode, statusTab, visibleStatusTabs]);

	useEffect(() => {
		const allowed = new Set(visibleStatusTabs.map((tab) => tab.value));
		if (!allowed.has(statusTab)) {
			setStatusTab('in_progress');
		}
	}, [mode, statusTab, visibleStatusTabs]);

	/** Tasks in the current page scope (mode + day + type), before status-tab filter. */
	const scopedTasks = useMemo(() => {
		let next = tasks;
		if (activeTypeFilters.length > 0) {
			const allowed = new Set(activeTypeFilters);
			next = next.filter((task) => allowed.has(task.taskType));
		}
		// Member lists never include cancelled tasks.
		if (mode === 'mine') {
			next = next.filter((task) => task.status !== 'Cancelled');
		}
		if (useCardView && activeDayKey) {
			const day = parseDayKey(activeDayKey);
			next = next.filter((task) => isSameLocalDay(task.windowStartAt, day));
		} else if (listView === 'day') {
			if (dayFilter === 'picked' && pickedDayKey) {
				const day = parseDayKey(pickedDayKey);
				next = next.filter((task) => isSameLocalDay(task.windowStartAt, day));
			} else if (dayFilter === 'today' || dayFilter === 'tomorrow') {
				const day = new Date();
				if (dayFilter === 'tomorrow') day.setDate(day.getDate() + 1);
				next = next.filter((task) => isSameLocalDay(task.windowStartAt, day));
			}
		}
		return next;
	}, [
		tasks,
		mode,
		activeTypeFilters,
		useCardView,
		activeDayKey,
		pickedDayKey,
		dayFilter,
		listView,
	]);

	const statusTabCounts = useMemo(() => {
		const counts = {} as Record<StatusTabValue, number>;
		for (const tab of visibleStatusTabs) {
			counts[tab.value] = 0;
		}
		for (const task of scopedTasks) {
			for (const tab of visibleStatusTabs) {
				if (tab.statuses == null) {
					counts[tab.value] += 1;
					continue;
				}
				if (matchesStatusTab(task.status, tab)) {
					counts[tab.value] += 1;
					break;
				}
			}
		}
		return counts;
	}, [scopedTasks, visibleStatusTabs]);

	/** Leave empty tabs: pick the first tab that still has tasks. */
	useEffect(() => {
		if (!showStatusTabs) return;
		if ((statusTabCounts[statusTab] ?? 0) > 0) return;
		const fallback = visibleStatusTabs.find(
			(tab) => (statusTabCounts[tab.value] ?? 0) > 0,
		);
		if (fallback && fallback.value !== statusTab) {
			setStatusTab(fallback.value);
		}
	}, [showStatusTabs, statusTab, statusTabCounts, visibleStatusTabs]);

	const visibleTasks = useMemo(() => {
		let next = scopedTasks;
		if (showStatusTabs) {
			const tab = visibleStatusTabs.find((t) => t.value === statusTab);
			if (tab) {
				next = next.filter((task) => matchesStatusTab(task.status, tab));
			}
		}
		if (mode === 'mine') {
			next = [...next].sort(
				(a, b) => startTimeMs(a.windowStartAt) - startTimeMs(b.windowStartAt),
			);
		}
		return next;
	}, [scopedTasks, showStatusTabs, statusTab, visibleStatusTabs, mode]);

	const crewMemberId = mode === 'mine' ? (user?.id ?? null) : null;
	/** Desktop My Tasks: also include tasks the user created. Mobile stays assigned-only. */
	const createdByUserId =
		mode === 'mine' && !isMobile ? (user?.id ?? null) : null;

	const refreshTasks = useCallback(
		async (signal?: AbortSignal) => {
			if (mode === 'mine' && !crewMemberId) {
				setTasks([]);
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const next = await listTasks(signal, {
					crewMemberId: crewMemberId ?? undefined,
					createdByUserId: createdByUserId ?? undefined,
				});
				if (!signal?.aborted) setTasks(next);
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				notifyError(err instanceof Error ? err.message : 'Failed to load tasks');
			} finally {
				if (!signal?.aborted) setLoading(false);
			}
		},
		[mode, crewMemberId, createdByUserId],
	);

	useEffect(() => {
		// TasksPage is reused across /tasks ↔ /my-tasks (same component type).
		// Drop prior rows immediately so All Tasks never flash inside My Tasks.
		setTasks([]);
		setLoading(true);
		const controller = new AbortController();
		void refreshTasks(controller.signal);
		return () => controller.abort();
	}, [refreshTasks]);

	const ptrEnabled =
		Boolean(isMobile) &&
		(useCardView ||
			(mode === 'all' && (listView === 'day' || listView === 'month')));
	const {
		scrollRef: ptrScrollRef,
		setScrollElement: setPtrScrollElement,
		pullPosition,
		isRefreshing: ptrRefreshing,
	} = useFieldPullToRefresh({
		enabled: ptrEnabled,
		onRefresh: refreshTasks,
	});

	useEffect(() => {
		return () => setPtrScrollElement(null);
	}, [setPtrScrollElement]);

	const handleSaveTask = async (
		values: NewTaskFormValues,
		_addAnother: boolean,
		pendingFiles: File[],
	) => {
		let taskId: number;
		if (editingTask) {
			await updateTask(editingTask.id, values);
			taskId = editingTask.id;
		} else {
			if (!user) {
				throw new Error('Select a user in the sidebar before saving a task');
			}
			const created = await createTask({
				...values,
				createdByUserId: user.id,
			});
			taskId = created.id;
		}

		if (pendingFiles.length > 0) {
			if (!user) {
				throw new Error(
					'Select a user in the sidebar before uploading attachments',
				);
			}
			for (const file of pendingFiles) {
				await uploadAttachment(taskId, file, user.id);
			}
		}

		await refreshTasks();
	};

	const openTask = (id: number) => {
		if (isMobile) {
			navigate(`/task/${id}`);
			return;
		}
		setDetailTaskId(id);
	};

	const handleRowClicked = (event: RowClickedEvent<Task>) => {
		if (event.data?.id != null) {
			openTask(event.data.id);
		}
	};

	const handleEditTask = (task: TaskDetail) => {
		setDetailTaskId(null);
		setEditingTask(task);
	};

	const handleDeleteTask = async (task: TaskDetail) => {
		await deleteTask(task.id);
		setDetailTaskId(null);
		await refreshTasks();
	};

	const handleRestoreTask = async (task: TaskDetail) => {
		await restoreTask(task.id);
		setDetailTaskId(null);
		await refreshTasks();
	};

	const handleCloseEditor = () => {
		setNewTaskOpen(false);
		setEditingTask(null);
	};

	const editorInitialValues = useMemo<NewTaskFormValues | null>(
		() => (editingTask ? taskDetailToFormValues(editingTask) : null),
		[editingTask],
	);

	const editorInitialContactOptions = useMemo(() => {
		if (!editingTask) return null;
		return editingTask.contacts.map((c) => {
			const name = c.name.trim();
			return {
				value: String(c.id),
				label: c.email ? `${name} (${c.email})` : name,
			};
		});
	}, [editingTask]);

	const pageTitle =
		mode === 'mine'
			? pageLabels.mine
			: pageLabels.all === 'All Tasks'
				? 'Tasks'
				: pageLabels.all.replace(/^All /, '');

	const pickedDayLabel =
		dayFilter === 'picked' && pickedDayKey
			? formatPickedDayLabel(pickedDayKey)
			: null;

	return (
		<Box className='tasks-page'>
			{ptrEnabled ? (
				<PullToRefreshIndicator
					pullPosition={pullPosition}
					isRefreshing={ptrRefreshing}
				/>
			) : null}
			<PageHeader
				title={pageTitle}
				left={
					showCalendarViews ? (
						<TaskListViewSwitcher
							value={listView}
							onChange={setListView}
							showWeek={showWeekView}
						/>
					) : null
				}
				right={
					<>
						{mode === 'all' && !isMobile ? (
							<Select
								value={taskTypeFilter}
								onChange={setTaskTypeFilter}
								data={taskTypeFilterOptions}
								allowDeselect={false}
								w={160}
								aria-label='Filter tasks by type'
							/>
						) : null}
					{showDayFilter ? (
						<div
							className='tasks-day-filter'
							role='group'
							aria-label='Filter tasks by start day'
						>
							<Popover
								opened={calendarOpen}
								onChange={setCalendarOpen}
								position='bottom-start'
								withinPortal
							>
								<Popover.Target>
									<button
										type='button'
										className='tasks-day-filter-segment tasks-day-filter-segment--calendar'
										data-selected={
											dayFilter === 'picked' || undefined
										}
										aria-label={
											pickedDayLabel
												? `Showing tasks on ${pickedDayLabel}`
												: 'Pick a date'
										}
										aria-haspopup='dialog'
										aria-expanded={calendarOpen}
										aria-pressed={dayFilter === 'picked'}
										onClick={() => setCalendarOpen((open) => !open)}
									>
										<Calendar size={18} aria-hidden />
										{pickedDayLabel ? (
											<span className='tasks-day-filter-picked-date'>
												{pickedDayLabel}
											</span>
										) : null}
									</button>
								</Popover.Target>
								<Popover.Dropdown p='sm'>
									<DatePicker
										allowDeselect
										value={pickedDayKey}
										firstDayOfWeek={0}
										onChange={(value) => {
											const key =
												value == null
													? null
													: typeof value === 'string'
														? value.slice(0, 10)
														: localDayKey(value);
											if (key) {
												setDayFilter('picked', key);
												setFocusDayKey(key);
												setCalendarOpen(false);
												return;
											}
											setDayFilter('all');
										}}
									/>
								</Popover.Dropdown>
							</Popover>
							{DAY_FILTER_OPTIONS.map((option) => (
								<button
									key={option.value}
									type='button'
									className='tasks-day-filter-segment'
									data-selected={dayFilter === option.value || undefined}
									aria-pressed={dayFilter === option.value}
									onClick={() => {
										setDayFilter(option.value);
									}}
								>
									{option.label}
								</button>
							))}
						</div>
					) : null}
					{!isMobile && mode !== 'mine' && listView === 'day' ? (
						<Menu shadow='md' width={220} closeOnItemClick={false}>
							<Menu.Target>
								<Button
									variant='default'
									color='brand'
									leftSection={<Columns3 size={18} />}
								>
									Columns
								</Button>
							</Menu.Target>
							<Menu.Dropdown>
								{builtinColumnOptions.map((option) => (
									<Menu.Item key={option.field} component='div'>
										<Checkbox
											label={option.headerName}
											checked={visibleColumns.includes(option.field)}
											disabled={option.required}
											onChange={(e) =>
												toggleColumn(option.field, e.currentTarget.checked)
											}
										/>
									</Menu.Item>
								))}
								{customColumnOptions.length > 0 ? (
									<Menu.Divider />
								) : null}
								{customColumnOptions.map((option) => (
									<Menu.Item key={option.field} component='div'>
										<Checkbox
											label={option.headerName}
											checked={visibleColumns.includes(option.field)}
											onChange={(e) =>
												toggleColumn(option.field, e.currentTarget.checked)
											}
										/>
									</Menu.Item>
								))}
							</Menu.Dropdown>
						</Menu>
					) : null}
					{!isMobile ? (
						<Button
							leftSection={<Plus size={18} />}
							onClick={() => {
								setEditingTask(null);
								setNewTaskOpen(true);
							}}
							color='brand'
						>
							New Task
						</Button>
					) : null}
					</>
				}
			/>

			{showStatusTabs ? (
				<div
					className='tasks-status-tabs'
					role='tablist'
					aria-label='Filter tasks by status'
				>
					{visibleStatusTabs.map((tab) => {
						const selected = tab.value === statusTab;
						const count = statusTabCounts[tab.value] ?? 0;
						const empty = count === 0;
						return (
							<button
								key={tab.value}
								type='button'
								role='tab'
								aria-selected={selected}
								aria-disabled={empty || undefined}
								className='tasks-status-tab'
								data-selected={selected || undefined}
								disabled={empty}
								onClick={() => {
									if (!empty) setStatusTab(tab.value);
								}}
							>
								{tab.label} ({count})
							</button>
						);
					})}
				</div>
			) : null}

					{useCardView && taskDayKeys.length > 0 ? (
				<div
					className='tasks-day-chips'
					role='tablist'
					aria-label='Filter tasks by day'
				>
					{taskDayKeys.map((key) => {
						const day = parseDayKey(key);
						const selected = key === activeDayKey;
						return (
							<button
								key={key}
								type='button'
								role='tab'
								aria-selected={selected}
								className='tasks-day-chip'
								data-selected={selected || undefined}
								onClick={() => setSelectedDayKey(key)}
							>
								<span className='tasks-day-chip-month'>
									{MONTH_SHORT[day.getMonth()]}
								</span>
								<span className='tasks-day-chip-date'>{day.getDate()}</span>
								<span className='tasks-day-chip-weekday'>
									{WEEKDAY_SHORT[day.getDay()]}
								</span>
							</button>
						);
					})}
				</div>
			) : null}

			{mode === 'mine' && !user ? (
				<Alert color='yellow' title='Select a user' mb='md'>
					Choose a crew member in the sidebar to see their assigned tasks.
				</Alert>
			) : null}

			{loading && tasks.length === 0 ? (
				<Group justify='center' py='xl'>
					<Loader size='sm' />
				</Group>
			) : useCardView ? (
				<Box ref={ptrScrollRef} className='tasks-cards-wrap'>
					<TaskCards tasks={visibleTasks} onSelect={openTask} />
				</Box>
			) : listView === 'month' ? (
				<Box
					ref={isMobile ? ptrScrollRef : undefined}
					className='tasks-calendar-wrap'
				>
					<TaskMonthView
						tasks={visibleTasks}
						focusDayKey={focusDayKey}
						compact={Boolean(isMobile)}
						onFocusDayKeyChange={setFocusDayKey}
						onDayClick={drillToDay}
					/>
				</Box>
			) : listView === 'week' ? (
				<Box className='tasks-calendar-wrap'>
					<TaskWeekView
						tasks={visibleTasks}
						focusDayKey={focusDayKey}
						onFocusDayKeyChange={setFocusDayKey}
						onDayHeaderClick={drillToDay}
						onTaskClick={openTask}
					/>
				</Box>
			) : (
				<TaskDayGrid
					tasks={visibleTasks}
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					isMobile={isMobile}
					onRowClicked={handleRowClicked}
					ptrEnabled={ptrEnabled}
					onBindViewport={setPtrScrollElement}
				/>
			)}

			<NewTaskModal
				opened={newTaskOpen || editingTask != null}
				onClose={handleCloseEditor}
				initialValues={editorInitialValues}
				fieldDefs={editingTask?.customFieldDefs ?? null}
				initialContactOptions={editorInitialContactOptions}
				taskId={editingTask?.id ?? null}
				onSave={handleSaveTask}
			/>

			<TaskDetailModal
				taskId={detailTaskId}
				opened={!isMobile && detailTaskId != null}
				onClose={() => setDetailTaskId(null)}
				onEdit={handleEditTask}
				onDelete={handleDeleteTask}
				onRestore={handleRestoreTask}
				onStatusChange={(updated) => {
					setTasks((prev) =>
						prev.map((t) =>
							t.id === updated.id ? { ...t, status: updated.status } : t,
						),
					);
				}}
				onCloned={async (newTaskId) => {
					await refreshTasks();
					setDetailTaskId(newTaskId);
				}}
			/>
		</Box>
	);
}
