# U — Email pipeline

Pass for domain **U**. Setup and progress: [`manual-test-overview.md`](../manual-test-overview.md).

| | |
|---|---|
| **Entry** | Complete or fail a task; API terminal |
| **Env** | `PUBLIC_APP_URL` for tracking CTA in email |
| **Depends on** | C or S |

- [ ] Console email on Completed: Delivery → order-delivered
- [ ] Console email on Completed: Install, Removal, and Site Survey → task-completed
- [ ] Console email on Failed
- [ ] Recipients are contacts with `receives_email`
- [ ] CLI smoke: `npm run email:test -- --task-id 1 --kind task-completed`
