# Android FCM setup

- Native package **must** be `app.field.mobile` in Firebase and in `android/app/google-services.json`. A typo like `pp.field.mobile` breaks token registration.
- `google-services.json` lives at `android/app/`; Gradle applies the Google Services plugin when that file exists.
- Live reload (`npm run adb:physical`) still uses a real APK — FCM works after a native rebuild when push plugin changes.
- `POST /api/mobile/push-token` accepts the device session Bearer token (works even when web auth stub is off).
- Foreground pushes are mirrored via `@capacitor/local-notifications` on channel `field_task`. In `pushNotificationReceived`, Capacitor passes `title` / `body` / `data` on the listener argument itself (not `event.notification`).
- Crew assign push on edit only fires for **newly added** crew on that save (`notifyTaskUpdated` → `task_assigned`).
