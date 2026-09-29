# Exclusive task view

A task opened on its own is either the mobile page or the desktop modal. `exclusiveTaskAction` in `src/exclusiveTaskView.ts` picks one from `useCompactMobileTaskUi()` (`src/auth/nativeAuthKind.ts`): a narrow viewport uses the page, except native IdP, which keeps the desktop modal.

List clicks and search both call `openTask` on `ExclusiveTaskContext` (provided by the shell).

- Narrow: navigate to `/task/:id` (`TaskViewPage`).
- Wide: `TaskDetailModal` in the shell, over the current page. A wide `/task/:id` (deep link, or after the window grows) shows that same modal. Closing it leaves the route.
- Resizing swaps them. Narrowing a modal goes to `/task/:id`. Widening that page shows the modal.
