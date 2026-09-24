# Offline connectivity banner

`ConnectivityBanner` (native: `MobileAuthGate` shell; web: `AppShell` main) listens to `window` `online`/`offline` and `reportNetworkFetchFailure` / `reportNetworkFetchSuccess` from `apiFetch` in `src/api/client.ts`. It does not cache task data — it only explains why refreshes fail.
