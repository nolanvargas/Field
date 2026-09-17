# Showcase INC demo branding

Demo static builds present tenant **Showcase INC** (not Sandbocks).

- Vector sources: `assets/org-logos/showcase-inc-logo.svg` (wordmark + mark), `showcase-inc-mark.svg` (icon only).
- `public/demo/showcase-logo.png` — **hand-maintained** for demo layout; edit in place; do not regenerate from SVG.
- `public/demo/showcase-mark.png` — regenerated from `showcase-inc-mark.svg` via Sharp.
- Regenerate mark only: `npm run branding:showcase-demo` (also runs at the start of `npm run build:demo`).
- Runtime: `src/demo/fixtures/boot.ts` sets `accentColor`, `logoUrl`, `logoHighContrast`; `.env.demo` sets `VITE_COMPANY_NAME` for tracking/footer copy.
