import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { OrgCustomFieldDef } from '../api/orgSettings';
import type { TaskColumnField, TaskColumnOption } from '../agGridDefaults';
import { formatShortName, formatShortNameList } from '../formatName';
import {
	isTaskColumnValueEmpty,
	labeledMobileTaskCardFields,
	renderTaskColumnValue,
	taskCardHeaderLabel,
	taskCardShowsHeader,
	taskCardShowsWindowRow,
	taskColumnHeaderName,
	taskDescriptionPlainText,
	taskShowsDescriptionBlock,
} from '../taskColumnDisplay';
import type { Task } from '../types/task';
import { RelativeTime } from './RelativeTime';
import { TaskStatusBadge } from './TaskStatusBadge';

function TaskWindow({
	start,
	end,
	showStart,
	showEnd,
	compact = false,
}: {
	start: string | null;
	end: string | null;
	showStart: boolean;
	showEnd: boolean;
	compact?: boolean;
}) {
	const timeVariant = compact ? 'compactAgo' : 'shortWithAgo';
	const hasStart = showStart && Boolean(start?.trim());
	const hasEnd = showEnd && Boolean(end?.trim());
	if (hasStart && hasEnd) {
		return (
			<>
				<RelativeTime value={start} variant={timeVariant} />
				{' – '}
				<RelativeTime value={end} variant={timeVariant} />
			</>
		);
	}
	if (hasStart) {
		return <RelativeTime value={start} variant={timeVariant} />;
	}
	if (hasEnd) {
		return <RelativeTime value={end} variant={timeVariant} />;
	}
	return null;
}

function CardRow({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className='task-card-row'>
			<span className='task-card-row-label'>{label}</span>
			<span className='task-card-row-value'>{value}</span>
		</div>
	);
}

function TaskCard({
	task,
	onSelect,
	visibleFields,
	columnOptions,
	customFieldDefs,
	compact,
}: {
	task: Task;
	onSelect: (taskId: number) => void;
	visibleFields: TaskColumnField[];
	columnOptions: TaskColumnOption[];
	customFieldDefs: OrgCustomFieldDef[];
	compact: boolean;
}) {
	const cardRef = useRef<HTMLButtonElement>(null);
	const descriptionRef = useRef<HTMLDivElement>(null);
	const [clipped, setClipped] = useState(false);
	const labeledFields = labeledMobileTaskCardFields(
		visibleFields,
		columnOptions,
	);
	const showDescription = taskShowsDescriptionBlock(task, visibleFields);
	const showHeader = taskCardShowsHeader(visibleFields);
	const headerLabel = taskCardHeaderLabel(task, visibleFields);

	useLayoutEffect(() => {
		if (!showDescription) {
			setClipped(false);
			return;
		}
		const card = cardRef.current;
		if (!card) return;

		const update = () => {
			const desc = descriptionRef.current;
			setClipped(
				Boolean(desc && desc.scrollHeight > desc.clientHeight + 1),
			);
		};

		update();
		const ro = new ResizeObserver(update);
		ro.observe(card);
		if (descriptionRef.current) ro.observe(descriptionRef.current);
		return () => ro.disconnect();
	}, [task.description, showDescription]);

	const cardClassName = [
		'task-card',
		compact ? 'task-card--compact' : '',
		clipped ? 'task-card--clipped' : '',
		task.myLive ? 'task-card--live' : '',
	]
		.filter(Boolean)
		.join(' ');

	const visible = new Set(visibleFields);

	return (
		<div className='task-card-frame'>
			<button
				ref={cardRef}
				type='button'
				className={cardClassName}
				onClick={() => onSelect(task.id)}
			>
				<header className='task-card-header'>
					<span className='task-card-type'>
						{showHeader ? headerLabel : null}
					</span>
					<TaskStatusBadge
						status={task.status}
						variant={compact ? 'dot' : 'default'}
					/>
				</header>

				<div className='task-card-meta'>
					{visible.has('jobTitle') &&
					!isTaskColumnValueEmpty(task, 'jobTitle', {}) ? (
						<p className='task-card-job-title'>
							{task.jobTitle!.trim()}
						</p>
					) : null}
					{visible.has('destinationAddress') &&
					!isTaskColumnValueEmpty(task, 'destinationAddress', {}) ? (
						<CardRow
							label='Location'
							value={task.destinationAddress!.trim()}
						/>
					) : null}
					{taskCardShowsWindowRow(task, visibleFields) ? (
						<CardRow
							label='Window'
							value={
								<TaskWindow
									start={task.windowStartAt}
									end={task.windowEndAt}
									showStart={visible.has('windowStartAt')}
									showEnd={visible.has('windowEndAt')}
									compact={compact}
								/>
							}
						/>
					) : null}
					{visible.has('createdByName') &&
					!isTaskColumnValueEmpty(task, 'createdByName', {}) ? (
						<CardRow
							label='Created by'
							value={formatShortName(task.createdByName!)}
						/>
					) : null}
					{visible.has('crewName') &&
					!isTaskColumnValueEmpty(task, 'crewName', {}) ? (
						<CardRow
							label='Crew'
							value={formatShortNameList(task.crewName!)}
						/>
					) : null}
					{labeledFields.map((field) => {
						if (
							isTaskColumnValueEmpty(task, field, {
								customFieldDefs,
							})
						) {
							return null;
						}
						return (
							<CardRow
								key={field}
								label={taskColumnHeaderName(
									field,
									columnOptions,
								)}
								value={renderTaskColumnValue(task, field, {
									customFieldDefs,
								})}
							/>
						);
					})}
				</div>

				{showDescription ? (
					<div
						ref={descriptionRef}
						className='task-card-description-wrap'
					>
						<p className='task-card-description'>
							{taskDescriptionPlainText(task)}
						</p>
					</div>
				) : null}
			</button>
		</div>
	);
}

export function TaskCards({
	tasks,
	onSelect,
	visibleFields,
	columnOptions,
	customFieldDefs,
	compact = false,
	emptyMessage = 'No tasks for this day.',
}: {
	tasks: Task[];
	onSelect: (taskId: number) => void;
	visibleFields: TaskColumnField[];
	columnOptions: TaskColumnOption[];
	customFieldDefs: OrgCustomFieldDef[];
	compact?: boolean;
	emptyMessage?: string;
}) {
	if (tasks.length === 0) {
		return <p className='task-cards-empty'>{emptyMessage}</p>;
	}

	const listClassName = ['task-cards', compact ? 'task-cards--compact' : '']
		.filter(Boolean)
		.join(' ');

	return (
		<div className={listClassName}>
			{tasks.map((task) => (
				<TaskCard
					key={task.id}
					task={task}
					onSelect={onSelect}
					visibleFields={visibleFields}
					columnOptions={columnOptions}
					customFieldDefs={customFieldDefs}
					compact={compact}
				/>
			))}
		</div>
	);
}
