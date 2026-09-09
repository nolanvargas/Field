import { useCallback, useState } from 'react';

import {

	ActionIcon,

	Box,

	Button,

	Checkbox,

	Group,

	Menu,

	Select,

	Stack,

	Text,

	TextInput,

} from '@mantine/core';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { RichTextBlockEditor } from './RichTextBlockEditor';

import {
	LightColorSchemeScope,
	useLightScopeComboboxProps,
	useLightScopeMenuPortalProps,
} from './LightColorSchemeScope';

import { TrackingPagePreview } from './TrackingPageLayout';

import {

	canAddTrackingPageBlockType,

	defaultBlock,

	defaultTrackingPageTemplate,

	TRACKING_PAGE_BLOCK_LABELS,

	TRACKING_PAGE_BLOCK_TYPES,

	TRACKING_PAGE_MERGE_TAGS,

	type TrackingPageBlock,

	type TrackingPageBlockType,

	type TrackingPageTemplate,

} from '../../shared/trackingPageTemplate.js';

import { listDocumentTypes } from '../../shared/documentTypes.js';



const DOCUMENT_KIND_OPTIONS = listDocumentTypes()

	.filter((t) => t.onTrackingPage)

	.map((t) => ({ value: t.key, label: t.label }));



const DETAIL_TAG_OPTIONS = TRACKING_PAGE_MERGE_TAGS.map((tag) => ({

	value: tag,

	label: tag,

}));



const SPACER_SIZE_OPTIONS = [

	{ value: 'sm', label: 'Small' },

	{ value: 'md', label: 'Medium' },

	{ value: 'lg', label: 'Large' },

];



export interface TrackingPageBlockEditorProps {

	taskTypeName: string;

	value: TrackingPageTemplate;

	onChange: (template: TrackingPageTemplate) => void;

}



function BlockSettingsPanel({

	block,

	onChange,

}: {

	block: TrackingPageBlock;

	onChange: (next: TrackingPageBlock) => void;

}) {

	const comboboxProps = useLightScopeComboboxProps();

	if (block.type === 'text') {

		return (

			<RichTextBlockEditor

				value={block.html}

				onChange={(html) => onChange({ ...block, html })}

			/>

		);

	}



	if (block.type === 'spacer') {

		return (

			<Select

				label='Spacer size'

				data={SPACER_SIZE_OPTIONS}

				value={block.size}

				onChange={(v) => {

					if (v === 'sm' || v === 'md' || v === 'lg') {

						onChange({ ...block, size: v });

					}

				}}

				comboboxProps={comboboxProps}

				maw={240}

			/>

		);

	}



	if (block.type === 'detailRows') {

		const rows = block.rows;

		return (

			<Stack gap='sm'>

				{rows.map((row, index) => (

					<Group key={index} align='flex-end' wrap='nowrap'>

						<TextInput

							label='Label'

							value={row.label}

							onChange={(e) => {

								const next = rows.map((r, i) =>

									i === index ? { ...r, label: e.currentTarget.value } : r,

								);

								onChange({ ...block, rows: next });

							}}

							style={{ flex: 1 }}

						/>

						<Select

							label='Tag'

							data={DETAIL_TAG_OPTIONS}

							value={row.tag}

							onChange={(v) => {

								if (!v) return;

								const next = rows.map((r, i) =>

									i === index ? { ...r, tag: v } : r,

								);

								onChange({ ...block, rows: next });

							}}

							comboboxProps={comboboxProps}

							style={{ flex: 1 }}

						/>

						<Button

							variant='subtle'

							color='red'

							px='xs'

							onClick={() =>

								onChange({ ...block, rows: rows.filter((_, i) => i !== index) })

							}

						>

							<Trash2 size={14} />

						</Button>

					</Group>

				))}

				<Button

					variant='light'

					size='xs'

					leftSection={<Plus size={14} />}

					onClick={() =>

						onChange({

							...block,

							rows: [...rows, { label: 'Label', tag: 'task.job_title' }],

						})

					}

				>

					Add row

				</Button>

			</Stack>

		);

	}



	if (block.type === 'documents') {

		const kinds = block.kinds;

		return (

			<Stack gap='sm'>

				{DOCUMENT_KIND_OPTIONS.map((opt) => (

					<Checkbox

						key={opt.value}

						label={opt.label}

						checked={kinds.includes(opt.value)}

						onChange={(e) => {

							const checked = e.currentTarget.checked;

							const next = checked

								? kinds.includes(opt.value)

									? kinds

									: [...kinds, opt.value]

								: kinds.filter((k) => k !== opt.value);

							onChange({ ...block, kinds: next });

						}}

					/>

				))}

			</Stack>

		);

	}



	return (

		<Text size='sm' c='dimmed'>

			No settings for this block.

		</Text>

	);

}



export function TrackingPageBlockEditor(props: TrackingPageBlockEditorProps) {
	return (
		<LightColorSchemeScope className='tracking-page-block-editor'>
			<TrackingPageBlockEditorBody {...props} />
		</LightColorSchemeScope>
	);
}

function TrackingPageBlockEditorBody({

	taskTypeName,

	value,

	onChange,

}: TrackingPageBlockEditorProps) {

	const [expandedId, setExpandedId] = useState<string | null>(null);



	const template = value ?? defaultTrackingPageTemplate(taskTypeName);



	const updateBlocks = useCallback(

		(fn: (blocks: TrackingPageBlock[]) => TrackingPageBlock[]) => {

			onChange({ ...template, blocks: fn(template.blocks) });

		},

		[onChange, template],

	);



	const onChangeBlock = useCallback(

		(blockId: string, next: TrackingPageBlock) => {

			updateBlocks((blocks) =>

				blocks.map((block) => (block.id === blockId ? next : block)),

			);

		},

		[updateBlocks],

	);



	const moveBlock = (index: number, direction: -1 | 1) => {

		const target = index + direction;

		if (target < 0 || target >= template.blocks.length) return;

		updateBlocks((blocks) => {

			const next = [...blocks];

			const [item] = next.splice(index, 1);

			next.splice(target, 0, item);

			return next;

		});

	};



	const addBlock = (blockType: TrackingPageBlockType) => {

		if (!canAddTrackingPageBlockType(blockType, template.blocks)) return;

		const block = defaultBlock(blockType, taskTypeName);

		updateBlocks((blocks) => [...blocks, block]);

		setExpandedId(block.id);

	};



	const removeBlock = (blockId: string) => {

		updateBlocks((blocks) => blocks.filter((b) => b.id !== blockId));

		if (expandedId === blockId) setExpandedId(null);

	};



	const menuPortalProps = useLightScopeMenuPortalProps();

	return (
			<Box className='tracking-page-block-editor-panes'>
				<Box className='tracking-page-block-editor-pane'>
					<Text className='tracking-page-block-editor-pane-title' size='sm' fw={600}>
						Blocks
					</Text>
					<Box className='tracking-page-block-editor-pane-body'>
				<Group gap='sm' mb='md'>

					<Menu withinPortal portalProps={menuPortalProps}>

						<Menu.Target>

							<Button size='xs' variant='light' leftSection={<Plus size={14} />}>

								Add block

							</Button>

						</Menu.Target>

						<Menu.Dropdown>

							{TRACKING_PAGE_BLOCK_TYPES.map((blockType) => {

								const canAdd = canAddTrackingPageBlockType(blockType, template.blocks);

								return (

									<Menu.Item

										key={blockType}

										disabled={!canAdd}

										onClick={() => addBlock(blockType)}

									>

										{TRACKING_PAGE_BLOCK_LABELS[blockType]}

									</Menu.Item>

								);

							})}

						</Menu.Dropdown>

					</Menu>

				</Group>



				<Stack gap='xs'>

					{template.blocks.length === 0 ? (

						<Text size='sm' c='dimmed'>No blocks yet. Add one above.</Text>

					) : (

						template.blocks.map((block, index) => {

							const expanded = expandedId === block.id;

							return (

								<Box

									key={block.id}

									p='sm'

									style={{

										border: '1px solid var(--color-border)',

										borderRadius: 'var(--radius)',

										background: 'var(--mantine-color-body)',

									}}

								>

									<Group justify='space-between' wrap='nowrap'>

										<Button

											variant='subtle'

											size='compact-sm'

											onClick={() =>

												setExpandedId(expanded ? null : block.id)

											}

											style={{ flex: 1, justifyContent: 'flex-start' }}

										>

											<Text size='sm' fw={600}>

												{TRACKING_PAGE_BLOCK_LABELS[block.type]}

											</Text>

										</Button>

										<Group gap={4} wrap='nowrap'>

											<ActionIcon

												variant='subtle'

												size='sm'

												disabled={index === 0}

												onClick={() => moveBlock(index, -1)}

												aria-label={`Move ${TRACKING_PAGE_BLOCK_LABELS[block.type]} up`}

											>

												<ChevronUp size={14} />

											</ActionIcon>

											<ActionIcon

												variant='subtle'

												size='sm'

												disabled={index === template.blocks.length - 1}

												onClick={() => moveBlock(index, 1)}

												aria-label={`Move ${TRACKING_PAGE_BLOCK_LABELS[block.type]} down`}

											>

												<ChevronDown size={14} />

											</ActionIcon>

											<ActionIcon

												variant='subtle'

												color='red'

												size='sm'

												onClick={() => removeBlock(block.id)}

												aria-label={`Remove ${TRACKING_PAGE_BLOCK_LABELS[block.type]}`}

											>

												<Trash2 size={14} />

											</ActionIcon>

										</Group>

									</Group>

									{expanded ? (

										<Box pt='sm'>

											<BlockSettingsPanel

												block={block}

												onChange={(next) => onChangeBlock(block.id, next)}

											/>

										</Box>

									) : null}

								</Box>

							);

						})

					)}

				</Stack>
					</Box>
				</Box>

				<Box className='tracking-page-block-editor-pane tracking-page-block-editor-preview-pane'>
					<Text className='tracking-page-block-editor-pane-title' size='sm' fw={600}>
						Preview
					</Text>
					<Box className='tracking-page-block-editor-preview-frame'>
						<TrackingPagePreview
							taskTypeName={taskTypeName}
							trackingPageTemplate={template}
							embedded
						/>
					</Box>
				</Box>
			</Box>
	);

}


