# fieldwm.com — marketing site

Static landing page (mockup **H**: hero + three role sections). **Not** part of the Field Vite app or Capacitor build.

## Preview locally

```bash
npm run www:serve
```

Open http://localhost:3000 (or the port `serve` prints).

## Deploy

Upload the contents of `sites/www/` to static hosting for **fieldwm.com**. Point the product app at a separate host (e.g. `app.fieldwm.com`) when ready.

## Screenshots

Device frames use **CSS placeholders** until you add PNGs under `assets/screenshots/`. Replace each placeholder block in `index.html` with an `<img>` (see `assets/screenshots/README.md`), or drop files in place and swap markup — keep filenames stable.

Capture guide: [`docs/AGENTS/mockup-h-screenshots.md`](../../docs/AGENTS/mockup-h-screenshots.md).

## Contact form

The form does not submit yet. Use `hello@fieldwm.com` or wire a provider later.
