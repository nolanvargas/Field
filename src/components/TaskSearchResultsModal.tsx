import { Button, Group, Table, Text } from '@mantine/core';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { useTaskSearch } from '../context/TaskSearchContext';
import { RelativeTime } from './RelativeTime';
import { KeyboardAwareModal } from './KeyboardAwareModal';
import { TaskSearchInput } from './TaskSearchInput';

export function TaskSearchResultsModal() {
	const { settings } = useOrgSettings();
	const { results, resultsOpen, closeResults, searchTaskId, openTask } =
		useTaskSearch();
	const taskOpen = searchTaskId != null;
	const keyLabel = settings.externalKeyLabel.trim() || 'External key';

	return (
		<KeyboardAwareModal
			opened={resultsOpen}
			onClose={closeResults}
			title='Search results'
			size='lg'
			zIndex={250}
			closeOnEscape={!taskOpen}
			closeOnClickOutside={!taskOpen}
			pinFooter
		>
			<div className='field-task-search-results'>
				<TaskSearchInput variant='light' autoFocus />
				<div className='field-task-search-results-list'>
					{results.length === 0 ? (
						<Text size='sm' c='dimmed' mt='md'>
							No tasks match that key.
						</Text>
					) : (
						<Table.ScrollContainer minWidth={520} mt='md'>
							<Table highlightOnHover verticalSpacing='sm'>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>{keyLabel}</Table.Th>
										<Table.Th>Title</Table.Th>
										<Table.Th>Type</Table.Th>
										<Table.Th>Created</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{results.map((task) => (
										<Table.Tr
											key={task.id}
											tabIndex={0}
											role='button'
											className='field-task-search-results-row'
											aria-label={`Open ${task.externalKey || 'task'}`}
											onClick={() => openTask(task.id)}
											onKeyDown={(event) => {
												if (event.key === 'Enter' || event.key === ' ') {
													event.preventDefault();
													openTask(task.id);
												}
											}}
										>
											<Table.Td>{task.externalKey || '—'}</Table.Td>
											<Table.Td>{task.jobTitle.trim() || '—'}</Table.Td>
											<Table.Td>{task.taskType || '—'}</Table.Td>
											<Table.Td>
												<RelativeTime value={task.createdAt} variant='ago' />
											</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</Table.ScrollContainer>
					)}
				</div>
				<Group justify='flex-end' mt='md' className='field-task-search-results-footer'>
					<Button variant='default' onClick={closeResults}>
						Close
					</Button>
				</Group>
			</div>
		</KeyboardAwareModal>
	);
}
