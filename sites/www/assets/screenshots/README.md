# Screenshot assets

Drop PNGs here and replace the matching `.app-shot-placeholder` in `index.html` with:

```html
<img src="assets/screenshots/<filename>" alt="" width="…" height="…" loading="lazy" decoding="async" />
```

| File | Route | Viewport |
|------|--------|----------|
| `app-tasks-desktop.png` | `/tasks` (All) | 1280×800 |
| `app-deliver-mobile.png` | `/task/:id/deliver` | 390×844 |
| `app-my-tasks-mobile.png` | `/my-tasks` | 390×844 |
| `app-tracking-desktop.png` | `/tracking-page-preview` | 1280×900 |
| `app-tracking-mobile.png` | same | 390×844 |

Regenerate from a running dev build: [`docs/AGENTS/mockup-h-screenshots.md`](../../../../docs/AGENTS/mockup-h-screenshots.md).
