import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, TextInput, Tooltip } from '@mantine/core';
import { CornerDownLeft } from 'lucide-react';
import { lookupTask } from '../api/tasks';

const ERROR_TOOLTIP_MS = 3000;

export interface TaskSearchInputProps {
	variant?: 'sidebar' | 'light';
	onFound: (taskId: number) => void;
}

export function TaskSearchInput({
	variant = 'sidebar',
	onFound,
}: TaskSearchInputProps) {
	const [query, setQuery] = useState('');
	const [loading, setLoading] = useState(false);
	const [errorQuery, setErrorQuery] = useState<string | null>(null);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const clearError = useCallback(() => {
		if (errorTimerRef.current) {
			clearTimeout(errorTimerRef.current);
			errorTimerRef.current = null;
		}
		setTooltipOpen(false);
		setErrorQuery(null);
	}, []);

	const showError = useCallback((failedQuery: string) => {
		clearError();
		setErrorQuery(failedQuery);
		setTooltipOpen(true);
		errorTimerRef.current = setTimeout(() => {
			setTooltipOpen(false);
			setErrorQuery(null);
			errorTimerRef.current = null;
		}, ERROR_TOOLTIP_MS);
	}, [clearError]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
		};
	}, []);

	const submit = useCallback(async () => {
		const trimmed = query.trim();
		if (!trimmed || loading) return;

		clearError();
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setLoading(true);
		try {
			const { taskId } = await lookupTask(trimmed, controller.signal);
			setQuery('');
			onFound(taskId);
		} catch (err: unknown) {
			if (controller.signal.aborted) return;
			const message =
				err instanceof Error ? err.message : 'Task lookup failed';
			if (message.toLowerCase().includes('not found')) {
				showError(trimmed);
				requestAnimationFrame(() => inputRef.current?.focus());
			}
		} finally {
			if (!controller.signal.aborted) {
				setLoading(false);
			}
		}
	}, [query, loading, clearError, onFound, showError]);

	const inputClass =
		variant === 'sidebar'
			? 'field-task-search-input field-user-select-input'
			: 'field-task-search-input field-user-select-input--light';

	return (
		<div className='field-task-search-nav'>
			<TextInput
				ref={inputRef}
				size='sm'
				placeholder='Search task'
				value={query}
				onChange={(e) => setQuery(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						void submit();
					}
				}}
				className={inputClass}
				classNames={{ input: inputClass }}
				aria-label='Search task'
			/>
			<Tooltip
				label={errorQuery ? `Task ${errorQuery} not found` : ''}
				opened={tooltipOpen && errorQuery != null}
				position='right'
				color='red'
				withArrow
			>
				<ActionIcon
					size={36}
					variant={variant === 'sidebar' ? 'filled' : 'light'}
					color='brand'
					onClick={() => void submit()}
					loading={loading}
					disabled={!query.trim()}
					aria-label='Search task'
					className='field-task-search-submit'
				>
					<CornerDownLeft size={18} aria-hidden />
				</ActionIcon>
			</Tooltip>
		</div>
	);
}
