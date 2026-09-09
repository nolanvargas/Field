/**
 * Dev-only Vite middleware: GET /api/dev/tests
 * Collects the Vitest catalog (does not run tests).
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = resolve(root, "node_modules/vitest/vitest.mjs");

/** @typedef {{ id: string, file: string, edgeCase: string, line: number | null, asserts: string }} CatalogTest */

/** @type {{ tests: CatalogTest[], links?: { workspaceRoot: string, urlScheme: string } } | null} */
let cache = null;
/** @type {Promise<{ tests: CatalogTest[], links?: { workspaceRoot: string, urlScheme: string } }> | null} */
let inflight = null;

const LOCAL_LINKS_FILE = join(root, "dev-tests.links.local.json");

/**
 * @param {string} filePath
 */
function toPosixRelative(filePath) {
  return relative(root, filePath).split(sep).join("/");
}

/**
 * @param {unknown} raw
 * @returns {CatalogTest[]}
 */
function mapTests(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("Vitest list did not return an array");
  }
  return raw.map((entry, index) => {
    const fullName = String(entry?.name ?? "");
    const fileAbs = String(entry?.file ?? "");
    const file = fileAbs ? toPosixRelative(fileAbs) : "";
    const lineRaw = entry?.location?.line;
    const line = typeof lineRaw === "number" ? lineRaw : null;
    return {
      id: `${file}:${line ?? index}:${fullName}`,
      file,
      edgeCase: fullName,
      line,
      asserts: "",
    };
  });
}

/**
 * @param {import('typescript').Expression} expr
 */
function testCallRootName(expr) {
  let current = expr;
  for (let i = 0; i < 8; i++) {
    if (ts.isIdentifier(current)) return current.text;
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isCallExpression(current) || ts.isElementAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    return null;
  }
  return null;
}

/**
 * @param {import('typescript').CallExpression} call
 */
function getTestCallback(call) {
  for (let i = call.arguments.length - 1; i >= 0; i--) {
    const arg = call.arguments[i];
    if (ts.isFunctionExpression(arg) || ts.isArrowFunction(arg)) return arg;
  }
  return null;
}

/**
 * @param {import('typescript').Node} node
 */
function outermostExpectChain(node) {
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (
      (ts.isPropertyAccessExpression(parent) ||
        ts.isElementAccessExpression(parent)) &&
      parent.expression === current
    ) {
      current = parent;
      continue;
    }
    if (ts.isCallExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }
    if (ts.isAwaitExpression(parent) && parent.expression === current) {
      current = parent;
      continue;
    }
    break;
  }
  return current;
}

const SKIP_ARG_NAMES = new Set([
  "db",
  "defs",
  "FILLED",
  "mocks",
  "params",
  "pool",
  "req",
  "res",
  "signal",
]);

function isFixtureIdent(name) {
  return SKIP_ARG_NAMES.has(name) || /^[A-Z][A-Z0-9_]+$/.test(name);
}

/**
 * @param {string} name
 */
function humanizeIdent(name) {
  const stripped = name
    .replace(/^PERMISSIONS\./, "")
    .replace(/^WEB_AUTH_PROVIDER_/, "")
    .replace(/^mocks\./, "");
  const spaced = stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .trim();
  return spaced.replace(/\s+/g, " ").toLowerCase();
}

/**
 * @param {string} text
 */
function sentence(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * @param {import('typescript').Expression} expr
 * @returns {import('typescript').Expression}
 */
function unwrapThunk(expr) {
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    if (ts.isBlock(expr.body)) {
      const only = expr.body.statements[0];
      if (only && ts.isExpressionStatement(only)) {
        return unwrapThunk(only.expression);
      }
      if (only && ts.isReturnStatement(only) && only.expression) {
        return unwrapThunk(only.expression);
      }
      return expr;
    }
    return unwrapThunk(expr.body);
  }
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr)) {
    return unwrapThunk(expr.expression);
  }
  return expr;
}

/**
 * @param {import('typescript').Expression} expr
 * @param {number} [depth]
 * @returns {string}
 */
function summarizeExpr(expr, depth = 0) {
  const node = unwrapThunk(expr);
  if (depth > 3) return "…";

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text === "") return "an empty string";
    return `“${node.text}”`;
  }
  if (ts.isNumericLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return "true";
  if (node.kind === ts.SyntaxKind.FalseKeyword) return "false";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return "undefined";

  if (ts.isRegularExpressionLiteral(node)) {
    const raw = node.text.replace(/^\/|\/[a-z]*$/gi, "");
    return `“${raw}”`;
  }

  if (ts.isIdentifier(node)) {
    return humanizeIdent(node.text);
  }

  if (ts.isPropertyAccessExpression(node)) {
    const parts = [];
    let current = node;
    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }
    if (ts.isIdentifier(current) && current.text === "PERMISSIONS") {
      return humanizeIdent(parts.join(" "));
    }
    if (ts.isIdentifier(current) && current.text === "mocks") {
      return humanizeIdent(parts.join(" "));
    }
    const obj = ts.isIdentifier(current)
      ? humanizeIdent(current.text)
      : summarizeExpr(current, depth + 1);
    const rest = humanizeIdent(parts.join(" "));
    return [obj, rest].filter(Boolean).join(" ");
  }

  if (ts.isElementAccessExpression(node)) {
    const obj = summarizeExpr(node.expression, depth + 1);
    const key = node.argumentExpression
      ? summarizeExpr(node.argumentExpression, depth + 1)
      : "";
    return key ? `${obj} ${key}` : obj;
  }

  if (ts.isArrayLiteralExpression(node)) {
    if (node.elements.length === 0) return "an empty list";
    const items = node.elements
      .filter(ts.isExpression)
      .map((el) => summarizeExpr(el, depth + 1))
      .filter(Boolean);
    return items.join(", ");
  }

  if (ts.isObjectLiteralExpression(node)) {
    if (node.properties.length === 0) return "an empty object";
    const parts = [];
    let allSimpleKeys = true;
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        allSimpleKeys = false;
        continue;
      }
      const keyName = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)
          ? prop.name.text
          : prop.name.getText();
      const value = summarizeExpr(prop.initializer, depth + 1);
      if (/^\d+$/.test(keyName) && value) {
        parts.push(`${keyName} → ${value.replace(/^“|”$/g, "")}`);
        continue;
      }
      allSimpleKeys = false;
      parts.push(
        value ? `${humanizeIdent(keyName)} ${value}` : humanizeIdent(keyName),
      );
    }
    if (allSimpleKeys && parts.length > 0) return parts.join(", ");
    return parts.join(", ");
  }

  if (ts.isCallExpression(node)) {
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "expect"
    ) {
      const asy = node.expression.name.text;
      if (asy === "anything") return "anything";
      if (asy === "objectContaining" && node.arguments[0]) {
        return summarizeExpr(node.arguments[0], depth + 1);
      }
      if (asy === "arrayContaining" && node.arguments[0]) {
        return `a list containing ${summarizeExpr(node.arguments[0], depth + 1)}`;
      }
    }

    const callee = ts.isIdentifier(node.expression)
      ? humanizeIdent(node.expression.text)
      : ts.isPropertyAccessExpression(node.expression)
        ? summarizeExpr(node.expression, depth + 1)
        : summarizeExpr(node.expression, depth + 1);
    const args = node.arguments
      .filter(ts.isExpression)
      .filter((arg) => !(ts.isIdentifier(arg) && isFixtureIdent(arg.text)))
      .map((arg) => summarizeExpr(arg, depth + 1))
      .filter(Boolean)
      .filter((arg, i, all) => arg !== all[i - 1]);
    if (args.length === 0) return callee;
    if (args.length === 1) return `${callee} of ${args[0]}`;
    return `${callee} (${args.join(", ")})`;
  }

  if (ts.isNewExpression(node)) {
    const name = node.expression.getText();
    if (name === "URLSearchParams" && node.arguments?.length === 0) {
      return "empty URL params";
    }
    const args = (node.arguments ?? [])
      .filter(ts.isExpression)
      .map((arg) => summarizeExpr(arg, depth + 1))
      .filter(Boolean);
    return args.length
      ? `${humanizeIdent(name)} (${args.join(", ")})`
      : humanizeIdent(name);
  }

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    return `not ${summarizeExpr(node.operand, depth + 1)}`;
  }

  if (ts.isTemplateExpression(node)) {
    const bits = [node.head.text];
    for (const span of node.templateSpans) {
      bits.push(summarizeExpr(span.expression, depth + 1));
      bits.push(span.literal.text);
    }
    return `“${bits.join("").replace(/\s+/g, " ").trim()}”`;
  }

  const fallback = compactText(node.getText());
  return fallback.length > 80 ? `${fallback.slice(0, 77)}…` : fallback;
}

/**
 * @param {string} text
 */
function compactText(text) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * @param {import('typescript').Node} chain
 */
function interpretExpect(chain) {
  let current = ts.isAwaitExpression(chain) ? chain.expression : chain;
  let negated = false;
  /** @type {'resolves' | 'rejects' | null} */
  let mode = null;
  /** @type {string | null} */
  let matcher = null;
  /** @type {import('typescript').Expression[]} */
  let matcherArgs = [];

  while (current) {
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === "expect"
    ) {
      const subject = current.arguments[0];
      const label = current.arguments[1];
      if (!subject || !ts.isExpression(subject) || !matcher) {
        return "";
      }
      return formatAssertion(subject, matcher, matcherArgs, {
        negated,
        mode,
        label: label && ts.isExpression(label) ? label : null,
      });
    }

    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression)
    ) {
      matcher = current.expression.name.text;
      matcherArgs = current.arguments.filter(ts.isExpression);
      current = current.expression.expression;
      continue;
    }

    if (ts.isPropertyAccessExpression(current)) {
      const name = current.name.text;
      if (name === "not") negated = true;
      else if (name === "resolves" || name === "rejects") mode = name;
      current = current.expression;
      continue;
    }

    break;
  }
  return "";
}

/**
 * @param {import('typescript').Expression} subject
 * @param {string} matcher
 * @param {import('typescript').Expression[]} matcherArgs
 * @param {{ negated: boolean, mode: 'resolves' | 'rejects' | null, label: import('typescript').Expression | null }} opts
 */
function formatAssertion(subject, matcher, matcherArgs, opts) {
  const sub = summarizeExpr(subject);
  let arg0 = matcherArgs[0] ? summarizeExpr(matcherArgs[0]) : "";
  if (
    (matcher === "toBe" || matcher === "toEqual") &&
    opts.label &&
    matcherArgs[0] &&
    ts.isIdentifier(matcherArgs[0])
  ) {
    arg0 = summarizeExpr(opts.label).replace(/^“|”$/g, "");
  }
  const argList = matcherArgs.map((arg) => summarizeExpr(arg)).filter(Boolean);
  const not = opts.negated;

  /** @type {string} */
  let phrase = "";
  switch (matcher) {
    case "toBe":
    case "toEqual":
      if (arg0 === "true") phrase = not ? `${sub} is not true` : `${sub} is true`;
      else if (arg0 === "false") phrase = not ? `${sub} is not false` : `${sub} is false`;
      else if (arg0 === "an empty string") {
        phrase = not ? `${sub} is not empty` : `${sub} is empty`;
      } else if (arg0 === "an empty list") {
        phrase = not ? `${sub} is not an empty list` : `${sub} is an empty list`;
      } else phrase = not ? `${sub} is not ${arg0}` : `${sub} is ${arg0}`;
      break;
    case "toBeUndefined":
      if (opts.mode === "resolves") {
        phrase = not
          ? `${sub} does not complete successfully`
          : `${sub} completes successfully`;
      } else {
        phrase = not ? `${sub} is not undefined` : `${sub} is undefined`;
      }
      break;
    case "toBeDefined":
      phrase = not ? `${sub} is not defined` : `${sub} is defined`;
      break;
    case "toBeNull":
      phrase = not ? `${sub} is not null` : `${sub} is null`;
      break;
    case "toBeTruthy":
      phrase = not ? `${sub} is not true` : `${sub} is true`;
      break;
    case "toBeFalsy":
      phrase = not ? `${sub} is not false` : `${sub} is false`;
      break;
    case "toContain":
      phrase = not ? `${sub} does not contain ${arg0}` : `${sub} contains ${arg0}`;
      break;
    case "toMatch":
      phrase = not ? `${sub} does not match ${arg0}` : `${sub} matches ${arg0}`;
      break;
    case "toThrow":
    case "toThrowError":
      if (not) phrase = `${sub} does not throw`;
      else phrase = arg0 ? `${sub} throws ${arg0}` : `${sub} throws`;
      break;
    case "toHaveBeenCalled":
      phrase = not ? `${sub} is not called` : `${sub} is called`;
      break;
    case "toHaveBeenCalledTimes": {
      const times =
        arg0 === "1" ? "once" : arg0 === "2" ? "twice" : `${arg0} times`;
      phrase = `${sub} is called ${times}`;
      break;
    }
    case "toHaveBeenCalledWith":
      phrase = argList.length
        ? `${sub} is called with ${argList.join(", ")}`
        : `${sub} is called`;
      break;
    case "toMatchObject":
      if (opts.mode === "rejects") {
        phrase = not
          ? `${sub} does not fail with ${arg0}`
          : `${sub} fails with ${arg0}`;
      } else {
        phrase = not ? `${sub} does not match ${arg0}` : `${sub} matches ${arg0}`;
      }
      break;
    case "toHaveLength":
      phrase = `${sub} has length ${arg0}`;
      break;
    case "toBeGreaterThan":
      phrase = `${sub} is greater than ${arg0}`;
      break;
    case "toBeLessThan":
      phrase = `${sub} is less than ${arg0}`;
      break;
    default:
      phrase = arg0
        ? `${sub} ${humanizeIdent(matcher)} ${arg0}`
        : `${sub} ${humanizeIdent(matcher)}`;
  }

  if (opts.mode === "rejects" && matcher !== "toMatchObject") {
    phrase = `${sub} is rejected (${phrase})`;
  } else if (opts.mode === "resolves" && matcher !== "toBeUndefined") {
    phrase = `${sub} resolves (${phrase})`;
  }

  return sentence(phrase);
}

/**
 * @param {import('typescript').Node} root
 * @returns {string[]}
 */
function assertionsFromNode(root) {
  /** @type {string[]} */
  const found = [];
  /** @type {Set<import('typescript').Node>} */
  const seen = new Set();

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "expect"
    ) {
      const chain = outermostExpectChain(node);
      if (!seen.has(chain)) {
        seen.add(chain);
        const interpreted = interpretExpect(chain);
        if (interpreted) found.push(interpreted);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(root);
  return found;
}

/**
 * @param {string} sourceText
 * @param {string} fileName
 * @returns {(line: number) => string}
 */
function assertionLookupForFile(sourceText, fileName) {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {{ start: number, end: number, asserts: string }[]} */
  const blocks = [];

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const rootName = testCallRootName(node.expression);
      if (rootName === "it" || rootName === "test") {
        const callback = getTestCallback(node);
        if (callback) {
          const start =
            sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
          blocks.push({
            start,
            end,
            asserts: assertionsFromNode(callback).join("; "),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);

  return (line) => {
    const hits = blocks.filter((block) => line >= block.start && line <= block.end);
    hits.sort((a, b) => a.end - a.start - (b.end - b.start));
    return hits[0]?.asserts ?? "";
  };
}

/**
 * @param {CatalogTest[]} tests
 */
async function attachAssertions(tests) {
  /** @type {Map<string, (line: number) => string>} */
  const lookups = new Map();

  for (const test of tests) {
    if (!test.file || test.line == null) continue;
    let lookup = lookups.get(test.file);
    if (!lookup) {
      const source = await readFile(resolve(root, test.file), "utf8");
      lookup = assertionLookupForFile(source, test.file);
      lookups.set(test.file, lookup);
    }
    test.asserts = lookup(test.line);
  }
}

/**
 * @param {string[]} args
 * @param {string} outFile
 */
function runVitestList(args, outFile) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env },
      windowsHide: true,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun(undefined);
        return;
      }
      reject(
        new Error(
          `vitest list exited ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
        ),
      );
    });
  }).then(async () => {
    const text = await readFile(outFile, "utf8");
    return JSON.parse(text);
  });
}

async function readLocalLinksConfig() {
  try {
    const text = await readFile(LOCAL_LINKS_FILE, "utf8");
    const parsed = JSON.parse(text);
    const workspaceRoot =
      typeof parsed.workspaceRoot === "string"
        ? parsed.workspaceRoot.trim()
        : "";
    if (!workspaceRoot) return undefined;
    const urlScheme =
      typeof parsed.urlScheme === "string" && parsed.urlScheme.trim()
        ? parsed.urlScheme.trim()
        : "vscode";
    return {
      workspaceRoot: workspaceRoot.replace(/\\/g, "/"),
      urlScheme,
    };
  } catch {
    return undefined;
  }
}

async function collectTests() {
  const dir = await mkdtemp(join(tmpdir(), "field-vitest-list-"));
  const outFile = join(dir, "tests.json");
  try {
    const raw = await runVitestList(
      [
        vitestBin,
        "list",
        "--json",
        outFile,
        "--includeTaskLocation",
        "--silent=true",
      ],
      outFile,
    );
    const tests = mapTests(raw);
    await attachAssertions(tests);
    const links = await readLocalLinksConfig();
    return links ? { tests, links } : { tests };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function loadCatalog(refresh) {
  if (refresh) {
    cache = null;
  }
  if (cache && !inflight) {
    return Promise.resolve(cache);
  }
  if (!inflight) {
    inflight = collectTests()
      .then((next) => {
        cache = next;
        return next;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * @returns {import('vite').Plugin}
 */
export function testCatalogPlugin() {
  return {
    name: "field-test-catalog",
    apply: "serve",
    configureServer(server) {
      server.watcher.on("all", (_event, file) => {
        if (/\.(test|spec)\.(ts|tsx)$/.test(file.replaceAll("\\", "/"))) {
          cache = null;
        }
      });

      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "/";
        const parsed = new URL(rawUrl, "http://vite.local");
        if (req.method !== "GET" || parsed.pathname !== "/api/dev/tests") {
          next();
          return;
        }

        const refresh = parsed.searchParams.get("refresh") === "1";
        void loadCatalog(refresh)
          .then((payload) => {
            const body = Buffer.from(JSON.stringify(payload), "utf8");
            res.writeHead(200, {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Length": body.length,
              "Cache-Control": "no-store",
            });
            res.end(body);
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            const body = Buffer.from(JSON.stringify({ error: message }), "utf8");
            res.writeHead(500, {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Length": body.length,
              "Cache-Control": "no-store",
            });
            res.end(body);
          });
      });
    },
  };
}
