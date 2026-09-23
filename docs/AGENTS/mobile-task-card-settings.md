# Mobile task card settings vs cards

Mobile **Card settings** (`TasksPage` + `getMobileTaskCardBuiltinColumnOptions`) is not a 1:1 mirror of desktop grid columns.

- **Hidden toggles:** `externalKey`, `taskType`, `status` — always on the card (type + job in header, status badge).
- **Window:** one **Window** checkbox maps to both `windowStartAt` and `windowEndAt` in shared `field:taskGridColumns` storage (`applyMobileTaskCardWindowColumnToggle`).
- **Card body:** combined Window row only; no separate Start/End rows. Header always includes task type (`taskCardHeaderLabel`).
- **Compact:** `field:mobileTaskCardCompact`; status dot, tighter CSS in `tasks.css`, window times use `compactAgo`.

Desktop grid settings still expose Start/End separately; same localStorage keys.
