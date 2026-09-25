import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Check } from 'lucide-react';
import type { FieldNotificationExtra } from '../notifications/notificationDeepLinks';
import { localDayKey } from '../taskCalendar/dayKeys';

const CHANNEL_ID = 'field_notifications';
const DEFAULT_DELAY_MS = 1000;

type SampleNotification = {
	notificationId: string;
	label: string;
	title: string;
	body: string;
	/** When set, a tap may open My Tasks for that day. */
	day?: string;
};

const SAMPLE_NOTIFICATIONS: SampleNotification[] = [
	{
		notificationId: 'task_assigned',
		label: 'Task assignment',
		title: 'Assigned to a task',
		body: 'Date, time, and location',
	},
	{
		notificationId: 'task_unassigned',
		label: 'Removed from a task',
		title: 'Removed from a task',
		body: 'You were removed from a scheduled task',
	},
	{
		notificationId: 'task_cancelled',
		label: 'Task cancelled',
		title: 'Task cancelled',
		body: 'A task you were on was cancelled',
	},
	{
		notificationId: 'schedule_changed',
		label: 'Schedule change',
		title: 'Schedule changed',
		body: 'The time window for a task was updated',
	},
	{
		notificationId: 'task_details_changed',
		label: 'Task details updated',
		title: 'Task details changed',
		body: 'Crew or instructions for a task were updated',
	},
];

let nextId = Math.floor(Date.now() % 100_000);

function allocId(): number {
	nextId += 1;
	return nextId;
}

/** Mobile-only page to verify device notification alerts. */
export function NotificationsPage() {
	const isDesktop = useMediaQuery('(min-width: 48em)');
	const isNative = Capacitor.isNativePlatform();
	const [ready, setReady] = useState(false);
	const [schedulingId, setSchedulingId] = useState<string | null>(null);
	const [sentId, setSentId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isNative) return;

		let cancelled = false;

		const setup = async () => {
			try {
				const perm = await LocalNotifications.requestPermissions();
				if (cancelled) return;
				if (perm.display !== 'granted') {
					setError(
						'Notifications are turned off for Field. Enable them in your device settings, then return here.',
					);
					return;
				}

				if (Capacitor.getPlatform() === 'android') {
					await LocalNotifications.createChannel({
						id: CHANNEL_ID,
						name: 'Field',
						description: 'Task and schedule updates',
						importance: 5,
						visibility: 1,
					});
				}

				if (!cancelled) setReady(true);
			} catch (err: unknown) {
				if (!cancelled) {
					setError(
						err instanceof Error
							? err.message
							: 'Could not set up notifications on this device.',
					);
				}
			}
		};

		void setup();
		return () => {
			cancelled = true;
		};
	}, [isNative]);

	if (isDesktop) {
		return <Navigate to='/' replace />;
	}

	const scheduleLocal = async (opts: {
		notificationId: string;
		title: string;
		body: string;
		extra: FieldNotificationExtra;
	}) => {
		setError(null);
		setSchedulingId(opts.notificationId);
		try {
			const notification: {
				id: number;
				title: string;
				body: string;
				schedule: { at: Date };
				extra: FieldNotificationExtra;
				channelId?: string;
			} = {
				id: allocId(),
				title: opts.title,
				body: opts.body,
				schedule: { at: new Date(Date.now() + DEFAULT_DELAY_MS) },
				extra: opts.extra,
			};
			if (Capacitor.getPlatform() === 'android') {
				notification.channelId = CHANNEL_ID;
			}

			await LocalNotifications.schedule({
				notifications: [notification],
			});
			setSentId(opts.notificationId);
		} catch (err: unknown) {
			setError(
				err instanceof Error
					? err.message
					: 'Could not schedule a test alert.',
			);
		} finally {
			setSchedulingId(null);
		}
	};

	const sendSample = (sample: SampleNotification) => {
		const extra: FieldNotificationExtra = {
			notificationId: sample.notificationId,
		};
		if (sample.day) extra.day = sample.day;
		return void scheduleLocal({
			notificationId: sample.notificationId,
			title: sample.title,
			body: sample.body,
			extra,
		});
	};

	const today = localDayKey(new Date());
	const samplesWithDay = SAMPLE_NOTIFICATIONS.map((s) =>
		s.notificationId === 'task_unassigned' ||
		s.notificationId === 'task_cancelled'
			? { ...s, day: today }
			: s,
	);

	return (
		<Box className='field-notifications-page'>
			<Title order={2} mb='lg' style={{ fontFamily: 'var(--font-display)' }}>
				Notifications
			</Title>

			{!isNative ? (
				<Text c='dimmed' size='sm'>
					Notification checks are only available in the Field mobile app.
				</Text>
			) : (
				<Stack gap='md'>
					<Text size='sm' c='dimmed'>
						Send test notifications to this device. Please wait up to 20
						seconds for the notification to appear.
					</Text>

					{error ? (
						<Alert color='red' title='Notifications unavailable'>
							{error}
						</Alert>
					) : ready ? (
						<Text size='sm' c='teal'>
							Notifications are enabled on this device.
						</Text>
					) : (
						<Text size='sm' c='dimmed'>
							Checking notification permission…
						</Text>
					)}

					<Stack gap='sm'>
						{samplesWithDay.map((sample) => {
							const isSent = sentId === sample.notificationId;
							const isScheduling =
								schedulingId === sample.notificationId;
							return (
								<Button
									key={sample.notificationId}
									color={isSent ? 'teal' : 'brand'}
									variant='light'
									fullWidth
									disabled={
										!ready || schedulingId !== null
									}
									loading={isScheduling}
									leftSection={
										isSent ? <Check size={16} /> : undefined
									}
									onClick={() => sendSample(sample)}
								>
									{isSent
										? 'Sent — watch for the alert'
										: sample.label}
								</Button>
							);
						})}
					</Stack>
				</Stack>
			)}
		</Box>
	);
}
