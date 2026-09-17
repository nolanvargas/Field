import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { registerMobilePushToken } from '../api/mobile';
const CHANNEL_ID = 'field_task';

let started = false;

function readExtra(
	data: Record<string, unknown> | undefined,
): Record<string, string> | null {
	if (!data) return null;
	const notificationId = data.notificationId;
	if (typeof notificationId !== 'string' || !notificationId) return null;
	const out: Record<string, string> = { notificationId };
	if (data.taskId != null) out.taskId = String(data.taskId);
	if (typeof data.day === 'string') out.day = data.day;
	return out;
}

async function ensureAndroidChannel(): Promise<void> {
	if (Capacitor.getPlatform() !== 'android') return;
	await LocalNotifications.createChannel({
		id: CHANNEL_ID,
		name: 'Task updates',
		description: 'Assignments, schedule changes, and cancellations',
		importance: 5,
		visibility: 1,
	});
}

async function showForegroundTray(
	title: string,
	body: string,
	extra: Record<string, string>,
): Promise<void> {
	const id = Math.floor(Date.now() % 1_000_000);
	await LocalNotifications.schedule({
		notifications: [
			{
				id,
				title,
				body,
				schedule: { at: new Date(Date.now() + 300) },
				extra,
				...(Capacitor.getPlatform() === 'android'
					? { channelId: CHANNEL_ID }
					: {}),
			},
		],
	});
}

/**
 * Register FCM, upload token, and mirror remote pushes in the foreground tray.
 * Call once on native when a device session exists.
 */
export async function startMobilePushRegistration(): Promise<void> {
	if (!Capacitor.isNativePlatform() || started) return;
	started = true;

	const { PushNotifications } = await import('@capacitor/push-notifications');

	const perm = await PushNotifications.requestPermissions();
	if (perm.receive !== 'granted') {
		console.warn('[push] notification permission not granted');
		return;
	}

	await ensureAndroidChannel();

	await PushNotifications.addListener('registration', (event) => {
		const token = event.value?.trim();
		if (!token) return;
		void registerMobilePushToken(token).catch((err) => {
			console.error('[push] token registration failed', err);
		});
	});

	await PushNotifications.addListener('registrationError', (err) => {
		console.error('[push] registration error', err);
	});

	// Capacitor passes PushNotificationSchema directly (not wrapped in `.notification`).
	await PushNotifications.addListener('pushNotificationReceived', (notification) => {
		const title = notification.title ?? 'Field';
		const body = notification.body ?? '';
		const extra = readExtra(
			notification.data as Record<string, unknown> | undefined,
		);
		if (!extra) return;
		void showForegroundTray(title, body, extra).catch((err) => {
			console.error('[push] foreground tray failed', err);
		});
	});

	await PushNotifications.register();
}
