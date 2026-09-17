import type { ReactNode } from 'react';
import { Menu, Stack, Text } from '@mantine/core';
import type { OrgAttachmentTypeDef } from '../api/orgSettings';
import { isAttachmentTypeVisible } from '../../shared/attachmentTypeDefs.js';
import {
	allowedMimeTypesForCategories,
	mimeMatchesAttachmentCategories,
} from '../../shared/attachmentMimeCategories.js';
import { resolveMimeType } from '../api/attachments';

type AttachmentTypePickerProps = {
	types: OrgAttachmentTypeDef[];
	taskTypeName: string;
	/** When set, only types that accept this MIME are listed (reassign flow). */
	mimeType?: string | null;
	selectedTypeId: number | null;
	onSelect: (attachmentTypeId: number | null) => void;
	/** Menu trigger */
	children: ReactNode;
};

function typesForPicker(
	types: OrgAttachmentTypeDef[],
	taskTypeName: string,
	mimeType: string | null | undefined,
) {
	return types.filter((def) => {
		if (!isAttachmentTypeVisible(def, taskTypeName)) return false;
		if (mimeType) {
			return mimeMatchesAttachmentCategories(mimeType, def.allowedMimeCategories);
		}
		return true;
	});
}

export function fileAllowedForAttachmentType(
	file: File,
	def: OrgAttachmentTypeDef,
): boolean {
	const mime = resolveMimeType(file);
	return mimeMatchesAttachmentCategories(mime, def.allowedMimeCategories);
}

export function cameraAllowedForType(def: OrgAttachmentTypeDef | null): boolean {
	if (!def) return true;
	return def.allowedMimeCategories.includes('image');
}

export function AttachmentTypePicker({
	types,
	taskTypeName,
	mimeType,
	selectedTypeId,
	onSelect,
	children,
}: AttachmentTypePickerProps) {
	const options = typesForPicker(types, taskTypeName, mimeType);

	return (
		<Menu position='bottom-start' withinPortal>
			<Menu.Target>{children}</Menu.Target>
			<Menu.Dropdown>
				<Menu.Label>Attachment type</Menu.Label>
				<Menu.Item onClick={() => onSelect(null)}>No type</Menu.Item>
				{options.length === 0 ? (
					<Stack px='sm' py='xs'>
						<Text size='xs' c='dimmed'>No types match</Text>
					</Stack>
				) : (
					options.map((def) => (
						<Menu.Item
							key={def.id ?? def.slug}
							onClick={() => onSelect(def.id ?? null)}
							fw={selectedTypeId === def.id ? 600 : undefined}
						>
							{def.label}
						</Menu.Item>
					))
				)}
			</Menu.Dropdown>
		</Menu>
	);
}

export function AttachmentTypeSelectButtons({
	types,
	taskTypeName,
	onSelect,
	disabled,
}: {
	types: OrgAttachmentTypeDef[];
	taskTypeName: string;
	selectedTypeId?: number | null | undefined;
	onSelect: (attachmentTypeId: number | null) => void;
	disabled?: boolean;
}) {
	const options = typesForPicker(types, taskTypeName, null);

	return (
		<>
			<button
				type='button'
				className='task-view-photo-option'
				disabled={disabled}
				onClick={() => onSelect(null)}
			>
				<span>No type</span>
			</button>
			{options.map((def) => (
				<button
					key={def.id ?? def.slug}
					type='button'
					className='task-view-photo-option'
					disabled={disabled}
					onClick={() => onSelect(def.id ?? null)}
				>
					<span>{def.label}</span>
				</button>
			))}
		</>
	);
}

export { allowedMimeTypesForCategories, typesForPicker };
