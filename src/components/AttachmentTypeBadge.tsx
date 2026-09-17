import { Badge } from '@mantine/core';
import type { OrgAttachmentTypeDef } from '../api/orgSettings';
import { AttachmentTypePicker } from './AttachmentTypePicker';

type AttachmentTypeBadgeProps = {
	label: string;
	types: OrgAttachmentTypeDef[];
	taskTypeName: string;
	mimeType: string;
	attachmentTypeId: number | null;
	onChangeType: (attachmentTypeId: number | null) => void;
	disabled?: boolean;
};

export function AttachmentTypeBadge({
	label,
	types,
	taskTypeName,
	mimeType,
	attachmentTypeId,
	onChangeType,
	disabled,
}: AttachmentTypeBadgeProps) {
	if (!label.trim()) return null;

	return (
		<AttachmentTypePicker
			types={types}
			taskTypeName={taskTypeName}
			mimeType={mimeType}
			selectedTypeId={attachmentTypeId}
			onSelect={onChangeType}
		>
			<button
				type='button'
				className='task-attachment-type-badge'
				disabled={disabled}
				aria-label={`Attachment type: ${label}. Change type.`}
			>
				<Badge size='sm' variant='filled' color='dark'>
					{label}
				</Badge>
			</button>
		</AttachmentTypePicker>
	);
}
