import { Box, Button, Stack, Text } from '@mantine/core';
import { Download } from 'lucide-react';
import { apiUrl } from '../api/client';
import { RelativeTime } from './RelativeTime';
import { sanitizeTrackingPageHtml } from '../trackingPageHtml';
import { substituteMergeTags, type TrackingPageBlock } from '../../shared/trackingPageTemplate.js';
import type {
	TrackingPageDocument,
	TrackingPageHistoryEvent,
} from '../pages/TrackingPage';

export interface TrackingPageImageAttachment {
	url: string;
	alt?: string;
}

export interface TrackingPageRenderData {
	mergeTags: Record<string, string>;
	documents?: TrackingPageDocument[];
	history?: TrackingPageHistoryEvent[];
	token?: string;
	imageAttachments?: TrackingPageImageAttachment[];
}

export interface TrackingPageBlockRendererProps {
	blocks: TrackingPageBlock[];
	data: TrackingPageRenderData;
	preview?: boolean;
}

function docLabel(kind: string): string {
	if (kind === 'proof_of_completion' || kind === 'pod') return 'Proof of Completion';
	if (kind === 'delivery_docket') return 'Delivery Docket';
	return kind.replace(/_/g, ' ');
}

function documentUrl(token: string, kind: string): string {
	return apiUrl(
		`/api/tracking/tasks/${encodeURIComponent(token)}/documents/${encodeURIComponent(kind)}?download=1`,
	);
}

function spacerHeight(size: 'sm' | 'md' | 'lg'): number {
	switch (size) {
		case 'sm':
			return 8;
		case 'lg':
			return 32;
		default:
			return 16;
	}
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<Text size='sm' c='#3a353c' lh={1.6}>
			<Text span fw={700} className='tracking-page-label'>
				{label}
			</Text>
			{'  '}
			{value || '—'}
		</Text>
	);
}

export function TrackingPageBlockRenderer({
	blocks,
	data,
	preview = false,
}: TrackingPageBlockRendererProps) {
	const { mergeTags, documents = [], history = [], token, imageAttachments = [] } = data;

	return (
		<Stack gap={0}>
			{blocks.map((block) => {
				switch (block.type) {
					case 'text': {
						const html = substituteMergeTags(block.html, mergeTags);
						const sanitized = sanitizeTrackingPageHtml(html);
						if (!sanitized.trim()) return null;
						return (
							<Box key={block.id} className='tracking-page-block tracking-page-block--text'>
								<div
									className='tracking-page-html'
									dangerouslySetInnerHTML={{ __html: sanitized }}
								/>
							</Box>
						);
					}

					case 'spacer':
						return (
							<Box
								key={block.id}
								className='tracking-page-block tracking-page-block--spacer'
								h={spacerHeight(block.size)}
								aria-hidden='true'
							/>
						);

					case 'detailRows': {
						const rows = block.rows.filter((row) => row.label && row.tag);
						if (rows.length === 0) return null;
						return (
							<Box key={block.id} className='tracking-page-block tracking-page-block--detail-rows' pb={16}>
								<Box
									p={{ base: 16, sm: '20px 24px' }}
									className='tracking-page-detail-card'
								>
									<Stack gap={6}>
										{rows.map((row, index) => (
											<DetailRow
												key={`${row.label}-${index}`}
												label={row.label}
												value={mergeTags[row.tag] ?? (preview ? `{{${row.tag}}}` : '—')}
											/>
										))}
									</Stack>
								</Box>
							</Box>
						);
					}

					case 'documents': {
						const allowedKinds = new Set(block.kinds);
						const availableDocs = documents.filter(
							(d) => d.available && allowedKinds.has(d.kind),
						);
						if (availableDocs.length === 0) return null;
						return (
							<Box key={block.id} className='tracking-page-block tracking-page-block--documents' pb={32}>
								<Text fw={600} className='tracking-page-emphasis' mb='sm' size='sm'>
									Documents
								</Text>
								<Stack gap='xs'>
									{availableDocs.map((doc) => (
										<Button
											key={doc.kind}
											component={token ? 'a' : 'button'}
											href={token ? documentUrl(token, doc.kind) : undefined}
											target={token ? '_blank' : undefined}
											rel={token ? 'noopener noreferrer' : undefined}
											disabled={!token}
											variant='light'
											color='brand'
											leftSection={<Download size={16} />}
											justify='flex-start'
										>
											Download {docLabel(doc.kind)}
										</Button>
									))}
								</Stack>
							</Box>
						);
					}

					case 'history':
						return (
							<Box
								key={block.id}
								className={
									history.length > 0
										? 'tracking-page-block tracking-page-block--history tracking-page-history'
										: 'tracking-page-block tracking-page-block--history'
								}
								pb={40}
								pt={preview && history.length === 0 ? 0 : 28}
							>
								<Text fw={600} className='tracking-page-emphasis' mb='md' size='sm'>
									History
								</Text>
								{history.length === 0 ? (
									<Text size='sm' c='dimmed'>
										No updates yet.
									</Text>
								) : (
									<Stack gap='md'>
										{history.map((event) => (
											<Box key={event.id}>
												<Text size='sm' fw={500} className='tracking-page-emphasis'>
													{event.title}
												</Text>
												<Text size='xs' c='dimmed'>
													<RelativeTime
														value={event.at}
														variant='absolute'
													/>
												</Text>
											</Box>
										))}
									</Stack>
								)}
							</Box>
						);

					case 'imageAttachments':
						if (imageAttachments.length === 0) return null;
						return (
							<Box key={block.id} className='tracking-page-block tracking-page-block--images' pb={32}>
								<Text fw={600} className='tracking-page-emphasis' mb='sm' size='sm'>
									Completion images
								</Text>
								<div className='tracking-page-image-grid'>
									{imageAttachments.map((img, index) => (
										<img
											key={`${img.url}-${index}`}
											src={img.url}
											alt={img.alt ?? 'Completion image'}
											className='tracking-page-image-grid-item'
										/>
									))}
								</div>
							</Box>
						);

					default:
						return null;
				}
			})}
		</Stack>
	);
}
