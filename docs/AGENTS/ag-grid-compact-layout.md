# AG Grid compact layout

Compact mode shrink-wraps **width** to the column sum when it fits the pane (`contentWidth <= maxInner`), including exact fill. Header-wheel conserves total width only when **Full width** is checked — layout `full` from overflow must not steal width from other columns. Height always fills the remaining pane so AG Grid uses its default (`normal`) layout and owns vertical scroll — that keeps column headers sticky.

Do not set `domLayout="autoHeight"` for compact. Auto-height grows the grid with rows, so the outer pane scrolls and headers move with content. AG Grid has no community/enterprise sticky-header option for that case (AG-936).

`useAdaptiveGridLayout.apply` and `onGridSizeChanged` handlers defer React state / layout work with `queueMicrotask` so shell width changes (compact nav push) do not call `setState` during AG Grid’s layout commit (avoids “Maximum update depth exceeded” in cell renderers).

Adaptive layout is a function of **pane inner width + column content**, not wrap width. Do not call `runAdaptiveLayout` from programmatic `columnResized` (`autosizeColumns` / `sizeColumnsToFit`) — those events are outputs of layout and will loop. Ignore `onGridSizeChanged` when pane inner width is unchanged (wrap shrink/grow only). Do not re-run layout when React re-renders from `layoutMode` — persist callbacks must not depend on the adaptive-layout object identity, and TaskDayGrid must not `onColumnDefsChanged` on a new `gridSession` object.

When `skipAutoSize` is on (saved band widths), `applyAdaptiveGridLayout` compares **persisted** band width sum to the pane. If saved widths exceed the pane, layout stays **full** and keeps those widths (no `sizeColumnsToFit`) even when displayed columns were temporarily fitted.
