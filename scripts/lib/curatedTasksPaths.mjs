import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const CURATED_ROOT = path.join(REPO_ROOT, "fixtures", "curated");
export const CURATED_INDEX_PATH = path.join(CURATED_ROOT, "index.json");
export const CURATED_TASKS_DIR = path.join(CURATED_ROOT, "tasks");
export const CURATED_FILES_DIR = path.join(CURATED_ROOT, "files");
export const CURATED_FILES_MANIFEST_PATH = path.join(
	CURATED_FILES_DIR,
	"manifest.json",
);

export const PUBLIC_DEMO_CURATED_DIR = path.join(
	REPO_ROOT,
	"public",
	"demo",
	"curated",
);
