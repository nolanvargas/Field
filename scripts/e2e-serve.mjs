/**
 * Start API + Vite for Playwright E2E (stub auth — no FIELD_API_REQUIRE_AUTH).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DEV_PORTS, freeDevPorts, killProcessTree } from "./dev-ports.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

freeDevPorts();

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

/** @type {NodeJS.ProcessEnv} */
const e2eEnv = { ...process.env };
delete e2eEnv.FIELD_API_REQUIRE_AUTH;

/**
 * @param {string} label
 * @param {string} command
 * @param {string[]} args
 */
function run(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: e2eEnv,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.error(`${label} exited from signal ${signal}`);
    } else {
      console.error(`${label} exited with code ${code ?? "null"}`);
    }
    shuttingDown = true;
    for (const c of children) {
      if (c !== child && c.pid && c.exitCode === null) {
        killProcessTree(c.pid);
      }
    }
    process.exit(code ?? 1);
  });
}

run("API", process.execPath, [resolve(root, "server/index.mjs")]);
run("Vite", process.execPath, [
  resolve(root, "node_modules/vite/bin/vite.js"),
  "--host",
  "127.0.0.1",
  "--port",
  String(DEV_PORTS.web),
  "--strictPort",
]);

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.pid && c.exitCode === null) {
      killProcessTree(c.pid);
    }
  }
  freeDevPorts();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
