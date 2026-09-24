# Cursor Windows update — Access denied on `cursor_bak`

Updater can fail cleanup of `cursor_bak\resources` (os error 5) while the live install still works. Common lock: `resources\app\bin` on user PATH — VS Code (`Code.exe`) or Cursor’s own `node.exe` / `rg.exe` hold handles.

**Before updating:** fully exit Cursor, close VS Code, run `cursor-update-prep.ps1` from the user agent store (`u301697429/files`), or reboot.

**If the modal appears during update:** rename `cursor_bak`, click Cancel; delete the renamed folder later.

Nolan machine (2026-03): install at `%LOCALAPPDATA%\Programs\cursor`; PATH includes `...\resources\app\bin` and ripgrep bin; no `cursor_bak` when last checked.
