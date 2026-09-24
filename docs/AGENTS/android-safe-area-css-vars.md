# Android safe-area CSS variables

On Android, `env(safe-area-inset-*)` is often `0` in the Capacitor WebView. **Do not** mirror system bar insets into global `:root` vars for AppShell — that double-pads the main app (WebView / Mantine already account for the tab bar).

Activation only: `src/nativeSafeAreaInsets.ts` sets `--field-auth-safe-area-top/bottom` for `.field-auth-bg` when `env()` is zero (rough dp fallback). iOS uses `env()` via the same CSS vars.

Rebuild the APK only when changing `MainActivity.java`; auth inset tweaks are web-only (`npm run dev` / live reload).
