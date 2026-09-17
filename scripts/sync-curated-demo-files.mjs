/**
 * Copy curated attachment binaries to public/demo/curated for static demo hosting.
 */
import { syncCuratedFilesToPublicDemo } from "./lib/curatedTasks.mjs";

await syncCuratedFilesToPublicDemo();
console.log("Synced curated fixture files to public/demo/curated");
