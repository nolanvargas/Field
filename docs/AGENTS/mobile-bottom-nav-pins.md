# Mobile bottom tab bar pins

Optional footer tabs (Contacts, Addresses, All tasks) are toggled on **More → Tab bar**; prefs live in `localStorage` key `field.mobileBottomNavPins` (`src/mobileBottomNavPrefs.ts`). My Tasks and More are always shown. Defaults match the old layout: Contacts pinned, Addresses in More only, All tasks pinned when the user has `view_all_tasks`.
