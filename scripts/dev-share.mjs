/**
 * Build the production app, serve it on this PC, and publish it
 * through the password gate and a Cloudflare quick tunnel.
 *
 * Leaves an already-running local API (npm run dev) in place.
 * Ctrl+C stops the preview, the password page, and the tunnel.
 */
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEV_PORTS,
  freeDevPorts,
  killProcessTree,
  pidsListeningOnPort,
} from "./dev-ports.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previewPort = 4173;
const gatePort = 5199;
const passwordFile = resolve(tmpdir(), "field-dev-tunnel-password.txt");

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;
let startedApi = false;

function password() {
  const fromEnv = process.env.DEV_TUNNEL_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(passwordFile)) {
    const saved = readFileSync(passwordFile, "utf8").trim();
    if (saved) return saved;
  }
  const created = randomBytes(12).toString("base64url");
  writeFileSync(passwordFile, created, "utf8");
  return created;
}

function cloudflaredBin() {
  const named = process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
  const local = resolve(tmpdir(), named);
  if (existsSync(local)) return local;
  return named;
}

function stopPreviousTunnel() {
  if (process.platform !== "win32") return;
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" | Where-Object { $_.CommandLine -match ':${gatePort}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
      ],
      { stdio: "ignore" },
    );
  } catch {
    /* none running */
  }
}

function runBuild() {
  execFileSync(
    process.execPath,
    [resolve(root, "node_modules/typescript/lib/tsc.js"), "-b"],
    { cwd: root, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "build",
      "--base",
      "/",
      "--outDir",
      "dist-tunnel",
    ],
    { cwd: root, stdio: "inherit" },
  );
}

/**
 * @param {string} label
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string, string | undefined>} [extraEnv]
 * @param {{ onOutput?: (text: string) => void }} [opts]
 */
function run(label, command, args, extraEnv, opts) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: opts?.onOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
    env: { ...process.env, ...extraEnv },
  });
  children.push(child);
  child.on("error", (err) => {
    if (shuttingDown) return;
    console.error(`${label} failed to start: ${err.message}`);
    if (label === "Tunnel" && /** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") {
      console.error(
        "Download the Windows cloudflared binary and save it as %TEMP%\\cloudflared.exe",
      );
      console.error(
        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
      );
    }
    shutdown(1);
  });
  if (opts?.onOutput && child.stdout && child.stderr) {
    const forward = (chunk) => {
      const text = String(chunk);
      process.stdout.write(text);
      opts.onOutput?.(text);
    };
    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
  }
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.error(`${label} exited from signal ${signal}`);
    } else {
      console.error(`${label} exited with code ${code ?? "null"}`);
    }
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.pid && child.exitCode === null) {
      killProcessTree(child.pid);
    }
  }
  freeDevPorts([previewPort, gatePort]);
  process.exit(code);
}

const tunnelPassword = password();
const tunnelBin = cloudflaredBin();

console.log("Building the shared site…");
try {
  runBuild();
} catch {
  process.exit(1);
}

stopPreviousTunnel();
freeDevPorts([previewPort, gatePort]);

if (pidsListeningOnPort(DEV_PORTS.api).length > 0) {
  console.log(`Using the API already running on port ${DEV_PORTS.api}.`);
} else {
  startedApi = true;
  run("API", process.execPath, ["server/index.mjs"]);
}

run("Preview", process.execPath, [
  resolve(root, "node_modules/vite/bin/vite.js"),
  "preview",
  "--host",
  "127.0.0.1",
  "--port",
  String(previewPort),
  "--strictPort",
  "--outDir",
  "dist-tunnel",
]);

run(
  "Password",
  process.execPath,
  ["scripts/dev-tunnel-gate.mjs"],
  {
    DEV_TUNNEL_PASSWORD: tunnelPassword,
    DEV_WEB_PORT: String(previewPort),
    DEV_GATE_PORT: String(gatePort),
  },
);

let announced = false;
run(
  "Tunnel",
  tunnelBin,
  ["tunnel", "--url", `http://127.0.0.1:${gatePort}`, "--no-autoupdate"],
  undefined,
  {
    onOutput(text) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (!match || announced) return;
      announced = true;
      console.log("");
      console.log(`Shared site: ${match[0]}`);
      console.log(`Password: ${tunnelPassword}`);
      console.log("Press Ctrl+C to close the shared site.");
      if (startedApi) {
        console.log("This command also started the API. Ctrl+C will stop it.");
      }
      console.log("");
    },
  },
);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
