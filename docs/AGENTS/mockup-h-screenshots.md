# Mockup H — real app screenshot assets

Production landing page: [`sites/www/`](../../sites/www/). Mockup reference: [`mockups/fieldwm/h-hero-and-roles/`](../../mockups/fieldwm/h-hero-and-roles/). Use PNG captures from a running local Field build (replace CSS placeholders in `sites/www/index.html`).

## Files (`sites/www/assets/screenshots/`)

| File | Source route | Viewport |
|------|----------------|----------|
| `app-tasks-desktop.png` | `/tasks` (All tab) | 1280×800 desktop |
| `app-my-tasks-mobile.png` | `/my-tasks` | 390×844 mobile |
| `app-deliver-mobile.png` | `/task/99501/deliver` | 390×844 mobile |
| `app-tracking-desktop.png` | `/tracking-page-preview` | 1280×900 desktop |
| `app-tracking-mobile.png` | same | 390×844 mobile |

## Tracking preview setup

`/tracking-page-preview` reads `localStorage` key `field-tracking-page-preview`. Before capture, set payload (Delivery default template + `#b45309` accent) via Management → Tracking page → Preview full page, or inject the same JSON the Management preview uses (`defaultTrackingPageTemplate('Delivery')` + accent from org settings).

## Regenerate

1. `npm run dev` with seed data loaded.
2. Capture at the viewports above (browser devtools device mode for mobile).
3. Save PNGs under `sites/www/assets/screenshots/` and swap each `.app-shot-placeholder` for an `<img>` (see that folder’s README).
