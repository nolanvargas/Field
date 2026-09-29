# T — Archive / purge

Pass for domain **T**. Setup and progress: [`manual-test-overview.md`](../manual-test-overview.md).

| | |
|---|---|
| **Entry** | Cancel task; `npm run db:purge-cancelled` |
| **Setup** | Short cancel retention in N (e.g. 3 days) |
| **Depends on** | L, N |

- [ ] Cancelled task shows an archive deadline
- [ ] After the purge script (or an expired `archive_at`), the task is gone from the Cancelled tab
