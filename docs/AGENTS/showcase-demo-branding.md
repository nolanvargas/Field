# Showcase INC demo branding

Demo static builds present tenant **Showcase INC** (not Sandbocks).

- Vector sources: `assets/org-logos/showcase-inc-logo.svg` (wordmark + mark), `showcase-inc-mark.svg` (icon only).
- Raster output: `public/demo/showcase-logo.png`, `showcase-mark.png` (transparent PNG via Sharp).
- Regenerate: `npm run branding:showcase-demo` (also runs at the start of `npm run build:demo`).
- Runtime: `src/demo/fixtures/boot.ts` sets `accentColor`, `logoUrl`, `logoHighContrast`; `.env.demo` sets `VITE_COMPANY_NAME` for tracking/footer copy.
