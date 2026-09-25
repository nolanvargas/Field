import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskListViewSwitcher } from '../src/components/TaskListViewSwitcher';
import { renderUi } from './helpers/renderUi';

describe('TaskListViewSwitcher', () => {
	it('calls onChange when a segment is clicked', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		renderUi(
			<TaskListViewSwitcher value='month' onChange={onChange} showWeek />,
		);

		await user.click(screen.getByRole('button', { name: 'Week' }));

		expect(onChange).toHaveBeenCalledWith('week');
	});

	it('marks the active view with aria-pressed', () => {
		renderUi(
			<TaskListViewSwitcher value='list' onChange={() => {}} showWeek={false} />,
		);

		const listButton = screen.getByRole('button', { name: 'List' });
		expect(listButton).toHaveAttribute('aria-pressed', 'true');
	});
});
