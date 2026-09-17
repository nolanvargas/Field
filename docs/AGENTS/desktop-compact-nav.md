# Desktop compact nav (1280px breakpoint)

Live shell uses compact rail + drawer from `src/styles/compactNav.css` on viewports ≥48em (Mantine `sm`).

| Viewport | Default open (no sessionStorage) | Expanded layout |
| --- | --- | --- |
| ≤1280px | Closed (rail) | Drawer overlays main; rail offset stays 4rem; click backdrop or Escape to close |
| >1280px | Open (drawer) | Main `--app-shell-navbar-offset` is 240px (no overlay) |

User toggle state: `sessionStorage` key `field.compactNavOpen` (`src/shellCompactNav.ts`). Survives refresh and expand/collapse; not reset on resize.

Shell flags: `data-nav-open`, `data-nav-push` (wide + open only) on `.field-app-shell.field-compact-nav`.

`useMediaQuery(COMPACT_NAV_WIDE_MQ, matchesCompactNavWideMq(), …)` must match `initialCompactNavOpen()` so push layout and default open state agree on first paint (avoid 64px→240px flip that hammers AG Grid `onGridSizeChanged`).
