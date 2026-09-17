import {
	Box,
	Button,
	Checkbox,
	Group,
	MultiSelect,
	Text,
	TextInput,
	Title,
} from '@mantine/core';
import { Plus } from 'lucide-react';
import type { OrgAttachmentTypeDef } from '../api/orgSettings';
import type { AttachmentMimeCategory } from '../../shared/attachmentMimeCategories.js';
import { ATTACHMENT_MIME_CATEGORIES } from '../../shared/attachmentMimeCategories.js';
import { SettingsGrid, type SettingsGridColumn } from './SettingsGrid';

const MIME_CATEGORY_LABELS: Record<AttachmentMimeCategory, string> = {
	image: 'Image',
	video: 'Video',
	pdf: 'PDF',
	other: 'Other',
};

const COLUMNS: SettingsGridColumn[] = [
	{ key: 'label', header: 'Label' },
	{ key: 'slug', header: 'Slug', width: '10rem' },
	{ key: 'mime', header: 'Allowed types', width: '14rem' },
	{ key: 'showWhen', header: 'Show when', width: '16rem' },
];

type AttachmentTypeDefsEditorProps = {
	defs: OrgAttachmentTypeDef[];
	taskTypeNames: string[];
	onAdd: () => void;
	onRemove: (index: number) => void;
	onUpdate: (index: number, patch: Partial<OrgAttachmentTypeDef>) => void;
};

export function AttachmentTypeDefsEditor({
	defs,
	taskTypeNames,
	onAdd,
	onRemove,
	onUpdate,
}: AttachmentTypeDefsEditorProps) {
	const sorted = [...defs].sort((a, b) => a.sortOrder - b.sortOrder);

	return (
		<Box>
			<Group justify='space-between' mb='sm'>
				<Title order={4}>Attachment types</Title>
				<Button variant='light' leftSection={<Plus size={14} />} onClick={onAdd}>
					Add type
				</Button>
			</Group>
			<Text size='sm' c='dimmed' mb='sm'>
				Crew can tag uploads on mobile before capture. Tracking page image blocks
				show attachments that match selected type slugs.
			</Text>
			<SettingsGrid
				label='Attachment types'
				columns={COLUMNS}
				onRemove={(index) => onRemove(index)}
				emptyMessage='No attachment types yet. Add one to get started.'
				rows={sorted.map((def, index) => ({
					key: def.id != null ? `id-${def.id}` : `new-${index}`,
					label: def.label || def.slug || 'New type',
					cells: {
						label: (
							<TextInput
								value={def.label}
								onChange={(e) =>
									onUpdate(index, { label: e.currentTarget.value })
								}
								placeholder='Completion photos'
							/>
						),
						slug: (
							<TextInput
								value={def.slug}
								onChange={(e) =>
									onUpdate(index, { slug: e.currentTarget.value })
								}
								placeholder='completion_photos'
							/>
						),
						mime: (
							<Group gap='xs'>
								{ATTACHMENT_MIME_CATEGORIES.map((cat) => (
									<Checkbox
										key={cat}
										label={MIME_CATEGORY_LABELS[cat]}
										size='xs'
										checked={def.allowedMimeCategories.includes(cat)}
										onChange={(e) => {
											const checked = e.currentTarget.checked;
											const next = checked
												? [...def.allowedMimeCategories, cat]
												: def.allowedMimeCategories.filter((c) => c !== cat);
											onUpdate(index, {
												allowedMimeCategories: next.length > 0
													? next
													: [...ATTACHMENT_MIME_CATEGORIES],
											});
										}}
									/>
								))}
							</Group>
						),
						showWhen: (
							<MultiSelect
								data={taskTypeNames}
								value={def.showWhen?.taskTypeNames ?? []}
								onChange={(names) =>
									onUpdate(index, {
										showWhen:
											names.length > 0 ? { taskTypeNames: names } : null,
									})
								}
								placeholder='All task types'
								clearable
								size='xs'
							/>
						),
					},
				}))}
			/>
		</Box>
	);
}
