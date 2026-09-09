import type { ReactNode } from 'react';
import { Anchor, Box, Text } from '@mantine/core';
import { clientCompanyName, clientSupportEmail } from '../branding';
import { TrackingPageBlockRenderer } from './TrackingPageBlockRenderer';
import type { TrackingPageTemplate } from '../../shared/trackingPageTemplate.js';
import type {
	TrackingPageDocument,
	TrackingPageHistoryEvent,
} from '../pages/TrackingPage';
import {
	buildTrackingPagePreviewMergeTags,
	TRACKING_PAGE_PREVIEW_DOCUMENTS,
	TRACKING_PAGE_PREVIEW_HISTORY,
} from '../trackingPagePreviewSample';

export interface TrackingPageContentProps {
	trackingPageTemplate: TrackingPageTemplate;
	mergeTags: Record<string, string>;
	documents?: TrackingPageDocument[];
	history?: TrackingPageHistoryEvent[];
	token?: string;
}

export function TrackingPageShell({
	children,
	embedded = false,
}: {
	children: ReactNode;
	embedded?: boolean;
}) {
	return (
		<Box
			className={embedded ? 'tracking-page tracking-page--embedded' : 'tracking-page'}
			py={embedded ? 0 : 32}
			px={embedded ? 0 : 16}
		>
			<Box maw={600} mx='auto'>
				<TrackingPageBrandBar />
				<Box
					bg='white'
					style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }}
				>
					{children}
					<TrackingPageSupportFooter />
				</Box>
			</Box>
		</Box>
	);
}

export function TrackingPageContent({
	trackingPageTemplate,
	mergeTags,
	documents = [],
	history = [],
	token,
}: TrackingPageContentProps) {
	return (
		<Box px={{ base: 24, sm: 40 }} pt={40}>
			<TrackingPageBlockRenderer
				blocks={trackingPageTemplate.blocks}
				data={{
					mergeTags,
					documents,
					history,
					token,
					imageAttachments: [],
				}}
			/>
		</Box>
	);
}

export function TrackingPageBrandBar() {
	return (
		<Box py={16} px={{ base: 24, sm: 40 }} className='tracking-page-brand-bar'>
			<img
				src='/logo.svg'
				alt={clientCompanyName()}
				width={200}
				height={79}
				style={{
					display: 'block',
					width: 200,
					height: 'auto',
					maxWidth: '100%',
					margin: '0 auto',
				}}
			/>
		</Box>
	);
}

export interface TrackingPagePreviewProps {
	taskTypeName: string;
	trackingPageTemplate: TrackingPageTemplate;
	embedded?: boolean;
}

/** Sample-data preview shared by Management inline preview and Preview full page. */
export function TrackingPagePreview({
	taskTypeName,
	trackingPageTemplate,
	embedded = false,
}: TrackingPagePreviewProps) {
	const mergeTags = buildTrackingPagePreviewMergeTags(taskTypeName);

	return (
		<TrackingPageShell embedded={embedded}>
			<TrackingPageContent
				trackingPageTemplate={trackingPageTemplate}
				mergeTags={mergeTags}
				documents={TRACKING_PAGE_PREVIEW_DOCUMENTS}
				history={TRACKING_PAGE_PREVIEW_HISTORY}
				token='preview'
			/>
		</TrackingPageShell>
	);
}

export function TrackingPageSupportFooter() {
	const company = clientCompanyName();
	const supportEmail = clientSupportEmail();
	return (
		<Box px={{ base: 24, sm: 40 }} py={20} className='tracking-page-footer'>
			<Text size='sm' c='#3a353c' mb={8}>
				Thanks for choosing {company}! Please reach out to us at{' '}
				<Anchor href={`mailto:${supportEmail}`} className='tracking-page-link'>
					{supportEmail}
				</Anchor>{' '}
				for support.
			</Text>
			<Text size='xs' c='#8a8490'>
				{company}
			</Text>
		</Box>
	);
}
