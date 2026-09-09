/**
 * Alpha Industries provisioning stub — deferred until deployed infrastructure exists.
 *
 * See docs/official-orgs.md and scripts/alpha-industries/README.md.
 */
import { ALPHA_INDUSTRIES } from '../../shared/officialOrgs.js';

console.log(`${ALPHA_INDUSTRIES.displayName} provisioning is deferred.`);
console.log('');
console.log('Alpha Industries requires a separate hosted deployment with:');
console.log('  - Persistent API + database');
console.log('  - Real email provider or dedicated test sink (not console)');
console.log('  - Durable file storage (S3 or equivalent)');
console.log('  - PUBLIC_APP_URL for tracking links');
console.log('');
console.log('Local Sandbocks dev (npm run db:reset) is unaffected.');
console.log('See docs/official-orgs.md for the full provisioning gate and config checklist.');
