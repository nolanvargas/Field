import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
	Alert,
	Button,
	Group,
	Loader,
	Box,
	Popover,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { Calendar, Plus } from 'lucide-react';
import type { GridApi, RowClickedEvent } from 'ag-grid-community';
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
import {
	buildUpdateTaskInput,
	taskDetailToFormValues,
} from '../taskDetailForm';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskCards } from '../components/TaskCards';
import { TaskDayGrid } from '../components/TaskDayGrid';
import { TaskDayView } from '../components/TaskDayView';
import { TaskListViewSwitcher } from '../components/TaskListViewSwitcher';
import { TaskMonthView } from '../components/TaskMonthView';
import { TaskWeekView } from '../components/TaskWeekView';
import { PageHeader } from '../components/PageHeader';
import { AgGridLayoutControls } from '../components/AgGridLayoutControls';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import { useFieldPullToRefresh } from '../hooks/useFieldPullToRefresh';
import {
	AG_GRID_MOBILE_MQ,
	getDefaultColDef,
	getTaskColumnDefs,
	getTaskColumnOptions,
	getMobileTaskCardBuiltinColumnOptions,
	readVisibleTaskColumns,
	sanitizeVisibleTaskColumns,
	isBuiltinTaskColumnField,
	type TaskColumnField,
	useAdaptiveGridLayout,
	useBandedColumnWidthSaveBridge,
	usePersistedTaskGridColumns,
	writeVisibleTaskColumns,
	readMobileTaskCardCompact,
	writeMobileTaskCardCompact,
} from '../agGridDefaults';
import { useGridForceFullWidth } from '../agGridLayoutPrefs';
import {
	parseTaskTypeUrlFilter,
	serializeTaskTypeUrlFilter,
} from '../../shared/parseTaskTypeUrlFilter.js';
import { resolveTaskListTypeFilters } from '../../shared/resolveTaskListTypeFilters.js';
import { TaskTypeMultiFilter } from '../components/TaskTypeMultiFilter';
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
import { filterTasksToListView } from '../taskCalendar/filterTasksToListView';
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

function dayFilterForKey(key: string): {
	filter: DayFilterValue;
	picked: string | null;
} {
	const todayKey = localDayKey(new Date());
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const tomorrowKey = localDayKey(tomorrow);
	if (key === todayKey) return { filter: 'today', picked: null };
	if (key === tomorrowKey) return { filter: 'tomorrow', picked: null };
	return { filter: 'picked', picked: key };
}

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

function startTimeMs(iso: string | null): number {
	if (!iso) return Number.POSITIVE_INFINITY;
	const ms = new Date(iso).getTime();
	return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function readStoredListView(mode: 'all' | 'mine'): TaskListView {
	const stored = readPageState(tasksPageKey(mode, 'listView'), 'list');
	return isTaskListView(stored) ? stored : 'list';
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
	const { settings: orgSettings, loading: orgSettingsLoading } = useOrgSettings();
	const [userTypeFilters] = useTaskListTypeFilters();
	const navigate = useNavigate();
	const location = useLocation();
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
	const [contentReady, setContentReady] = useState(false);
	const [visibleColumns, setVisibleColumns] = useState<TaskColumnField[]>(
		readVisibleTaskColumns,
	);
	const [mobileCardCompact, setMobileCardCompact] = useState(
		readMobileTaskCardCompact,
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

	const useMobileTaskCards = Boolean(isMobile);
	const showMobileDayChips = useMobileTaskCards;
	const showCalendarViews = !showMobileDayChips;
	const showWeekView = showCalendarViews && !isMobile;

	const enabledTaskTypeNames = useMemo(
		() =>
			orgSettings.taskTypes
				.filter((t) => t.enabled)
				.map((t) => t.name),
		[orgSettings.taskTypes],
	);

	const taskTypeFilterOptions = useMemo(
		() =>
			orgSettings.taskTypes
				.filter((t) => t.enabled)
				.map((t) => ({ value: t.name, label: t.name, icon: t.icon })),
		[orgSettings.taskTypes],
	);

	const taskColumnOptions = useMemo(
		() =>
			getTaskColumnOptions(
				orgSettings.externalKeyLabel,
				orgSettings.customFieldDefs.task,
			),
		[orgSettings.externalKeyLabel, orgSettings.customFieldDefs.task],
	);

	const taskGridVisibleFields = visibleColumns;

	const columnDefs = useMemo(
		() =>
			getTaskColumnDefs(taskGridVisibleFields, {
				showCancelledTtl: statusTab === 'cancelled',
				externalKeyLabel: orgSettings.externalKeyLabel,
				customFieldDefs: orgSettings.customFieldDefs.task,
			}),
		[
			taskGridVisibleFields,
			statusTab,
			orgSettings.externalKeyLabel,
			orgSettings.customFieldDefs.task,
		],
	);

	const persistTaskGridColumns = !isMobile;
	const [forceFullWidth, setForceFullWidth] = useGridForceFullWidth();
	const { userWidthsSaveRef, onUserColumnWidthsSettled } =
		useBandedColumnWidthSaveBridge();
	const taskGridAdaptiveLayout = useAdaptiveGridLayout(persistTaskGridColumns, {
		forceFullWidth,
		onUserColumnWidthsSettled,
	});
	const taskGridSession = usePersistedTaskGridColumns(
		persistTaskGridColumns,
		taskGridVisibleFields,
		statusTab === 'cancelled',
		taskGridAdaptiveLayout,
		userWidthsSaveRef,
	);

	const builtinColumnOptions = useMemo(
		() => taskColumnOptions.filter((o) => isBuiltinTaskColumnField(o.field)),
		[taskColumnOptions],
	);
	const mobileCardBuiltinColumnOptions = useMemo(
		() => getMobileTaskCardBuiltinColumnOptions(),
		[],
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
	/** Day filter applies in List and Day views (not on mobile day-chip layouts). */
	const showDayFilter =
		showCalendarViews &&
		(listView === 'list' || listView === 'day') &&
		!showMobileDayChips;
	const dayFilterOptions =
		listView === 'day'
			? DAY_FILTER_OPTIONS.filter((option) => option.value !== 'all')
			: DAY_FILTER_OPTIONS;

	useEffect(() => {
		if (!showWeekView && listView === 'week') {
			setListView('list');
		}
	}, [showWeekView, listView, setListView]);

	useEffect(() => {
		if (showMobileDayChips) return;
		if (listView !== 'list' && listView !== 'day') return;
		if (dayFilter === 'picked' && pickedDayKey) {
			setFocusDayKey(pickedDayKey);
		} else if (dayFilter === 'today') {
			setFocusDayKey(localDayKey(new Date()));
		} else if (dayFilter === 'tomorrow') {
			const d = new Date();
			d.setDate(d.getDate() + 1);
			setFocusDayKey(localDayKey(d));
		}
	}, [listView, dayFilter, pickedDayKey, showMobileDayChips, setFocusDayKey]);

	useEffect(() => {
		if (listView !== 'day' || showMobileDayChips || dayFilter !== 'all') return;
		const { filter, picked } = dayFilterForKey(focusDayKey);
		setDayFilter(filter, picked);
	}, [listView, dayFilter, focusDayKey, showMobileDayChips, setDayFilter]);

	const handleFocusDayKeyChange = useCallback(
		(key: string) => {
			setFocusDayKey(key);
			if (listView === 'day') {
				const { filter, picked } = dayFilterForKey(key);
				setDayFilter(filter, picked);
			}
		},
		[listView, setFocusDayKey, setDayFilter],
	);

	const drillToDay = useCallback(
		(dayKey: string) => {
			setFocusDayKey(dayKey);
			const { filter, picked } = dayFilterForKey(dayKey);
			setDayFilter(filter, picked);
			setListView('day');
		},
		[setFocusDayKey, setDayFilter, setListView],
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
		if (!showMobileDayChips) return [] as string[];
		const keys = new Set<string>();
		for (const task of tasks) {
			const key = dayKeyFromIso(task.windowStartAt);
			if (key) keys.add(key);
		}
		if (dayFromQuery) keys.add(dayFromQuery);
		return [...keys].sort();
	}, [tasks, showMobileDayChips, dayFromQuery]);

	/** Resolve day on render so content never flashes every day before useEffect runs. */
	const activeDayKey = useMemo(() => {
		if (!showMobileDayChips || taskDayKeys.length === 0) return null;
		if (dayFromQuery && taskDayKeys.includes(dayFromQuery)) return dayFromQuery;
		if (selectedDayKey && taskDayKeys.includes(selectedDayKey)) {
			return selectedDayKey;
		}
		const todayKey = localDayKey(new Date());
		if (taskDayKeys.includes(todayKey)) return todayKey;
		return taskDayKeys[0] ?? null;
	}, [showMobileDayChips, taskDayKeys, dayFromQuery, selectedDayKey]);

	const dayChipsRef = useRef<HTMLDivElement | null>(null);
	const dayChipScrollSmooth = useRef(false);

	const selectDayKey = useCallback((key: string) => {
		dayChipScrollSmooth.current = true;
		setSelectedDayKey(key);
	}, []);

	useEffect(() => {
		if (!showMobileDayChips || !activeDayKey) return;
		const chip = dayChipsRef.current?.querySelector<HTMLElement>(
			`[data-day-key="${activeDayKey}"]`,
		);
		chip?.scrollIntoView({
			inline: 'center',
			block: 'nearest',
			behavior: dayChipScrollSmooth.current ? 'smooth' : 'instant',
		});
		dayChipScrollSmooth.current = false;
	}, [showMobileDayChips, activeDayKey, taskDayKeys]);

	useEffect(() => {
		if (!showMobileDayChips || taskDayKeys.length === 0) {
			setSelectedDayKey(null);
			return;
		}
		setSelectedDayKey(activeDayKey);
	}, [showMobileDayChips, taskDayKeys, activeDayKey]);

	const taskTypeFilters = useMemo(
		() =>
			mode === 'all'
				? parseTaskTypeUrlFilter(
						searchParams.get('type'),
						enabledTaskTypeNames,
					)
				: [],
		[mode, searchParams, enabledTaskTypeNames],
	);

	const activeTypeFilters = useMemo(
		() =>
			resolveTaskListTypeFilters({
				userFilters: userTypeFilters,
				urlTypeFilters: taskTypeFilters,
				enabledTypeNames: enabledTaskTypeNames,
			}),
		[userTypeFilters, taskTypeFilters, enabledTaskTypeNames],
	);

	const pageLabels = useMemo(
		() => taskListPageLabels(activeTypeFilters, orgSettings.taskTypes),
		[activeTypeFilters, orgSettings.taskTypes],
	);

	const setTaskTypeFilters = (next: string[]) => {
		const serialized = serializeTaskTypeUrlFilter(
			next.filter((name) => enabledTaskTypeNames.includes(name)),
		);
		setSearchParams(
			(prev) => {
				const params = new URLSearchParams(prev);
				if (!serialized) {
					params.delete('type');
				} else {
					params.set('type', serialized);
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
		if (showMobileDayChips && activeDayKey) {
			const day = parseDayKey(activeDayKey);
			next = next.filter((task) => isSameLocalDay(task.windowStartAt, day));
		} else if (listView === 'list') {
			if (dayFilter === 'picked' && pickedDayKey) {
				const day = parseDayKey(pickedDayKey);
				next = next.filter((task) => isSameLocalDay(task.windowStartAt, day));
			} else if (dayFilter === 'today' || dayFilter === 'tomorrow') {
				const day = new Date();
				if (dayFilter === 'tomorrow') day.setDate(day.getDate() + 1);
				next = next.filter((task) => isSameLocalDay(task.windowStartAt, day));
			}
		} else if (listView === 'day') {
			const day = parseDayKey(focusDayKey);
			next = next.filter((task) => isSameLocalDay(task.windowStartAt, day));
		} else if (listView === 'week' || listView === 'month') {
			next = filterTasksToListView(next, listView, focusDayKey);
		}
		return next;
	}, [
		tasks,
		mode,
		activeTypeFilters,
		showMobileDayChips,
		activeDayKey,
		pickedDayKey,
		dayFilter,
		listView,
		focusDayKey,
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

	/** Resolve empty stored tabs before paint so the grid never flashes with zero rows. */
	const effectiveStatusTab = useMemo(() => {
		if (!showStatusTabs) return statusTab;
		if ((statusTabCounts[statusTab] ?? 0) > 0) return statusTab;
		return (
			visibleStatusTabs.find((tab) => (statusTabCounts[tab.value] ?? 0) > 0)
				?.value ?? statusTab
		);
	}, [showStatusTabs, statusTab, statusTabCounts, visibleStatusTabs]);

	useEffect(() => {
		if (!showStatusTabs || effectiveStatusTab === statusTab) return;
		setStatusTab(effectiveStatusTab);
	}, [showStatusTabs, effectiveStatusTab, statusTab, setStatusTab]);

	const visibleTasks = useMemo(() => {
		let next = scopedTasks;
		if (showStatusTabs) {
			const tab = visibleStatusTabs.find((t) => t.value === effectiveStatusTab);
			if (tab) {
				next = next.filter((task) => matchesStatusTab(task.status, tab));
			}
		}
		if (mode === 'mine' || useMobileTaskCards) {
			next = [...next].sort(
				(a, b) => startTimeMs(a.windowStartAt) - startTimeMs(b.windowStartAt),
			);
		}
		return next;
	}, [
		scopedTasks,
		showStatusTabs,
		effectiveStatusTab,
		visibleStatusTabs,
		mode,
		useMobileTaskCards,
	]);

	const mineUserId = mode === 'mine' ? (user?.id ?? null) : null;

	useEffect(() => {
		if (contentReady) return;
		if (loading || orgSettingsLoading) return;
		setContentReady(true);
	}, [contentReady, loading, orgSettingsLoading]);

	const showContentLoader = !contentReady;

	const refreshTasks = useCallback(
		async (signal?: AbortSignal) => {
			if (mode === 'mine' && !mineUserId) {
				setTasks([]);
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const next = await listTasks(signal, {
					crewMemberId: mineUserId ?? undefined,
					createdByUserId: mineUserId ?? undefined,
				});
				if (!signal?.aborted) setTasks(next);
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				notifyError(err instanceof Error ? err.message : 'Failed to load tasks');
			} finally {
				if (!signal?.aborted) setLoading(false);
			}
		},
		[mode, mineUserId],
	);

	useEffect(() => {
		// TasksPage is reused across /tasks ↔ /my-tasks (same component type).
		// Drop prior rows immediately so All Tasks never flash inside My Tasks.
		setTasks([]);
		setLoading(true);
		setContentReady(false);
		const controller = new AbortController();
		void refreshTasks(controller.signal);
		return () => controller.abort();
	}, [refreshTasks]);

	const ptrEnabled = useMobileTaskCards;
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

	const prevPathRef = useRef(location.pathname);
	useEffect(() => {
		const prev = prevPathRef.current;
		prevPathRef.current = location.pathname;
		if (!useMobileTaskCards) return;
		const wasOnTask = /^\/task\/\d+/.test(prev);
		const onMyTasks = location.pathname === '/my-tasks';
		const onAllTasks = location.pathname === '/tasks';
		if (wasOnTask && (onMyTasks || onAllTasks)) {
			void refreshTasks();
		}
	}, [location.pathname, useMobileTaskCards, refreshTasks]);

	const handleSaveTask = async (
		values: NewTaskFormValues,
		_addAnother: boolean,
		pendingFiles: File[],
		customFieldPatch?: {
			touchedCustomFieldSlots: number[];
			clearedCustomFieldSlots: number[];
			customFields: Record<string, import('../types/task').CustomFieldValue>;
		},
	) => {
		let taskId: number;
		if (editingTask) {
			await updateTask(
				editingTask.id,
				buildUpdateTaskInput(values, customFieldPatch),
			);
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

	const taskGridApiRef = useRef<GridApi | null>(null);

	useEffect(() => {
		const api = taskGridApiRef.current;
		if (!api || !persistTaskGridColumns) return;
		taskGridAdaptiveLayout.apply(api, {
			debugReason: `forceFullWidth-toggle:${forceFullWidth}`,
		});
	}, [forceFullWidth, persistTaskGridColumns, taskGridAdaptiveLayout.apply]);

	const showGridLayoutControls =
		persistTaskGridColumns && listView === 'list';
	const showMobileCardSettings = useMobileTaskCards;

	const toggleMobileCardCompact = useCallback(() => {
		setMobileCardCompact((prev) => {
			const next = !prev;
			writeMobileTaskCardCompact(next);
			return next;
		});
	}, []);

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
					<>
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
						{showGridLayoutControls ? (
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
						{showCalendarViews ? (
							<TaskListViewSwitcher
								value={listView}
								onChange={setListView}
								showWeek={showWeekView}
							/>
						) : null}
					</>
				}
				right={
					<>
						{mode === 'all' && !isMobile ? (
							<TaskTypeMultiFilter
								value={taskTypeFilters}
								onChange={setTaskTypeFilters}
								options={taskTypeFilterOptions}
								width={160}
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
								<Popover.Dropdown p='sm' className='tasks-day-filter-calendar'>
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
							{dayFilterOptions.map((option) => (
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
					{showMobileCardSettings ? (
						<AgGridLayoutControls
							showFullWidth={false}
							compact={mobileCardCompact}
							onToggleCompact={toggleMobileCardCompact}
							columnOptions={{
								builtin: mobileCardBuiltinColumnOptions,
								custom: customColumnOptions,
								visibleColumns,
								onToggleColumn: toggleColumn,
							}}
						/>
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

					{showMobileDayChips && taskDayKeys.length > 0 ? (
				<div
					ref={dayChipsRef}
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
								data-day-key={key}
								data-selected={selected || undefined}
								onClick={() => selectDayKey(key)}
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

			{showContentLoader ? (
				<Group justify='center' py='xl'>
					<Loader size='sm' />
				</Group>
			) : useMobileTaskCards ? (
				<Box ref={ptrScrollRef} className='tasks-cards-wrap'>
					<TaskCards
						tasks={visibleTasks}
						onSelect={openTask}
						visibleFields={visibleColumns}
						columnOptions={taskColumnOptions}
						customFieldDefs={orgSettings.customFieldDefs.task}
						compact={mobileCardCompact}
					/>
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
			) : listView === 'day' ? (
				<Box className='tasks-calendar-wrap'>
					<TaskDayView
						tasks={visibleTasks}
						focusDayKey={focusDayKey}
						onFocusDayKeyChange={handleFocusDayKeyChange}
						onTaskClick={openTask}
					/>
				</Box>
			) : (
				<TaskDayGrid
					tasks={visibleTasks}
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					loading={loading}
					onRowClicked={handleRowClicked}
					ptrEnabled={ptrEnabled}
					onBindViewport={setPtrScrollElement}
					gridSession={taskGridSession}
					adaptiveLayout={taskGridAdaptiveLayout}
					onBindGridApi={(api) => {
						taskGridApiRef.current = api;
					}}
				/>
			)}

			<NewTaskModal
				opened={newTaskOpen || editingTask != null}
				onClose={handleCloseEditor}
				initialValues={editorInitialValues}
				customFieldDefsSnapshot={editingTask?.customFieldDefsSnapshot ?? null}
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
