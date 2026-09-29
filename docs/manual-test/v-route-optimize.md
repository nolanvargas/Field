# V — Route optimize (API only)

Pass for domain **V**. Setup and progress: [`manual-test-overview.md`](../manual-test-overview.md).

| | |
|---|---|
| **Entry** | `POST /api/routes/optimize` (curl or devtools) |
| **Env** | `GOOGLE_MAPS_API_KEY` |
| **Depends on** | Maps profile |

No UI yet.

- [ ] Request with task IDs that have destination coordinates
- [ ] Response includes `orderedTaskIds` and `mapsUrl`
