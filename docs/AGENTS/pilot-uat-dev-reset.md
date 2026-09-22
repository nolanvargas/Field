# Pilot UAT after `db:reset`

- After `npm run db:reset`, **restart the API** (`npm run dev:stop` then `npm run dev`) before manual or scripted pilot UAT. The org-settings cache can otherwise resolve **retired** `org_task_types` and task create fails with `Cannot assign a retired task type`.
- Integration tests used to `DELETE` `delivery_docket` from `org_print_templates` on teardown; cleanup now re-upserts the Sandbocks seed so pilot print steps work after `npm run test:integration`.
- Scripted path: `node scripts/run-pilot-uat.mjs uat-pilot-1` then reset + API restart + `uat-pilot-2` (see `docs/pilot-uat-script.md` Run C / issue #7).
