import { useCallback, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
	Alert,
	Badge,
	Box,
	Button,
	Checkbox,
	Code,
	Group,
	SegmentedControl,
	Select,
	Stack,
	Text,
	Title,
} from '@mantine/core';
import { RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { TaskStatusBadge } from '../components/TaskStatusBadge';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { hasPermission, PERMISSIONS } from '../../shared/permissions.js';
import { STATUS_TRANSITIONS } from '../../shared/statusTransitions.js';
import type { TaskStatus } from '../types/task';
import '../styles/statusTransitionsPrototype.css';

const ALL_STATUSES: TaskStatus[] = [
	'Unassigned',
	'Assigned',
	'In Progress',
	'Completed',
	'Failed',
	'Undetermined',
	'Cancelled',
];

type TransitionMap = Record<string, string[]>;

type ViewMode = 'matrix' | 'list' | 'flow';

type StatusMeta = {
	role: 'initial' | 'open' | 'active' | 'outcome' | 'system';
	hint: string;
	manualOnly: boolean;
};

const STATUS_META: Record<TaskStatus, StatusMeta> = {
	Unassigned: {
		role: 'initial',
		hint: 'Default for new tasks without crew',
		manualOnly: true,
	},
	Assigned: {
		role: 'open',
		hint: 'Crew assigned, work not started',
		manualOnly: true,
	},
	'In Progress': {
		role: 'active',
		hint: 'Crew start also sets this automatically',
		manualOnly: false,
	},
	Completed: {
		role: 'outcome',
		hint: 'Success terminal; crew end can set this',
		manualOnly: false,
	},
	Failed: {
		role: 'outcome',
		hint: 'Failure terminal; crew end can set this',
		manualOnly: false,
	},
	Undetermined: {
		role: 'outcome',
		hint: 'Mixed crew outcomes; restore lands here',
		manualOnly: false,
	},
	Cancelled: {
		role: 'system',
		hint: 'Set by cancel only — no manual transitions out',
		manualOnly: false,
	},
};

const FLOW_LANES: TaskStatus[][] = [
	['Unassigned'],
	['Assigned'],
	['In Progress'],
	['Completed', 'Failed', 'Undetermined'],
	['Cancelled'],
];

function cloneTransitionMap(source: TransitionMap): TransitionMap {
	const next: TransitionMap = {};
	for (const status of ALL_STATUSES) {
		next[status] = [...(source[status] ?? [])];
	}
	return next;
}

function normalizeTransitionMap(raw: TransitionMap): TransitionMap {
	const next = cloneTransitionMap({});
	for (const from of ALL_STATUSES) {
		const targets = raw[from] ?? [];
		next[from] = [...new Set(targets.filter((to) => to !== from && ALL_STATUSES.includes(to as TaskStatus)))];
	}
	return next;
}

function toggleTarget(map: TransitionMap, from: TaskStatus, to: TaskStatus): TransitionMap {
	const next = cloneTransitionMap(map);
	const set = new Set(next[from]);
	if (set.has(to)) set.delete(to);
	else set.add(to);
	next[from] = [...set];
	return next;
}

function validateTransitions(map: TransitionMap): string[] {
	const warnings: string[] = [];

	if ((map.Cancelled ?? []).length > 0) {
		warnings.push('Cancelled should not have outgoing manual transitions.');
	}

	for (const status of ALL_STATUSES) {
		if (status === 'Cancelled') continue;
		const outgoing = map[status] ?? [];
		if (outgoing.length === 0) {
			warnings.push(`${status} has no allowed next statuses — tasks could get stuck.`);
		}
	}

	const reachable = new Set<TaskStatus>(['Unassigned']);
	let changed = true;
	while (changed) {
		changed = false;
		for (const from of reachable) {
			for (const to of map[from] ?? []) {
				if (!reachable.has(to as TaskStatus)) {
					reachable.add(to as TaskStatus);
					changed = true;
				}
			}
		}
	}

	for (const status of ALL_STATUSES) {
		if (status === 'Cancelled') continue;
		if (!reachable.has(status)) {
			warnings.push(`${status} is not reachable from Unassigned through your graph.`);
		}
	}

	if (!(map.Unassigned ?? []).includes('Assigned')) {
		warnings.push('Unassigned → Assigned is expected so tasks can enter the workflow.');
	}

	return warnings;
}

function roleBadge(role: StatusMeta['role']) {
	switch (role) {
		case 'initial':
			return 'Initial';
		case 'open':
			return 'Open';
		case 'active':
			return 'Active';
		case 'outcome':
			return 'Outcome';
		case 'system':
			return 'System';
	}
}

function TransitionMatrix({
	map,
	onToggle,
}: {
	map: TransitionMap;
	onToggle: (from: TaskStatus, to: TaskStatus) => void;
}) {
	return (
		<Box className='field-status-transitions-matrix-wrap'>
			<table className='field-status-transitions-matrix'>
				<thead>
					<tr>
						<th scope='col'>From ↓ / To →</th>
						{ALL_STATUSES.map((to) => (
							<th key={to} scope='col'>
								<span className='field-status-transitions-matrix-col-label'>{to}</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{ALL_STATUSES.map((from) => (
						<tr key={from}>
							<th scope='row'>
								<TaskStatusBadge status={from} />
							</th>
							{ALL_STATUSES.map((to) => {
								const disabled = from === to || from === 'Cancelled';
								const checked = (map[from] ?? []).includes(to);
								return (
									<td key={to} data-disabled={disabled || undefined}>
										<Checkbox
											aria-label={`${from} to ${to}`}
											checked={checked}
											disabled={disabled}
											onChange={() => onToggle(from, to)}
										/>
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</Box>
	);
}

function TransitionList({
	map,
	onToggle,
}: {
	map: TransitionMap;
	onToggle: (from: TaskStatus, to: TaskStatus) => void;
}) {
	return (
		<Stack gap='sm' maw={560} w='100%'>
			{ALL_STATUSES.map((from) => (
				<Box key={from} className='field-status-transitions-list-row'>
					<Group gap='xs' mb={6} wrap='nowrap'>
						<TaskStatusBadge status={from} />
						<Text size='xs' c='dimmed'>
							{STATUS_META[from].hint}
						</Text>
					</Group>
					<Text size='sm' fw={500} mb={6}>
						Can move to
					</Text>
					<Group gap='xs'>
						{ALL_STATUSES.filter((to) => to !== from).map((to) => {
							const checked = (map[from] ?? []).includes(to);
							const disabled = from === 'Cancelled';
							return (
								<Button
									key={to}
									size='compact-sm'
									variant={checked ? 'filled' : 'default'}
									disabled={disabled}
									onClick={() => onToggle(from, to)}
									className='field-status-transitions-chip'
								>
									{to}
								</Button>
							);
						})}
					</Group>
				</Box>
			))}
		</Stack>
	);
}

function TransitionFlow({ map }: { map: TransitionMap }) {
	const nodePositions = useMemo(() => {
		const positions = new Map<TaskStatus, { x: number; y: number }>();
		FLOW_LANES.forEach((lane, laneIndex) => {
			lane.forEach((status, rowIndex) => {
				positions.set(status, {
					x: 24 + laneIndex * 148,
					y: 28 + rowIndex * 72,
				});
			});
		});
		return positions;
	}, []);

	const edges = useMemo(() => {
		const lines: { from: TaskStatus; to: TaskStatus }[] = [];
		for (const from of ALL_STATUSES) {
			for (const to of map[from] ?? []) {
				lines.push({ from, to: to as TaskStatus });
			}
		}
		return lines;
	}, [map]);

	const width = FLOW_LANES.length * 148 + 48;
	const height =
		Math.max(...FLOW_LANES.map((lane) => lane.length)) * 72 + 56;

	return (
		<Box className='field-status-transitions-flow-wrap'>
			<svg
				className='field-status-transitions-flow-svg'
				viewBox={`0 0 ${width} ${height}`}
				role='img'
				aria-label='Status transition flow diagram'
			>
				{edges.map(({ from, to }) => {
					const start = nodePositions.get(from);
					const end = nodePositions.get(to);
					if (!start || !end) return null;
					const x1 = start.x + 68;
					const y1 = start.y + 16;
					const x2 = end.x;
					const y2 = end.y + 16;
					const midX = (x1 + x2) / 2;
					return (
						<path
							key={`${from}-${to}`}
							d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
							className='field-status-transitions-flow-edge'
							data-back={start.x > end.x ? 'true' : undefined}
						/>
					);
				})}
			</svg>
			<div
				className='field-status-transitions-flow-nodes'
				style={{ width, height }}
			>
				{FLOW_LANES.map((lane, laneIndex) => (
					<div
						key={laneIndex}
						className='field-status-transitions-flow-lane'
						style={{ left: 24 + laneIndex * 148 }}
					>
						{lane.map((status, rowIndex) => (
							<div
								key={status}
								className='field-status-transitions-flow-node'
								style={{ top: 28 + rowIndex * 72 }}
							>
								<TaskStatusBadge status={status} />
								<Text size='xs' c='dimmed' mt={4}>
									{roleBadge(STATUS_META[status].role)}
								</Text>
							</div>
						))}
					</div>
				))}
			</div>
		</Box>
	);
}

export function StatusTransitionsPrototypePage() {
	const { user, loading: userLoading } = useCurrentUser();
	const { settings: orgSettings } = useOrgSettings();
	const [viewMode, setViewMode] = useState<ViewMode>('matrix');
	const [scope, setScope] = useState('__default__');
	const [defaultMap, setDefaultMap] = useState<TransitionMap>(() =>
		normalizeTransitionMap(STATUS_TRANSITIONS),
	);
	const [overrides, setOverrides] = useState<Record<string, TransitionMap>>({});

	const scopeOptions = useMemo(
		() => [
			{ value: '__default__', label: 'All task types (default)' },
			...orgSettings.taskTypes
				.filter((t) => t.enabled && t.name.trim())
				.map((t) => ({ value: t.name, label: t.name })),
		],
		[orgSettings.taskTypes],
	);

	const activeMap = useMemo(() => {
		if (scope === '__default__') return defaultMap;
		return overrides[scope] ?? defaultMap;
	}, [defaultMap, overrides, scope]);

	const setActiveMap = useCallback(
		(next: TransitionMap) => {
			const normalized = normalizeTransitionMap(next);
			if (scope === '__default__') {
				setDefaultMap(normalized);
				return;
			}
			setOverrides((prev) => ({ ...prev, [scope]: normalized }));
		},
		[scope],
	);

	const handleToggle = useCallback(
		(from: TaskStatus, to: TaskStatus) => {
			setActiveMap(toggleTarget(activeMap, from, to));
		},
		[activeMap, setActiveMap],
	);

	const resetScope = useCallback(() => {
		if (scope === '__default__') {
			setDefaultMap(normalizeTransitionMap(STATUS_TRANSITIONS));
			return;
		}
		setOverrides((prev) => {
			const next = { ...prev };
			delete next[scope];
			return next;
		});
	}, [scope]);

	const warnings = useMemo(() => validateTransitions(activeMap), [activeMap]);

	const exportPayload = useMemo(
		() => ({
			default: defaultMap,
			overrides,
		}),
		[defaultMap, overrides],
	);

	if (userLoading) return null;

	if (!hasPermission(user?.permissions, PERMISSIONS.manageOrg)) {
		return <Navigate to='/' replace />;
	}

	return (
		<div className='field-status-transitions-prototype'>
			<PageHeader
				title='Status transitions'
				right={
					<Button
						variant='light'
						leftSection={<RotateCcw size={14} />}
						onClick={resetScope}
					>
						Reset scope
					</Button>
				}
			/>

			<Stack gap='md' align='flex-start' className='field-status-transitions-stack'>
				<Box maw={560} w='100%'>
					<Alert color='yellow' title='Dev prototype — not saved'>
						This page explores UI for org-configured status transitions. Edits stay
						in the browser only; production still uses{' '}
						<Code>shared/statusTransitions.js</Code>.
					</Alert>
				</Box>

				<Box maw={560} w='100%'>
					<Text size='sm' c='dimmed' mb='md'>
						Three views of the same data: a checkbox matrix (spreadsheet-style), a
						per-status list (form-style), and a read-only flow diagram. Pick a task
						type scope to prototype per-type overrides on top of a default graph.
					</Text>

					<Stack gap='md'>
						<Box maw={420}>
							<Select
								label='Applies to'
								description='Default graph for every type; overrides replace it for one type only.'
								data={scopeOptions}
								value={scope}
								onChange={(value) => setScope(value ?? '__default__')}
							/>
						</Box>

						<Box w='fit-content'>
							<SegmentedControl
								value={viewMode}
								onChange={(value) => setViewMode(value as ViewMode)}
								data={[
									{ label: 'Matrix', value: 'matrix' },
									{ label: 'List', value: 'list' },
									{ label: 'Flow', value: 'flow' },
								]}
							/>
						</Box>

						<Box>
							<Title order={5} mb='xs'>
								Status roles
							</Title>
							<Group gap='xs'>
								{(['initial', 'open', 'active', 'outcome', 'system'] as const).map(
									(role) => (
										<Badge key={role} variant='light'>
											{roleBadge(role)}
										</Badge>
									),
								)}
							</Group>
							<Text size='xs' c='dimmed' mt={6}>
								Future backend would map each status to a semantic role so crew
								automation and cancel/restore keep working even when labels change.
							</Text>
						</Box>
					</Stack>
				</Box>

				<Box maw={560} w='100%'>
					{warnings.length > 0 ? (
						<Alert color='orange' title='Validation'>
							<Stack gap={4}>
								{warnings.map((warning) => (
									<Text key={warning} size='sm'>
										{warning}
									</Text>
								))}
							</Stack>
						</Alert>
					) : (
						<Alert color='green' title='Validation'>
							No issues detected for this graph.
						</Alert>
					)}
				</Box>

				<Box className='field-status-transitions-editor'>
					{viewMode === 'matrix' ? (
						<TransitionMatrix map={activeMap} onToggle={handleToggle} />
					) : null}
					{viewMode === 'list' ? (
						<TransitionList map={activeMap} onToggle={handleToggle} />
					) : null}
					{viewMode === 'flow' ? <TransitionFlow map={activeMap} /> : null}
				</Box>

				<Box maw={560} w='100%'>
					<Title order={5} mb='xs'>
						Export preview
					</Title>
					<Text size='sm' c='dimmed' mb='sm'>
						Shape we would persist: a default transition map plus optional
						per-task-type overrides.
					</Text>
					<Code block className='field-status-transitions-export'>
						{JSON.stringify(exportPayload, null, 2)}
					</Code>
				</Box>
			</Stack>
		</div>
	);
}
