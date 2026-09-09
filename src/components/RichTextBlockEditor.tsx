import { useEffect } from 'react';

import { Box, Button, Menu } from '@mantine/core';

import { RichTextEditor } from '@mantine/tiptap';

import Placeholder from '@tiptap/extension-placeholder';

import { Table } from '@tiptap/extension-table';

import { TableCell } from '@tiptap/extension-table-cell';

import { TableHeader } from '@tiptap/extension-table-header';

import { TableRow } from '@tiptap/extension-table-row';

import { useEditor } from '@tiptap/react';

import StarterKit from '@tiptap/starter-kit';

import { useLightScopeMenuPortalProps } from './LightColorSchemeScope';

import { isEmptyTrackingPageHtml } from '../trackingPageHtml';

import { TRACKING_PAGE_MERGE_TAGS } from '../../shared/trackingPageTemplate.js';



interface RichTextBlockEditorProps {

	value: string;

	onChange: (html: string) => void;

	placeholder?: string;

}



function normalizeEditorHtml(html: string): string {

	return isEmptyTrackingPageHtml(html) ? '' : html;

}



/** TipTap editor for public-page text blocks: BIU, headings, lists, tables, merge tags. */

export function RichTextBlockEditor({

	value,

	onChange,

	placeholder = 'Enter text…',

}: RichTextBlockEditorProps) {

	const menuPortalProps = useLightScopeMenuPortalProps();

	const editor = useEditor({

		immediatelyRender: false,

		shouldRerenderOnTransaction: true,

		extensions: [

			StarterKit.configure({

				link: false,

				heading: { levels: [1, 2, 3] },

			}),

			Table.configure({ resizable: false }),

			TableRow,

			TableHeader,

			TableCell,

			Placeholder.configure({ placeholder }),

		],

		content: value || '',

		onUpdate: ({ editor: ed }) => {

			onChange(normalizeEditorHtml(ed.getHTML()));

		},

	});



	useEffect(() => {

		if (!editor) return;

		const next = value || '';

		const current = normalizeEditorHtml(editor.getHTML());

		if (next === current) return;

		if (isEmptyTrackingPageHtml(next) && isEmptyTrackingPageHtml(current)) return;

		editor.commands.setContent(next, { emitUpdate: false });

	}, [editor, value]);



	const insertTag = (tag: string) => {

		editor?.chain().focus().insertContent(`{{${tag}}}`).run();

	};



	return (

		<Box className='tracking-page-rich-text-editor'>

			<RichTextEditor editor={editor} variant='subtle'>

				<RichTextEditor.Toolbar sticky stickyOffset={0}>

					<RichTextEditor.ControlsGroup>

						<RichTextEditor.Bold />

						<RichTextEditor.Italic />

						<RichTextEditor.Underline />

					</RichTextEditor.ControlsGroup>

					<RichTextEditor.ControlsGroup>

						<RichTextEditor.H1 />

						<RichTextEditor.H2 />

						<RichTextEditor.H3 />

					</RichTextEditor.ControlsGroup>

					<RichTextEditor.ControlsGroup>

						<RichTextEditor.BulletList />

						<RichTextEditor.OrderedList />

					</RichTextEditor.ControlsGroup>

					<RichTextEditor.ControlsGroup>

						<Button

							size='compact-xs'

							variant='default'

							onClick={() =>

								editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()

							}

						>

							Table

						</Button>

						<Button

							size='compact-xs'

							variant='default'

							disabled={!editor?.can().addRowAfter()}

							onClick={() => editor?.chain().focus().addRowAfter().run()}

						>

							+ Row

						</Button>

						<Button

							size='compact-xs'

							variant='default'

							disabled={!editor?.can().addColumnAfter()}

							onClick={() => editor?.chain().focus().addColumnAfter().run()}

						>

							+ Col

						</Button>

						<Button

							size='compact-xs'

							variant='default'

							disabled={!editor?.can().deleteRow()}

							onClick={() => editor?.chain().focus().deleteRow().run()}

						>

							− Row

						</Button>

						<Button

							size='compact-xs'

							variant='default'

							disabled={!editor?.can().deleteColumn()}

							onClick={() => editor?.chain().focus().deleteColumn().run()}

						>

							− Col

						</Button>

						<Button

							size='compact-xs'

							variant='default'

							color='red'

							disabled={!editor?.can().deleteTable()}

							onClick={() => editor?.chain().focus().deleteTable().run()}

						>

							Del table

						</Button>

					</RichTextEditor.ControlsGroup>

					<Menu withinPortal position='bottom-end' portalProps={menuPortalProps}>

						<Menu.Target>

							<Button size='compact-xs' variant='default'>Insert tag</Button>

						</Menu.Target>

						<Menu.Dropdown>

							{TRACKING_PAGE_MERGE_TAGS.map((tag) => (

								<Menu.Item key={tag} onClick={() => insertTag(tag)}>

									{`{{${tag}}}`}

								</Menu.Item>

							))}

						</Menu.Dropdown>

					</Menu>

				</RichTextEditor.Toolbar>

				<RichTextEditor.Content className='tracking-page-html' />

			</RichTextEditor>

		</Box>

	);

}


