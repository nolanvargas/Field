# Task search uses the external key

Find task matches `tasks.external_key` exactly. It does not match `tasks.id`.

One visible match opens that task. Two or more open the search results modal (key, title, type, created time). Choosing a row opens the task the same way. Which screen that is — mobile page or desktop modal — is in [`exclusive-task-view.md`](exclusive-task-view.md). On a wide screen the results modal stays open under the task until it is closed itself. On a narrow screen it closes when the task page opens.

`org_settings.allow_duplicate_external_keys` defaults to true. Turning it off refuses a new share only: create with a key another live task already has, or an edit that changes a key onto one another live task has. Tasks that already share a key stay valid, including cancelled tasks. Soft-deleted tasks do not count. There is no unique index.

Seed keys that open the results list are in [`docs/manual-test/a-shell-navigation.md`](../manual-test/a-shell-navigation.md). `99501` is a single match.
