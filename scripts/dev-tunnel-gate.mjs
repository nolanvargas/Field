/**
 * Password gate in front of a local web server.
 *
 * Listens on 127.0.0.1 only. Point a tunnel at this port.
 * DEV_WEB_PORT defaults to Vite (5173). The public tunnel should use the
 * production preview port so Development routes are not in the bundle.
 * The password comes from DEV_TUNNEL_PASSWORD and is never written here.
 *
 *   DEV_TUNNEL_PASSWORD=... node scripts/dev-tunnel-gate.mjs
 */
import http from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const listenPort = Number(process.env.DEV_GATE_PORT || 5199);
const upstreamPort = Number(process.env.DEV_WEB_PORT || 5173);
const password = process.env.DEV_TUNNEL_PASSWORD ?? "";
const cookieName = "field_dev_gate";
const loginPath = "/__dev_gate/login";

function isDevToolPath(pathname) {
  return (
    pathname === "/development" ||
    pathname.startsWith("/development/") ||
    pathname === "/api/dev" ||
    pathname.startsWith("/api/dev/")
  );
}

function denyDevTools(res) {
  res.writeHead(404, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end("Not found.");
}

if (!password) {
  console.error("Set DEV_TUNNEL_PASSWORD before starting the dev tunnel gate.");
  process.exit(1);
}

/** @type {Set<string>} */
const sessions = new Set();

function passwordMatches(input) {
  const a = createHash("sha256").update(password, "utf8").digest();
  const b = createHash("sha256").update(String(input), "utf8").digest();
  return timingSafeEqual(a, b);
}

function readCookies(header) {
  /** @type {Record<string, string>} */
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

function isAuthed(req) {
  const token = readCookies(req.headers.cookie)[cookieName];
  return Boolean(token && sessions.has(token));
}

function requestIsHttps(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  if (proto === "https") return true;
  return String(req.headers["cf-visitor"] || "").includes('"scheme":"https"');
}

function loginHtml(message) {
  const note = message
    ? `<p>${message}</p>`
    : "<p>This development environment requires a password.</p>";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Field development</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; }
    form { display: grid; gap: 0.75rem; max-width: 18rem; }
    label { display: grid; gap: 0.35rem; }
  </style>
</head>
<body>
  <h1>Field development</h1>
  ${note}
  <form method="post" action="${loginPath}">
    <label>Password <input type="password" name="password" autocomplete="current-password" autofocus required></label>
    <button type="submit">Continue</button>
  </form>
</body>
</html>`;
}

function sendHtml(res, status, html, extraHeaders = {}) {
  const body = Buffer.from(html);
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

function readBody(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sessionCookie(token, req) {
  const parts = [
    `${cookieName}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=43200",
  ];
  if (requestIsHttps(req)) parts.push("Secure");
  return parts.join("; ");
}

function proxyHttp(req, res) {
  const headers = { ...req.headers, host: `localhost:${upstreamPort}` };
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: upstreamPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end("Development server is not reachable.");
  });
  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head) {
  const upgradeUrl = new URL(req.url || "/", "http://127.0.0.1");
  if (isDevToolPath(upgradeUrl.pathname)) {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  if (!isAuthed(req)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  const headers = { ...req.headers, host: `localhost:${upstreamPort}` };
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: upstreamPort,
    path: req.url,
    method: "GET",
    headers,
  });
  upstream.on("upgrade", (upstreamRes, upstreamSocket, upstreamHead) => {
    const lines = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`];
    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      if (value == null) continue;
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) lines.push(`${key}: ${item}`);
    }
    socket.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (upstreamHead?.length) socket.write(upstreamHead);
    if (head?.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
    upstreamSocket.on("error", () => socket.destroy());
    socket.on("error", () => upstreamSocket.destroy());
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");

  if (isDevToolPath(url.pathname)) {
    denyDevTools(res);
    return;
  }

  if (req.method === "GET" && url.pathname === loginPath) {
    sendHtml(res, 200, loginHtml(""));
    return;
  }

  if (req.method === "POST" && url.pathname === loginPath) {
    let body = "";
    try {
      body = await readBody(req);
    } catch {
      sendHtml(res, 400, loginHtml("That password was not accepted."));
      return;
    }
    const submitted = new URLSearchParams(body).get("password") ?? "";
    if (!passwordMatches(submitted)) {
      sendHtml(res, 401, loginHtml("That password was not accepted."));
      return;
    }
    const token = randomBytes(32).toString("hex");
    sessions.add(token);
    res.writeHead(303, {
      location: "/",
      "set-cookie": sessionCookie(token, req),
      "cache-control": "no-store",
    });
    res.end();
    return;
  }

  if (!isAuthed(req)) {
    if (req.method === "GET" && (req.headers.accept || "").includes("text/html")) {
      res.writeHead(303, { location: loginPath, "cache-control": "no-store" });
      res.end();
      return;
    }
    res.writeHead(401, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end("Password required.");
    return;
  }

  proxyHttp(req, res);
});

server.on("upgrade", proxyUpgrade);

server.listen(listenPort, "127.0.0.1", () => {
  console.log(
    `Dev tunnel gate on http://127.0.0.1:${listenPort} -> Vite :${upstreamPort}`,
  );
});
