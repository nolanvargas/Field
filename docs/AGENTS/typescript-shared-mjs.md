# TypeScript declarations for `shared/*.mjs`

Imports like `from '../../shared/curatedTasks.mjs'` resolve to the `.mjs` file; TypeScript strips `.mjs` and looks for companion types as **`shared/curatedTasks.d.mts`** (not `curatedTasks.mjs.d.ts`).

For `shared/*.js` modules, use **`shared/foo.d.ts`** next to `foo.js` (same pattern as `attachmentMimeCategories.js`).

`tsconfig.app.json` includes `shared`; no extra paths needed.
