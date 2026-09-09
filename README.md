# Field

Field workforce management — React + TypeScript web app.

## First run (local)

```bash
npm install
docker compose up -d
npm run db:schema
npm run dev
```

- Web app: http://localhost:5173 (API on `:3000`)
- Database: Docker Postgres (`postgresql://field:field@localhost:5433/field` — port **5433** avoids conflict with a local PostgreSQL on 5432)
- Email: logged to the API terminal (`EMAIL_PROVIDER=console`)
- Attachments: stored under `./storage/attachments` (no S3 required)

Branding (`COMPANY_NAME`, `COMPANY_SUPPORT_EMAIL`) and optional AWS / identity provider / Maps keys live in `.env`. Copy [`.env.example`](.env.example) to get started. Web auth design: [`docs/auth.md`](docs/auth.md).

Optional **product** links (Field vendor SaaS UI — separate from org customer branding): `VITE_PRODUCT_SUPPORT_EMAIL`, `VITE_PRODUCT_HELP_URL`, `VITE_PRODUCT_TERMS_URL`, `VITE_PRODUCT_PRIVACY_URL`, `VITE_PRODUCT_BILLING_URL`. Defaults to example.com placeholders when unset; billing shows only for users with `manage_org`.

## Scripts you need

| When | Command |
|------|---------|
| Day-to-day web | `npm run dev` → http://localhost:5173 (API `:3000`) |
| Stop servers | `npm run dev:stop` |
| Tests | `npm test` / `npm run test:watch` |
| CI checks (local) | `npm run lint && npm test && npm run build` |
| Android live reload | `npm run adb:virtual` or `adb:physical` (keep `dev` running) |
| iOS live reload | `npm run cap:live -- ios` |
| Bundled Cap build | `npm run cap:sync` · open with `cap:android` / `cap:ios` |
| Debug APK sideload | `npm run apk:serve` |

Everything else (`db:*`, `email:test`, `android:keystore`) is occasional — see sections below or run `node scripts/<name>.mjs` directly. Clear ADB targets only: `node scripts/adb-unload.mjs`.

```bash
npm install
npm run dev
```

The web app proxies `/api` to the API. See [`AGENTS.md`](AGENTS.md) and [`docs/sdd.md`](docs/sdd.md).

### Testing

```bash
npm test           # run once (CI-friendly)
npm run test:watch # watch mode while developing
```

Vitest. Put tests under `tests/` as `*.test.ts` / `*.test.tsx`. CI runs `npm run lint`, `npm test`, and `npm run build` on every push and pull request (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

Manual QA: see [`docs/manual-test-overview.md`](docs/manual-test-overview.md) for test domains and progress checkboxes.

### Database schema

```bash
npm run db:schema
```

Applies migrations under [`db/migrations/`](db/migrations/) to the database in `DATABASE_URL` (Docker Postgres by default). Connection details in `.env`.

### Delivery docket PDF

From a task in the UI: **More actions → print templates** (`POST /api/print/:templateKey`) — renders the PDF and optionally stores it in `task_documents`. See [`docs/print-templates.md`](docs/print-templates.md). Delivery docket layout: [`docs/pdf-delivery-docket.md`](docs/pdf-delivery-docket.md).

### Mobile (Capacitor)

The same Vite build runs inside a Capacitor shell (`app.field.mobile`).

```bash
npm run adb:virtual   # drop phone ADB + live reload via 10.0.2.2 (emulator)
npm run adb:physical  # quit emulator + live reload via LAN IP (phone)
npm run cap:live -- ios   # iOS Simulator live reload (see ios-quickstart)
npm run cap:sync      # production-style: build web → copy into android/ and ios/ (local API)
npm run apk:serve     # build debug APK and serve over LAN for sideload
npm run cap:android   # sync (local API) + open Android Studio
npm run cap:ios       # sync (local API) + open Xcode (macOS only)
```

**Release signing (once)** — `FIELD_KEYSTORE_PASSWORD='…' npm run android:keystore` creates `android/keystore/field-release.jks` (gitignored). Back it up; losing it blocks updates to the same sideloaded app. Then `npm run cap:sync` and build a signed release APK in Android Studio (**Build → Generate Signed Bundle/APK**) or run `./gradlew assembleRelease` from `android/`.

**Switching devices** — Keep `npm run dev` running, then `npm run adb:virtual` or `npm run adb:physical`. That clears the other ADB target and points the Capacitor WebView at Vite. Run Field from Android Studio on the chosen device; refresh `chrome://inspect` after. To ship/test bundled assets again, run `npm run cap:sync` (clears the live-reload URL; local API). Clear ADB targets only: `node scripts/adb-unload.mjs`.

**Android Studio (this machine)** — Install Android Studio + an AVD (API 24+). Keep the host API up (`npm run dev`). Prefer `adb:virtual` / `adb:physical` for iteration, or `npm run cap:android` for a bundled build. Bundled builds reach the host API at `10.0.2.2:3000`.

**Physical Android device** — Enable Developer options + USB debugging (or Wireless debugging), `npm run adb:physical`, select the phone in Android Studio, Run. Bundled build API: `VITE_API_BASE=http://192.168.x.x:3000 npm run cap:sync`.

**iOS (Mac only)** — Full walkthrough: [`docs/ios-quickstart.md`](docs/ios-quickstart.md). Short version: clone/pull, `npm install`, configure `.env`, `npm run dev`, then `npm run cap:live -- ios` and open `ios/App/App.xcworkspace` in Xcode (or `npm run cap:ios` for a bundled build). Pick an iPhone simulator → Run.

If `ios/` is missing on the Mac, run `npx cap add ios` once and commit it.
