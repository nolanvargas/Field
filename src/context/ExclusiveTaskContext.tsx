import { createContext, useContext } from 'react';
import type { TaskStatus } from '../types/task';

export type ExclusiveTaskStatusUpdate = {
	id: number;
	status: TaskStatus;
};

export interface ExclusiveTaskContextValue {
	openTask: (taskId: number) => void;
	subscribeStatus: (
		listener: (update: ExclusiveTaskStatusUpdate) => void,
	) => () => void;
	subscribeListChange: (listener: () => void) => () => void;
}

export const ExclusiveTaskContext =
	createContext<ExclusiveTaskContextValue | null>(null);

export function useExclusiveTask(): ExclusiveTaskContextValue {
	const ctx = useContext(ExclusiveTaskContext);
	if (!ctx) {
		throw new Error(
			'useExclusiveTask must be used within ExclusiveTaskContext',
		);
	}
	return ctx;
}
