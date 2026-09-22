#!/usr/bin/env node
/**
 * Execute pilot UAT Run A steps against a running local API (see docs/pilot-uat-script.md).
 * Usage: node scripts/run-pilot-uat.mjs <externalKey> [baseUrl]
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { testUserBearerToken } from "../server/auth.mjs";

const LOGAN = "a6c2a0c2-6266-4b3a-b786-eeae20667afe";
const ALEX = "e79c25d5-06b4-4468-b7a9-04a9718f5e72";

const externalKey = process.argv[2];
const baseUrl = (process.argv[3] ?? "http://localhost:3000").replace(/\/$/, "");

if (!externalKey) {
  console.error("Usage: node scripts/run-pilot-uat.mjs <externalKey> [baseUrl]");
  process.exit(1);
}

/** @type {Record<number, { ok: boolean; detail: string }>} */
const results = {};

function record(step, ok, detail) {
  results[step] = { ok, detail };
  const mark = ok ? "PASS" : "FAIL";
  console.log(`Step ${step}: ${mark} — ${detail}`);
  if (!ok) {
    throw new Error(`Pilot UAT failed at step ${step}: ${detail}`);
  }
}

/**
 * @param {string} userId
 * @param {string} urlPath
 * @param {RequestInit} [init]
 */
async function authFetch(userId, urlPath, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${testUserBearerToken(userId)}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${baseUrl}${urlPath}`, { ...init, headers });
}

/**
 * @param {string} token
 * @param {string} urlPath
 * @param {RequestInit} [init]
 */
async function deviceFetch(token, urlPath, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${baseUrl}${urlPath}`, { ...init, headers });
}

async function main() {
  console.log(`\nPilot UAT Run A — externalKey=${externalKey} — ${baseUrl}\n`);

  const health = await fetch(`${baseUrl}/api/health`);
  record(1, health.ok, "API health");

  const contactsRes = await authFetch(LOGAN, "/api/contacts");
  const contactsBody = await contactsRes.json();
  const contact = (contactsBody.contacts ?? []).find(
    (c) => c.email && String(c.email).includes("@"),
  );
  record(
    1,
    contactsRes.ok && contact?.id,
    contactsRes.ok ? `contacts loaded (${contact?.name})` : "contacts list failed",
  );

  const addrRes = await authFetch(LOGAN, "/api/addresses");
  const addrBody = await addrRes.json();
  const address = (addrBody.addresses ?? [])[0];
  record(
    2,
    addrRes.ok && address?.id,
    addrRes.ok ? `address ${address?.addressName ?? address?.id}` : "addresses failed",
  );

  const createRes = await authFetch(LOGAN, "/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      taskType: "Delivery",
      taskDesc: "Pilot UAT scripted run",
      externalKey,
      createdByUserId: LOGAN,
      crewMemberIds: [ALEX],
      leadCrewMemberId: ALEX,
      contactIds: [contact.id],
      receiveEmailContactIds: [contact.id],
      destinationAddressId: address.id,
    }),
  });
  const createBody = await createRes.json();
  const taskId = createBody.task?.id;
  const createOk =
    createRes.status === 201 && createBody.task?.status === "Assigned";
  record(
    2,
    createOk,
    createOk
      ? `task #${taskId} status=${createBody.task?.status}`
      : `create ${createRes.status}: ${createBody.error ?? JSON.stringify(createBody)}`,
  );

  const docketRes = await authFetch(LOGAN, "/api/print/delivery_docket", {
    method: "POST",
    body: JSON.stringify({ context: "task", taskId }),
  });
  const docketBuf = Buffer.from(await docketRes.arrayBuffer());
  record(
    3,
    docketRes.ok && docketBuf.subarray(0, 5).toString("utf8") === "%PDF-",
    `delivery docket ${docketRes.status} (${docketBuf.length} bytes)`,
  );

  const qrRes = await authFetch(LOGAN, `/api/users/${ALEX}/mobile-activations`, {
    method: "POST",
    body: JSON.stringify({ createdByUserId: LOGAN }),
  });
  const qrBody = await qrRes.json();
  record(
    4,
    qrRes.status === 201 && qrBody.code,
    qrRes.ok ? "activation code issued" : `QR issue ${qrRes.status}`,
  );

  const actRes = await fetch(`${baseUrl}/api/mobile/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: qrBody.code }),
  });
  const actBody = await actRes.json();
  const deviceToken = actBody.deviceSessionToken;
  record(
    5,
    actRes.ok && deviceToken,
    actRes.ok ? "device session active" : `activate ${actRes.status}`,
  );

  const listRes = await deviceFetch(deviceToken, `/api/tasks?crewMemberId=${ALEX}`);
  const listBody = await listRes.json();
  const listed = (listBody.tasks ?? []).some((t) => t.id === taskId);
  record(5, listed, listed ? "task on crew list" : "task missing from crew list");

  const startRes = await deviceFetch(deviceToken, `/api/tasks/${taskId}/crew-events`, {
    method: "POST",
    body: JSON.stringify({
      eventType: "started",
      latitude: 36.1,
      longitude: -115.17,
    }),
  });
  const startBody = await startRes.json();
  record(
    6,
    startRes.status === 201 && startBody.task?.status === "In Progress",
    `status=${startBody.task?.status}`,
  );

  const sampleJpeg = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures/curated/files/00f9bca8a10f14a88b44fddc7a5a9cf6.jpg",
  );
  const sampleStat = await stat(sampleJpeg);
  const presignRes = await deviceFetch(
    deviceToken,
    `/api/tasks/${taskId}/attachments/presign`,
    {
      method: "POST",
      body: JSON.stringify({
        fileName: "uat-pilot-photo.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: sampleStat.size,
      }),
    },
  );
  const presign = await presignRes.json();
  const storageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "storage",
  );
  const storagePath = path.join(storageRoot, presign.storageKey);
  await mkdir(path.dirname(storagePath), { recursive: true });
  await copyFile(sampleJpeg, storagePath);

  const confirmRes = await deviceFetch(deviceToken, `/api/tasks/${taskId}/attachments`, {
    method: "POST",
      body: JSON.stringify({
        storageKey: presign.storageKey,
        fileName: "uat-pilot-photo.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: sampleStat.size,
      }),
  });
  const confirmBody = await confirmRes.json();
  record(
    7,
    confirmRes.status === 201 &&
      confirmBody.attachment?.uploadedByUserId === ALEX,
    `attachment uploader=${confirmBody.attachment?.uploadedByUserId}`,
  );

  const endRes = await deviceFetch(deviceToken, `/api/tasks/${taskId}/crew-events`, {
    method: "POST",
    body: JSON.stringify({
      eventType: "ended",
      outcome: "Completed",
      notes: "Pilot UAT complete",
      latitude: 36.1,
      longitude: -115.17,
    }),
  });
  const endBody = await endRes.json();
  record(
    8,
    endRes.status === 201 && endBody.task?.status === "Completed",
    `status=${endBody.task?.status}`,
  );

  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://field:field@localhost:5433/field",
  });
  const deliveries = await pool.query(
    `SELECT status::text AS status, trigger
     FROM email_deliveries WHERE task_id = $1`,
    [taskId],
  );
  await pool.end();
  const delivery = deliveries.rows[0];
  record(
    9,
    deliveries.rows.length > 0 &&
      delivery?.trigger === "task_completed" &&
      ["sent", "failed", "pending"].includes(delivery?.status),
    `email_deliveries ${delivery?.status} (${delivery?.trigger})`,
  );

  const podRes = await authFetch(LOGAN, "/api/print/proof_of_completion", {
    method: "POST",
    body: JSON.stringify({ context: "task", taskId }),
  });
  const podBuf = Buffer.from(await podRes.arrayBuffer());
  record(
    10,
    podRes.ok && podBuf.subarray(0, 5).toString("utf8") === "%PDF-",
    `proof PDF ${podRes.status} (${podBuf.length} bytes)`,
  );

  const taskRes = await authFetch(LOGAN, `/api/tasks/${taskId}`);
  const taskBody = await taskRes.json();
  const token = taskBody.task?.trackingToken;
  const trackRes = await fetch(`${baseUrl}/api/tracking/tasks/${encodeURIComponent(token)}`);
  const trackBody = await trackRes.json();
  record(
    11,
    trackRes.ok && trackBody.status === "Completed",
    trackRes.ok
      ? `tracking status=${trackBody.status}`
      : `tracking ${trackRes.status}`,
  );

  console.log(`\nAll 11 steps passed for ${externalKey}.\n`);
  return { externalKey, taskId, results };
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
