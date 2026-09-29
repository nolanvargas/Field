# Task search uses the external key

Find task matches `tasks.external_key` exactly. It does not match `tasks.id`.

One visible match opens the task modal on the current page. Two or more open the search results modal (key, title, type, created time). The results modal stays open under the task until it is closed itself.

`org_settings.allow_duplicate_external_keys` defaults to true. Turning it off refuses a new share only: create with a key another live task already has, or an edit that changes a key onto one another live task has. Tasks that already share a key stay valid, including cancelled tasks. Soft-deleted tasks do not count. There is no unique index.

Seed keys that open the results list are in [`docs/manual-test/a-shell-navigation.md`](../manual-test/a-shell-navigation.md). `99501` is a single match.
