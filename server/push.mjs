/**
 * Outbound push — FCM or console (offline).
 * Env: PUSH_PROVIDER, FCM_SERVICE_ACCOUNT_PATH
 */

import { readFile } from "node:fs/promises";
import admin from "firebase-admin";

/** @type {admin.app.App | null} */
let firebaseApp = null;

function getProvider() {
  const raw = (process.env.PUSH_PROVIDER || "console").trim().toLowerCase();
  return raw === "fcm" ? "fcm" : "console";
}

async function getMessaging() {
  if (getProvider() !== "fcm") return null;
  if (firebaseApp) return admin.messaging(firebaseApp);

  const path = process.env.FCM_SERVICE_ACCOUNT_PATH?.trim();
  if (!path) {
    throw new Error(
      "FCM_SERVICE_ACCOUNT_PATH is required when PUSH_PROVIDER=fcm",
    );
  }
  const json = JSON.parse(await readFile(path, "utf8"));
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(json),
  });
  return admin.messaging(firebaseApp);
}

/**
 * @param {{
 *   token: string;
 *   title: string;
 *   body: string;
 *   data: Record<string, string>;
 * }} opts
 * @returns {Promise<{ messageId: string }>}
 */
export async function sendPushToDevice(opts) {
  const token = String(opts.token ?? "").trim();
  if (!token) {
    throw new Error("sendPushToDevice: token is required");
  }
  const title = String(opts.title ?? "").trim();
  const body = String(opts.body ?? "").trim();
  const data = opts.data ?? {};

  const provider = getProvider();
  if (provider === "console") {
    const messageId = `console-push-${Date.now()}`;
    console.log("[push:console]", {
      messageId,
      token: `${token.slice(0, 12)}…`,
      title,
      body,
      data,
    });
    return { messageId };
  }

  const messaging = await getMessaging();
  const messageId = await messaging.send({
    token,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    ),
    android: {
      priority: "high",
      notification: {
        channelId: "field_task",
      },
    },
  });
  return { messageId };
}

/**
 * @param {unknown} err
 */
export function isInvalidFcmTokenError(err) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String(err.code)
      : "";
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}
