import { formatShortName } from '../formatName';
import type { TaskCrewMember, TaskStatus } from '../types/task';
import { RelativeTime } from './RelativeTime';

function isActivelyStartedStatus(status: TaskStatus): boolean {
	return status === 'In Progress';
}

/** Crew who have started and not yet ended, oldest start first. */
function getActiveStarters(crewMembers: TaskCrewMember[]): TaskCrewMember[] {
	return crewMembers
		.filter((m) => m.startedAt && !m.endedAt)
		.sort(
			(a, b) =>
				new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime(),
		);
}

/** Live callout of crew currently working the task. */
export function TaskStartedCrew({
	status,
	crewMembers,
}: {
	status: TaskStatus;
	crewMembers: TaskCrewMember[];
}) {
	if (!isActivelyStartedStatus(status)) return null;

	const starters = getActiveStarters(crewMembers);
	if (starters.length === 0) return null;

	return (
		<section className='task-started-live' aria-label='Currently started'>
			<div className='task-started-live-header'>
				<span className='task-started-live-dot' aria-hidden />
				<h3 className='task-started-live-label'>In Progress</h3>
			</div>
			<ul className='task-started-live-list'>
				{starters.map((m) => (
					<li key={m.id} className='task-started-live-row'>
						<span className='task-started-live-name'>
							{formatShortName(m.displayName)}
						</span>
						{m.startedAt ? (
							<span className='task-started-live-elapsed'>
								(
								<RelativeTime
									value={m.startedAt}
									variant='compactAgo'
								/>
								)
							</span>
						) : null}
					</li>
				))}
			</ul>
		</section>
	);
}
