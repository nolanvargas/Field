#!/usr/bin/env node
import '../server/loadEnv.mjs';
import { purgeExpiredCancelledTasks } from '../server/purgeCancelledTasks.mjs';

const count = await purgeExpiredCancelledTasks();
console.log(`Archived ${count} cancelled task(s) past the retention window`);
