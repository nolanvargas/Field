/**
 * Seed org print templates for integration tests (CI schema has no Sandbocks seeds).
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computePrintTemplateContentHash } from "../../../server/orgPrintTemplates.mjs";
import { validatePrintTemplate } from "../../../server/renderDocumentTemplate.mjs";

const ORG_ID = 1;
export const INTEGRATION_PRINT_DOCUMENT_TYPE = "delivery_docket";

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

/**
 * @param {import('pg').Client} client
 */
export async function seedDeliveryDocketPrintTemplate(client) {
  const raw = await readFile(
    resolve(root, "document-templates/delivery_docket.json"),
    "utf8",
  );
  const template = validatePrintTemplate(
    JSON.parse(raw),
    INTEGRATION_PRINT_DOCUMENT_TYPE,
  );
  const contentHash = computePrintTemplateContentHash(template);
  const surfaces = template.surfaces ?? {};
  const name = template.label?.trim() || "Delivery Docket";

  await client.query(
    `INSERT INTO org_print_templates (
       org_id, name, document_type, context, template, content_hash,
       surfaces, persist, requires_status, sort_order, updated_at
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10, now())
     ON CONFLICT (org_id, document_type) DO UPDATE SET
       name = EXCLUDED.name,
       context = EXCLUDED.context,
       template = EXCLUDED.template,
       content_hash = EXCLUDED.content_hash,
       surfaces = EXCLUDED.surfaces,
       persist = EXCLUDED.persist,
       requires_status = EXCLUDED.requires_status,
       sort_order = EXCLUDED.sort_order,
       updated_at = now()`,
    [
      ORG_ID,
      name,
      INTEGRATION_PRINT_DOCUMENT_TYPE,
      template.context,
      JSON.stringify(template),
      contentHash,
      JSON.stringify(surfaces),
      template.persist === true,
      template.requiresStatus,
      0,
    ],
  );
}

/**
 * @param {import('pg').Client} client
 */
export async function cleanupIntegrationPrintTemplate(client) {
  // Re-upsert Sandbocks seed so local dev / pilot UAT keep working after the suite.
  await seedDeliveryDocketPrintTemplate(client);
}
