# Responsively App — Field presets

Preset file: `devtools/responsively-field.json`. Apply: quit Responsively, `npm run responsively:config`, reopen.

## Preview suites

| Suite | Use |
| --- | --- |
| Field desktop (quick) | Default — 1024 / 1536 / 1920 for day-to-day web work |
| Field desktop (min–max) | Full 1024–2560 sweep (256px steps) |
| Field crew mobile (quick) | 375 / 390 / 430 — Capacitor crew UI (portrait) |
| Field crew mobile (min–max) | 375–430 (16px steps), portrait |
| Field crew mobile landscape (quick) | 812×375 / 844×390 / 931×430 — sideways phone |
| Field crew mobile landscape (min–max) | Short side 375–430 (16px steps), long side ×2.165 |
| Field layout breakpoints | 767 / 896 / 1024 — matches `tasks.css` 48em & 56em cuts |
| Field tracking page | 360 / 390 / 768 / 1280 — public `/t/:token` & preview |

Switch suites in Responsively **Device Manager** (not in repo).

## Bookmarks

Common dev URLs including `/tracking-page-preview` and a placeholder `/t/REPLACE_WITH_TASK_TRACKING_TOKEN` (copy token from a task in the app).

## Other

- Screenshots → `storage/responsively-screenshots/` (gitignored).
- `webPermissions` grants geolocation on `http://localhost:5173` for crew map testing.
- Windows config: `%APPDATA%\ResponsivelyApp\config.json`.
