/**
 * Send a test outbound email via the Field email pipeline (SES by default).
 *
 * Usage:
 *   npm run email:test
 *   npm run email:test -- --task-id 123
 *   npm run email:test -- --to someone@example.com
 *   npm run email:test -- --kind task-completed
 *   npm run email:test -- --kind task-failed --task-id 123
 *
 * Defaults: To test@example.com (override with EMAIL_TEST_TO); latest non-deleted task if --task-id omitted;
 * kind order-delivered.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "../server/loadEnv.mjs";
import {
  companyName,
  companySupportEmail,
  emailFromAddress,
  getLogoDataUri,
} from "../server/branding.mjs";
import { getPool } from "../server/db.mjs";
import { dispatchOutboundEmail } from "../server/emailDeliveries.mjs";
import { getEmailFrom } from "../server/email.mjs";
import { getOrgSettings } from "../server/orgSettings.mjs";
import { trackingUrl } from "../server/trackingToken.mjs";
import { accentEmailReplacements } from "../shared/orgAccent.js";

const DEFAULT_TO = process.env.EMAIL_TEST_TO || "test@example.com";
const KINDS = new Set(["order-delivered", "task-completed", "task-failed"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const EMAILS_DIR = path.join(ROOT, "emails");

/** @type {Record<string, string>} */
const COMPLETED_HEADLINES = {
  Install: "Your install is complete!",
  Removal: "Your removal is complete!",
  "Site Survey": "Your site survey is complete!",
};

/** @type {Record<string, string>} */
const FAILED_HEADLINES = {
  Delivery: "Your delivery could not be completed",
  Install: "Your install could not be completed",
  Removal: "Your removal could not be completed",
  "Site Survey": "Your site survey could not be completed",
};

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ taskId: number | null; to: string; kind: string }} */
  const out = { taskId: null, to: DEFAULT_TO, kind: "order-delivered" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--task-id") {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`Invalid --task-id: ${raw}`);
      }
      out.taskId = n;
    } else if (a === "--to") {
      const raw = argv[++i];
      if (!raw?.trim()) throw new Error("Missing value for --to");
      out.to = raw.trim();
    } else if (a === "--kind") {
      const raw = argv[++i];
      if (!raw?.trim() || !KINDS.has(raw.trim())) {
        throw new Error(
          `Invalid --kind: ${raw} (expected ${[...KINDS].join("|")})`,
        );
      }
      out.kind = raw.trim();
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: npm run email:test -- [--task-id <id>] [--to <email>] [--kind <kind>]
  --task-id  Task to attach the email_deliveries row (default: latest)
  --to       Recipient (default: ${DEFAULT_TO})
  --kind     order-delivered | task-completed | task-failed (default: order-delivered)`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return out;
}

/**
 * @param {number | null} explicit
 */
async function loadTaskContext(explicit) {
  const pool = getPool();
  if (explicit != null) {
    const { rows } = await pool.query(
      `SELECT t.id,
              t.task_type,
              t.job_title,
              t.completed_at,
              t.failed_reason,
              t.tracking_token,
              COALESCE(t.destination_address_name, t.destination_address, '') AS destination_name
       FROM tasks t
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [explicit],
    );
    if (!rows[0]) {
      throw new Error(`Task ${explicit} not found (or deleted)`);
    }
    return rows[0];
  }
  const { rows } = await pool.query(
    `SELECT t.id,
            t.task_type,
            t.job_title,
            t.completed_at,
            t.failed_reason,
            t.tracking_token,
            COALESCE(t.destination_address_name, t.destination_address, '') AS destination_name
     FROM tasks t
     WHERE t.deleted_at IS NULL
     ORDER BY t.id DESC
     LIMIT 1`,
  );
  if (!rows[0]) {
    throw new Error("No tasks in database — create a task or pass --task-id");
  }
  return rows[0];
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TRACKING_BLOCK = /<!--TRACKING_START-->[\s\S]*?<!--TRACKING_END-->/g;

/**
 * @param {{
 *   id: number;
 *   task_type: string;
 *   job_title: string | null;
 *   completed_at: Date | string | null;
 *   failed_reason: string | null;
 *   tracking_token: string | null;
 *   destination_name: string | null;
 * }} task
 * @param {string} kind
 */
async function buildEmail(task, kind) {
  const taskType = String(task.task_type);
  const completedAt = task.completed_at
    ? new Date(task.completed_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
  const jobTitle = task.job_title?.trim() || `Task ${task.id}`;
  const destinationName =
    task.destination_name?.trim() || "your destination";
  const failedReason = task.failed_reason?.trim() || "No reason provided";
  const rawTrackingUrl = trackingUrl(task.tracking_token ?? "");
  const trackingUrl = /^https?:\/\//i.test(rawTrackingUrl)
    ? rawTrackingUrl
    : "";
  if (!trackingUrl) {
    console.warn("No tracking link in this email — set PUBLIC_APP_URL.");
  }

  let templateFile;
  let subject;
  let headline;
  let trigger;

  if (kind === "order-delivered") {
    templateFile = "order-delivered.html";
    subject = "Your order has been delivered!";
    headline = subject;
    trigger = "manual_test";
  } else if (kind === "task-completed") {
    templateFile = "task-completed.html";
    headline =
      COMPLETED_HEADLINES[taskType] || "Your task has been completed!";
    subject = headline;
    trigger = "manual_test";
  } else {
    templateFile = "task-failed.html";
    headline =
      FAILED_HEADLINES[taskType] || "Your task could not be completed";
    subject = headline;
    trigger = "manual_test";
  }

  let html = await readFile(path.join(EMAILS_DIR, templateFile), "utf8");
  if (!trackingUrl) html = html.replace(TRACKING_BLOCK, "");
  const logoDataUri = await getLogoDataUri();
  const org = await getOrgSettings();

  const replacements = {
    ...accentEmailReplacements(org.accentColor),
    "{{contact_name}}": escapeHtml("there"),
    "{{job_title}}": escapeHtml(jobTitle),
    "{{destination_name}}": escapeHtml(destinationName),
    "{{completed_at}}": escapeHtml(completedAt),
    "{{headline}}": escapeHtml(headline),
    "{{task_type}}": escapeHtml(taskType),
    "{{failed_reason}}": escapeHtml(failedReason),
    "{{tracking_url}}": escapeHtml(trackingUrl),
    "{{company_name}}": escapeHtml(companyName()),
    "{{support_email}}": escapeHtml(companySupportEmail()),
    "{{from_email}}": escapeHtml(emailFromAddress()),
    'src="logo.svg"': `src="${logoDataUri}"`,
  };
  for (const [from, to] of Object.entries(replacements)) {
    html = html.split(from).join(to);
  }

  /** @type {string[]} */
  const textLines = [headline, "", `Task: ${jobTitle}`];
  if (kind !== "order-delivered") {
    textLines.push(`Type: ${taskType}`);
  }
  textLines.push(
    kind === "order-delivered"
      ? `Delivered to: ${destinationName}`
      : `Location: ${destinationName}`,
  );
  if (kind === "task-failed") {
    textLines.push(`Reason: ${failedReason}`);
  }
  if (trackingUrl) {
    textLines.push("", `Track this task: ${trackingUrl}`);
  }
  textLines.push("", `Thanks for choosing ${companyName()}.`);

  return { subject, html, text: textLines.join("\n"), trigger };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const task = await loadTaskContext(args.taskId);
  const taskId = Number(task.id);
  const provider = (process.env.EMAIL_PROVIDER || "console").trim().toLowerCase();
  const from = getEmailFrom();
  const { subject, html, text, trigger } = await buildEmail(task, args.kind);

  console.log(
    `Sending ${args.kind} email (provider=${provider}, from=${from}, to=${args.to}, taskId=${taskId})…`,
  );

  const result = await dispatchOutboundEmail({
    taskId,
    trigger,
    to: args.to,
    subject,
    text,
    html,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "sent") {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
