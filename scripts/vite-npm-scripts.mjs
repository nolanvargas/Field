/**
 * Dev-only Vite middleware: npm script catalog, edit package.json scripts, run with streamed output.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(root, "package.json");
const descriptionsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "npm-script-descriptions.json",
);

/** @type {Map<string, RunState>} */
const runs = new Map();

/**
 * @typedef {{
 *   child: import('node:child_process').ChildProcess,
 *   stdout: string,
 *   stderr: string,
 *   exitCode: number | null,
 *   done: boolean,
 *   clients: Set<import('node:http').ServerResponse>,
 * }} RunState
 */

/**
 * @param {import('node:http').IncomingMessage} req
 */
function readBody(req) {
  return new Promise((resolveBody, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

/**
 * @param {string} raw
 */
function parseJsonBody(raw) {
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

async function readPackageJson() {
  const text = await readFile(packageJsonPath, "utf8");
  return JSON.parse(text);
}

/**
 * @param {Record<string, unknown>} pkg
 */
async function writePackageJson(pkg) {
  const next = `${JSON.stringify(pkg, null, "\t")}\n`;
  await writeFile(packageJsonPath, next, "utf8");
}

async function readDescriptions() {
  try {
    const text = await readFile(descriptionsPath, "utf8");
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [String(key), String(value)]),
    );
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return {};
    }
    throw err;
  }
}

/**
 * @param {Record<string, string>} descriptions
 */
async function writeDescriptions(descriptions) {
  const next = `${JSON.stringify(descriptions, null, "\t")}\n`;
  await writeFile(descriptionsPath, next, "utf8");
}

async function listScripts() {
  const pkg = await readPackageJson();
  const scripts = pkg.scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
    return { scripts: {}, descriptions: await readDescriptions() };
  }
  return { scripts, descriptions: await readDescriptions() };
}

/**
 * @param {Record<string, string>} scripts
 */
async function saveScripts(scripts) {
  const pkg = await readPackageJson();
  pkg.scripts = scripts;
  await writePackageJson(pkg);
  const descriptions = await readDescriptions();
  return { scripts, descriptions };
}

/**
 * @param {string} name
 * @param {string} description
 */
async function saveDescription(name, description) {
  const descriptions = await readDescriptions();
  descriptions[name] = description;
  await writeDescriptions(descriptions);
  const { scripts } = await listScripts();
  return { scripts, descriptions };
}

/**
 * @param {string} name
 */
async function deleteDescription(name) {
  const descriptions = await readDescriptions();
  delete descriptions[name];
  await writeDescriptions(descriptions);
  const { scripts } = await listScripts();
  return { scripts, descriptions };
}

/**
 * @param {RunState} run
 * @param {string} event
 * @param {unknown} payload
 */
function broadcast(run, event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of run.clients) {
    client.write(data);
  }
}

/** Strip ANSI escape sequences (colors, cursor moves) from terminal output. */
function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

/**
 * @param {RunState} run
 * @param {'stdout' | 'stderr'} stream
 * @param {string} text
 */
function appendOutput(run, stream, text) {
  const clean = stripAnsi(text);
  if (stream === "stdout") run.stdout += clean;
  else run.stderr += clean;
  broadcast(run, "output", { stream, text: clean });
}

/**
 * @param {{ name?: string, command?: string }} body
 */
function startRun(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const command = typeof body.command === "string" ? body.command.trim() : "";

  if (!name && !command) {
    throw new Error("Provide script name or command");
  }

  const runId = randomUUID();
  /** @type {RunState} */
  const run = {
    child: null,
    stdout: "",
    stderr: "",
    exitCode: null,
    done: false,
    clients: new Set(),
  };

  const child =
    command.length > 0
      ? spawn(command, {
          cwd: root,
          shell: true,
          env: { ...process.env },
          windowsHide: true,
        })
      : spawn("npm", ["run", name], {
          cwd: root,
          shell: true,
          env: { ...process.env },
          windowsHide: true,
        });

  run.child = child;
  runs.set(runId, run);

  child.stdout?.on("data", (chunk) => {
    appendOutput(run, "stdout", String(chunk));
  });
  child.stderr?.on("data", (chunk) => {
    appendOutput(run, "stderr", String(chunk));
  });
  child.on("error", (err) => {
    if (!run.done) {
      appendOutput(run, "stderr", `${err.message}\n`);
      run.done = true;
      run.exitCode = 1;
      broadcast(run, "exit", { code: 1, signal: null });
    }
  });
  child.on("close", (code, signal) => {
    run.done = true;
    run.exitCode = code;
    broadcast(run, "exit", { code, signal });
  });

  return { runId };
}

/**
 * @param {string} runId
 */
function stopRun(runId) {
  const run = runs.get(runId);
  if (!run) {
    throw new Error("Run not found");
  }
  if (!run.done && run.child) {
    run.child.kill();
  }
  return { ok: true };
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {() => Promise<void>} handler
 */
async function handleJson(req, res, handler) {
  try {
    const raw = await readBody(req);
    const body = parseJsonBody(raw);
    const result = await handler(body);
    sendJson(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: message });
  }
}

/**
 * @param {string} pathname
 */
function runStreamMatch(pathname) {
  const match = /^\/api\/dev\/npm-scripts\/runs\/([^/]+)\/stream$/.exec(pathname);
  return match ? match[1] : null;
}

/**
 * @param {string} pathname
 */
function runStopMatch(pathname) {
  const match = /^\/api\/dev\/npm-scripts\/runs\/([^/]+)\/stop$/.exec(pathname);
  return match ? match[1] : null;
}

/**
 * @returns {import('vite').Plugin}
 */
export function npmScriptsPlugin() {
  return {
    name: "field-npm-scripts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "/";
        const parsed = new URL(rawUrl, "http://vite.local");
        const { pathname } = parsed;

        if (!pathname.startsWith("/api/dev/npm-scripts")) {
          next();
          return;
        }

        const streamRunId = runStreamMatch(pathname);
        if (req.method === "GET" && streamRunId) {
          const run = runs.get(streamRunId);
          if (!run) {
            sendJson(res, 404, { error: "Run not found" });
            return;
          }

          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          });
          res.write(": connected\n\n");

          if (run.stdout) {
            res.write(
              `event: output\ndata: ${JSON.stringify({ stream: "stdout", text: run.stdout })}\n\n`,
            );
          }
          if (run.stderr) {
            res.write(
              `event: output\ndata: ${JSON.stringify({ stream: "stderr", text: run.stderr })}\n\n`,
            );
          }
          if (run.done) {
            res.write(
              `event: exit\ndata: ${JSON.stringify({ code: run.exitCode, signal: null })}\n\n`,
            );
          }

          run.clients.add(res);
          req.on("close", () => {
            run.clients.delete(res);
          });
          return;
        }

        const stopRunId = runStopMatch(pathname);
        if (req.method === "POST" && stopRunId) {
          void handleJson(req, res, async () => stopRun(stopRunId));
          return;
        }

        if (req.method === "GET" && pathname === "/api/dev/npm-scripts") {
          void listScripts()
            .then((payload) => sendJson(res, 200, payload))
            .catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              sendJson(res, 500, { error: message });
            });
          return;
        }

        if (req.method === "PUT" && pathname === "/api/dev/npm-scripts") {
          void handleJson(req, res, async (body) => {
            if (body.scripts && typeof body.scripts === "object") {
              const scripts = Object.fromEntries(
                Object.entries(body.scripts).map(([key, value]) => [
                  String(key),
                  String(value),
                ]),
              );
              return saveScripts(scripts);
            }

            const name = typeof body.name === "string" ? body.name.trim() : "";
            const command =
              typeof body.command === "string" ? body.command.trim() : "";
            const description =
              typeof body.description === "string" ? body.description.trim() : null;
            if (!name) throw new Error("Script name is required");
            if (!command) throw new Error("Script command is required");

            const current = await listScripts();
            const scripts = { ...current.scripts, [name]: command };
            await saveScripts(scripts);
            if (description != null) {
              if (description) {
                return saveDescription(name, description);
              }
              return deleteDescription(name);
            }
            return listScripts();
          });
          return;
        }

        if (req.method === "DELETE" && pathname === "/api/dev/npm-scripts") {
          void handleJson(req, res, async (body) => {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            if (!name) throw new Error("Script name is required");
            const current = await listScripts();
            const scripts = { ...current.scripts };
            delete scripts[name];
            const saved = await saveScripts(scripts);
            return deleteDescription(name);
          });
          return;
        }

        if (req.method === "POST" && pathname === "/api/dev/npm-scripts/run") {
          void handleJson(req, res, async (body) => startRun(body));
          return;
        }

        sendJson(res, 404, { error: "Not found" });
      });
    },
  };
}
