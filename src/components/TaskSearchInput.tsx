import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, TextInput, Tooltip } from '@mantine/core';
import { CornerDownLeft } from 'lucide-react';
import { useTaskSearch } from '../context/TaskSearchContext';

const ERROR_TOOLTIP_MS = 3000;

export interface TaskSearchInputProps {
	variant?: 'sidebar' | 'light';
	autoFocus?: boolean;
}

export function TaskSearchInput({
	variant = 'sidebar',
	autoFocus = false,
}: TaskSearchInputProps) {
	const { query, setQuery, loading, submit } = useTaskSearch();
	const [errorQuery, setErrorQuery] = useState<string | null>(null);
	const [tooltipOpen, setTooltipOpen] = useState(false);
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

	const showError = useCallback(
		(failedQuery: string) => {
			clearError();
			setErrorQuery(failedQuery);
			setTooltipOpen(true);
			errorTimerRef.current = setTimeout(() => {
				setTooltipOpen(false);
				setErrorQuery(null);
				errorTimerRef.current = null;
			}, ERROR_TOOLTIP_MS);
		},
		[clearError],
	);

	useEffect(() => {
		return () => {
			if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
		};
	}, []);

	const onSubmit = useCallback(async () => {
		const trimmed = query.trim();
		if (!trimmed || loading) return;
		clearError();
		const outcome = await submit();
		if (outcome === 'not-found') {
			showError(trimmed);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [query, loading, clearError, submit, showError]);

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
				autoFocus={autoFocus}
				value={query}
				onChange={(e) => setQuery(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						void onSubmit();
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
					onClick={() => void onSubmit()}
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
