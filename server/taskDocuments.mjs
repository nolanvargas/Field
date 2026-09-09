import { getPool } from "./db.mjs";
import { isS3Enabled, putLocalObject, sanitizeFileName } from "./storage.mjs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "us-west-1";
const BUCKET = process.env.S3_BUCKET?.trim() || "";

/** @type {S3Client | null} */
let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({ region: REGION });
  }
  return s3Client;
}

/**
 * @param {string} storageKey
 * @param {Buffer} body
 * @param {string} [mimeType]
 */
async function putStoredObject(storageKey, body, mimeType = "application/pdf") {
  if (isS3Enabled()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        Body: body,
        ContentType: mimeType,
      }),
    );
    return;
  }

  await putLocalObject(storageKey, body, mimeType);
}

/**
 * @param {{ taskId: number, kind: string, storageKey: string, fileName: string, buffer: Buffer, generatedByUserId?: string | null }} opts
 */
export async function storeTaskDocumentPdf(opts) {
  const {
    taskId,
    kind,
    storageKey,
    fileName,
    buffer,
    generatedByUserId = null,
  } = opts;

  await putStoredObject(storageKey, buffer);

  const generatedBy =
    typeof generatedByUserId === "string" && generatedByUserId.trim()
      ? generatedByUserId.trim()
      : null;

  const pool = getPool();
  await pool.query(
    `INSERT INTO task_documents (
       task_id, kind, storage_key, file_name, generated_at, generated_by_user_id
     ) VALUES ($1, $2, $3, $4, now(), $5::uuid)
     ON CONFLICT (task_id, kind) DO UPDATE SET
       storage_key = EXCLUDED.storage_key,
       file_name = EXCLUDED.file_name,
       generated_at = EXCLUDED.generated_at,
       generated_by_user_id = EXCLUDED.generated_by_user_id`,
    [taskId, kind, storageKey, sanitizeFileName(fileName), generatedBy],
  );

  return { buffer, fileName: sanitizeFileName(fileName), storageKey };
}
