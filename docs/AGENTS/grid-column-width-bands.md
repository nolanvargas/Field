# Grid column width bands (desktop)

Desktop AG Grid pages persist **column widths** in three bands from **pane inner width only** (`gridPaneInnerWidth` in `src/agGridDefaults.ts`): narrow ≤1280px, medium 1281–1999px, wide ≥2000px. Column order and sort are shared across bands (`src/gridColumnWidthBands.ts`).

Widths are saved only on **user** resize: header wheel (`onUserColumnWidthsSettled` via `useBandedColumnWidthSaveBridge`) or mobile handle drag (`columnResized` with `uiColumnResized` / `uiColumnDragged`). `sizeColumnsToFit` and window resize never write storage.

Band does **not** use column sum or compact wrap width — widening columns past 2000px total while the pane stays ≥2000px stays in the wide band.

Legacy flat `columnState` / task `field:taskGridColumnState` arrays migrate on read into v2 (`widthsByBand.wide`).
