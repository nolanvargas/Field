import { useEffect, useState } from 'react';
import { Box, Text, Title } from '@mantine/core';
import { applyOrgAccent } from '../applyOrgAccent';
import { TrackingPagePreview } from '../components/TrackingPageLayout';
import { useDocumentTitle } from '../documentTitle';
import { readTrackingPagePreview } from '../trackingPagePreviewStorage';

export function TrackingPreviewPage() {
	const [payload] = useState(() => readTrackingPagePreview());

	useDocumentTitle(
		payload ? `Preview · ${payload.taskTypeName}` : 'Tracking page preview',
	);

	useEffect(() => {
		if (payload?.accentColor) {
			applyOrgAccent(payload.accentColor);
		}
	}, [payload]);

	if (!payload) {
		return (
			<Box className='tracking-page' py={32} px={16}>
				<Box maw={600} mx='auto' bg='white' p={{ base: 24, sm: 40 }} style={{ borderRadius: 12 }}>
					<Title order={1} fz={26} mb='sm'>
						Preview unavailable
					</Title>
					<Text c='dimmed' size='sm'>
						Open this page from Management → Tracking page using Preview full
						page.
					</Text>
				</Box>
			</Box>
		);
	}

	return (
		<TrackingPagePreview
			taskTypeName={payload.taskTypeName}
			trackingPageTemplate={payload.trackingPageTemplate}
		/>
	);
}
