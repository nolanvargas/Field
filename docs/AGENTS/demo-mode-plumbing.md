# Demo mode (client mock API)

Static demo builds run the **same React app** with no Node/Postgres. `VITE_DEMO_MODE=true` routes `apiFetch` through `src/demo/router.ts` and an in-memory store.

## Local dev (API off)

```bash
npm run dev:stop
npx vite --mode demo
```

Or set `VITE_DEMO_MODE=true` in `.env` and run Vite only (do not start `server/index.mjs`).

## Production artifact

```bash
npm run build:demo
```

`build:demo` runs `scripts/export-showcase-branding.mjs` first (regenerates `public/demo/showcase-mark.png` only; `showcase-logo.png` is hand-maintained). Demo org branding: **Showcase INC** (`src/demo/fixtures/boot.ts`, `VITE_COMPANY_NAME` in `.env.demo`).

Deploy `dist/` to static hosting (e.g. `demo.fieldwm.com`).

## Boot endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/config` | Stub web auth + accent |
| GET | `/api/users` | Demo roster |
| GET | `/api/org/settings` | Org catalog for shell |
| GET | `/api/org/print-templates` | Print menu cache sync |
| GET | `/api/tasks` | 100 tasks, month-grid heatmap distribution, `created_at` desc sort |
| GET | `/api/tasks/:id` | Task detail + attachments |
| GET | `/api/tasks/:id/attachments` | Attachment list |
| GET | `/api/tasks/:id/attachments/:id/url` | Static file under `public/demo/` |
| GET | `/api/tasks/:id/history` | Status / crew / attachment history |

All other paths → **501** `{ error: "Not available in demo" }`.

## Extend

1. Add data to `src/demo/fixtures/` and wire in `src/demo/store.ts`.
2. Add handler under `src/demo/handlers/`.
3. Register method + pathname in `src/demo/router.ts`.

Demo admin user id: `DEMO_ADMIN_USER_ID` in `src/demo/fixtures/boot.ts`.

Native Capacitor builds ignore `VITE_DEMO_MODE`.
