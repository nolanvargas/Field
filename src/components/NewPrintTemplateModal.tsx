import { useEffect, useMemo, useState } from 'react';
import {
	Box,
	Button,
	Group,
	Select,
	Stack,
	Text,
	TextInput,
} from '@mantine/core';
import { listDocumentTypes } from '../../shared/documentTypes.js';
import {
	buildBlankPrintTemplate,
	createDevPrintTemplate,
	type DevPrintTemplateSummary,
} from '../api/devPrintTemplates';
import { KeyboardAwareModal } from './KeyboardAwareModal';

type NewPrintTemplateModalProps = {
	opened: boolean;
	onClose: () => void;
	defaultOrgId: string;
	templates: DevPrintTemplateSummary[];
	onCreated: (id: number) => void | Promise<void>;
};

export function NewPrintTemplateModal({
	opened,
	onClose,
	defaultOrgId,
	templates,
	onCreated,
}: NewPrintTemplateModalProps) {
	const [orgId, setOrgId] = useState(defaultOrgId);
	const [documentType, setDocumentType] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!opened) return;
		setOrgId(defaultOrgId);
		setDocumentType(null);
		setName('');
		setError(null);
	}, [defaultOrgId, opened]);

	const parsedOrgId = Number(orgId.trim() || '1');
	const orgIdValid = Number.isInteger(parsedOrgId) && parsedOrgId > 0;

	const configuredTypes = useMemo(() => {
		if (!orgIdValid) return new Set<string>();
		return new Set(
			templates
				.filter((t) => t.orgId === parsedOrgId)
				.map((t) => t.documentType),
		);
	}, [orgIdValid, parsedOrgId, templates]);

	const documentTypeOptions = useMemo(
		() =>
			listDocumentTypes().map((t) => ({
				value: t.key,
				label: configuredTypes.has(t.key)
					? `${t.label} (configured)`
					: t.label,
			})),
		[configuredTypes],
	);

	const selectedDocType = documentType
		? listDocumentTypes().find((t) => t.key === documentType)
		: null;
	const replacesExisting =
		documentType != null && configuredTypes.has(documentType);

	const handleCreate = async () => {
		if (busy || !documentType || !orgIdValid) return;
		setBusy(true);
		setError(null);
		try {
			const trimmedName = name.trim();
			const { id } = await createDevPrintTemplate({
				orgId: parsedOrgId,
				documentType,
				name: trimmedName || undefined,
				template: buildBlankPrintTemplate(
					documentType,
					trimmedName || selectedDocType?.label,
				),
			});
			await onCreated(id);
			onClose();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Create failed');
		} finally {
			setBusy(false);
		}
	};

	return (
		<KeyboardAwareModal
			opened={opened}
			onClose={onClose}
			title='New print template'
			size={480}
			centered
		>
			<Stack gap='sm'>
				<Text size='sm' c='dimmed'>
					Each org has one layout per document type. Pick a type to start from a
					starter JSON layout, then edit blocks and tags in the editor.
				</Text>

				<Box maw={560}>
					<Stack gap='sm'>
						<Box maw={100}>
							<TextInput
								label='Org'
								value={orgId}
								onChange={(e) => setOrgId(e.currentTarget.value)}
								error={
									orgId.trim() !== '' && !orgIdValid
										? 'Enter a positive org id'
										: undefined
								}
							/>
						</Box>
						<Select
							label='Document type'
							placeholder='Choose a type'
							data={documentTypeOptions}
							value={documentType}
							onChange={setDocumentType}
							searchable
							required
						/>
						<TextInput
							label='Template name'
							description='Dev-only label for filtering. Defaults to the document type label.'
							placeholder={
								selectedDocType?.label ?? 'Optional display name'
							}
							value={name}
							onChange={(e) => setName(e.currentTarget.value)}
						/>
					</Stack>
				</Box>

				{replacesExisting ? (
					<div className='dev-doc-templates-callout dev-doc-templates-callout--warning'>
						Org {parsedOrgId} already has a template for{' '}
						<strong>{selectedDocType?.label ?? documentType}</strong>. Creating
						will overwrite it with the starter layout.
					</div>
				) : null}

				{error ? (
					<div
						className='dev-doc-templates-callout dev-doc-templates-callout--error'
						role='alert'
					>
						{error}
					</div>
				) : null}

				<Group justify='flex-end' gap='xs'>
					<Button variant='default' onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button
						onClick={() => void handleCreate()}
						loading={busy}
						disabled={!documentType || !orgIdValid}
					>
						Create template
					</Button>
				</Group>
			</Stack>
		</KeyboardAwareModal>
	);
}
