import type { TaskStatus } from '../types/task';

type TaskStatusBadgeProps = {
	status: TaskStatus;
	variant?: 'default' | 'dot';
	className?: string;
};

export function TaskStatusBadge({
	status,
	variant = 'default',
	className,
}: TaskStatusBadgeProps) {
	const classes = [
		'task-status',
		variant === 'dot' ? 'task-status--dot' : '',
		className,
	]
		.filter(Boolean)
		.join(' ');

	return (
		<span
			className={classes}
			data-status={status}
			aria-label={variant === 'dot' ? status : undefined}
			title={variant === 'dot' ? status : undefined}
		>
			{variant === 'dot' ? null : status}
		</span>
	);
}
