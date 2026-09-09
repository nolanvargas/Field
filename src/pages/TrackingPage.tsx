import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
	Alert,
	Box,
	Center,
	Loader,
	Text,
	Title,
} from '@mantine/core';
import { apiUrl } from '../api/client';
import { applyOrgAccent } from '../applyOrgAccent';
import {
	TrackingPageContent,
	TrackingPageShell,
} from '../components/TrackingPageLayout';
import { useDocumentTitle } from '../documentTitle';
import type { TrackingPageTemplate } from '../../shared/trackingPageTemplate.js';

export interface TrackingPageDocument {
	kind: string;
	fileName: string;
	available: boolean;
}

export interface TrackingPageHistoryEvent {
	id: string;
	type: string;
	at: string | null;
	title: string;
	fromStatus: string | null;
	toStatus: string | null;
	detail: string | null;
}

export interface TrackingPagePayload {
	jobTitle: string;
	status: string;
	taskType: string;
	headline: string;
	destinationName: string;
	destinationLabel: string;
	completedAt: string | null;
	documents: TrackingPageDocument[];
	history: TrackingPageHistoryEvent[];
	trackingPath: string;
	trackingUrl: string;
	trackingPageTemplate: TrackingPageTemplate;
	mergeTags: Record<string, string>;
	accentColor: string;
}

async function fetchTrackingPage(
	token: string,
	signal?: AbortSignal,
): Promise<TrackingPagePayload> {
	const res = await fetch(apiUrl(`/api/tracking/tasks/${encodeURIComponent(token)}`), {
		signal,
	});
	if (res.status === 404) {
		throw Object.assign(new Error('Order not found'), { status: 404 });
	}
	if (!res.ok) {
		let message = `Request failed (${res.status})`;
		try {
			const data = (await res.json()) as { error?: string };
			if (data.error) message = data.error;
		} catch {
			/* ignore */
		}
		throw new Error(message);
	}
	return (await res.json()) as TrackingPagePayload;
}

export function TrackingPage() {
	const { token = '' } = useParams<{ token: string }>();
	const [data, setData] = useState<TrackingPagePayload | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notFound, setNotFound] = useState(false);

	useDocumentTitle(data?.jobTitle ? `Order · ${data.jobTitle}` : 'Order tracking');

	useEffect(() => {
		if (!token.trim()) {
			setNotFound(true);
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setNotFound(false);
		setData(null);

		fetchTrackingPage(token, controller.signal)
			.then((payload) => {
				if (!controller.signal.aborted) {
					applyOrgAccent(payload.accentColor);
					setData(payload);
					setLoading(false);
				}
			})
			.catch((err: unknown) => {
				if (controller.signal.aborted) return;
				const status =
					err && typeof err === 'object' && 'status' in err
						? Number((err as { status: number }).status)
						: 0;
				if (status === 404) {
					setNotFound(true);
				} else {
					setError(err instanceof Error ? err.message : 'Failed to load order');
				}
				setLoading(false);
			});

		return () => controller.abort();
	}, [token]);

	if (loading) {
		return (
			<Center mih='100dvh' className='tracking-page'>
				<Loader size='sm' color='brand' />
			</Center>
		);
	}

	if (notFound) {
		return (
			<TrackingPageShell>
				<Box p={{ base: 24, sm: 40 }}>
					<Title order={1} fz={26} mb='sm'>
						Order not found
					</Title>
					<Text c='dimmed' size='sm'>
						This tracking link is invalid or the order is no longer available.
					</Text>
				</Box>
			</TrackingPageShell>
		);
	}

	if (error || !data) {
		return (
			<TrackingPageShell>
				<Box p={{ base: 24, sm: 40 }}>
					<Alert color='red' title='Unable to load'>
						{error ?? 'Something went wrong.'}
					</Alert>
				</Box>
			</TrackingPageShell>
		);
	}

	return (
		<TrackingPageShell>
			<TrackingPageContent
				trackingPageTemplate={data.trackingPageTemplate}
				mergeTags={data.mergeTags}
				documents={data.documents}
				history={data.history}
				token={token}
			/>
		</TrackingPageShell>
	);
}
