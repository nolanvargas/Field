# Field product brand (Caramel)

- **Mark gradient (top → bottom):** `#FBBF24` → `#92400E` — canonical constants in `shared/fieldBrand.js` (`FIELD_BRAND_GRADIENT_*`).
- **Default org accent:** `#B45309` (`FIELD_BRAND_ACCENT`) — Sandbocks via `scripts/lib/org-config-defaults.mjs`; UI shades from `shared/orgAccent.js`.
- **SVGs** (`public/logo.svg`, favicon, hamburger assets, `sites/www`, mockups) duplicate the two gradient stops; update them when changing `fieldBrand.js`.
- **Native splash:** `npm run branding:native-splash` after `logo.svg` changes — iOS `Splash.imageset`; Android `drawable/splash.xml`, all `drawable-port-*` / `drawable-land-*` `splash.png`, and `mipmap-*` launcher PNGs (Android 12+ splash uses the adaptive icon). Rebuild and reinstall the APK; live reload does not update OS splash.
- **Existing DBs:** migration `074_field_caramel_brand_accent.sql` rewrites `#732e75` → `#b45309`. Run `npm run db:schema` after pull.
- Demo static builds use **Showcase INC** accent in `src/demo/fixtures/boot.ts`, not Field caramel.
