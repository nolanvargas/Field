import { createContext, useContext } from 'react';
import type { TaskSearchHit } from '../api/tasks';
import type { TaskSearchSubmitResult } from '../taskSearchOutcome';

export interface TaskSearchContextValue {
	query: string;
	setQuery: (value: string) => void;
	loading: boolean;
	submit: () => Promise<TaskSearchSubmitResult>;
	results: TaskSearchHit[];
	resultsOpen: boolean;
	closeResults: () => void;
	searchTaskId: number | null;
	openTask: (taskId: number) => void;
}

export const TaskSearchContext = createContext<TaskSearchContextValue | null>(
	null,
);

export function useTaskSearch(): TaskSearchContextValue {
	const ctx = useContext(TaskSearchContext);
	if (!ctx) {
		throw new Error('useTaskSearch must be used within TaskSearchContext');
	}
	return ctx;
}
