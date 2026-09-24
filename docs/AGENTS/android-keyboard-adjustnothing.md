# Android keyboard + WebView resize

Field does **not** shrink `AppShell` with `--field-keyboard-inset`. The IME resizes the WebView instead:

- `capacitor.config.ts` — `Keyboard.resize: 'body'`, `resizeOnFullScreen: true` (edge-to-edge)
- `AndroidManifest.xml` — `android:windowSoftInputMode="adjustResize"` on `MainActivity`
- Mobile shell CSS uses `height: 100%` / flex on `.field-app-shell`, not `100dvh` on main (layout dvh ignores a shrunk WebView and caused a blank band above the keyboard).

Modals use `height: 100%` on mobile fullscreen; no JS keyboard-height tracking.

Config/manifest changes need a native rebuild (`cap sync` + Run from Android Studio), not Vite live reload alone.
