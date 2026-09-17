# Grid layout debug logs

In `npm run dev`, column resize / full-width layout logs to the console as `[grid-layout]`. Filter DevTools by that prefix.

- Default on in Vite dev (off in tests).
- Disable: `localStorage.setItem('field.gridLayoutDebug','0')` then reload.
- Force on: `localStorage.setItem('field.gridLayoutDebug','1')`.

Watch `hitFullWidth`, `applyAdaptiveGridLayout.hit-full-width`, `forceFullWidth-toggle`, and `willSizeColumnsToFit` when reproducing the full-width resize bug.
