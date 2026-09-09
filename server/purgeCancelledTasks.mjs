import { getPool } from "./db.mjs";



const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour



/** Columns copied from tasks into archived_tasks (must match both tables). */

const TASK_ARCHIVE_COLUMNS = [

  "id",

  "task_type",

  "task_type_id",

  "status",

  "description",

  "job_title",

  "external_key",

  "created_by_user_id",

  "destination_address_id",

  "destination_address_name",

  "destination_address",

  "destination_building",

  "destination_notes",

  "custom_fields",

  "custom_field_defs_snapshot",

  "window_start_at",

  "window_end_at",

  "completed_notes",

  "completed_at",

  "failed_reason",

  "cancelled_at",

  "archive_at",

  "status_before_cancel",

  "deleted_at",

  "tracking_token",

  "created_at",

  "updated_at",

  "completion_notes_by_user_id",

];



/**

 * @param {import('pg').PoolClient} client

 * @param {number} taskId

 */

async function buildTaskSnapshot(client, taskId) {

  const [

    crewRes,

    contactsRes,

    notesRes,

    historyRes,

    attachmentsRes,

    documentsRes,

    emailsRes,

    crewEventsRes,

  ] = await Promise.all([

    client.query(

      `SELECT user_id, is_lead

       FROM task_crew_members

       WHERE task_id = $1`,

      [taskId],

    ),

    client.query(

      `SELECT contact_id, is_poc, receives_email

       FROM task_contacts

       WHERE task_id = $1`,

      [taskId],

    ),

    client.query(

      `SELECT user_id, outcome, notes, created_at, updated_at

       FROM task_completion_notes

       WHERE task_id = $1`,

      [taskId],

    ),

    client.query(

      `SELECT event_type, actor_user_id, from_status, to_status, summary, recorded_at

       FROM task_history_events

       WHERE task_id = $1

       ORDER BY recorded_at ASC, id ASC`,

      [taskId],

    ),

    client.query(

      `SELECT id, kind, storage_key, file_name, mime_type, created_at

       FROM task_attachments

       WHERE task_id = $1`,

      [taskId],

    ),

    client.query(

      `SELECT id, kind, storage_key, file_name, generated_at

       FROM task_documents

       WHERE task_id = $1`,

      [taskId],

    ),

    client.query(

      `SELECT id, "trigger", to_addresses, subject, status, sent_at, created_at

       FROM email_deliveries

       WHERE task_id = $1`,

      [taskId],

    ),

    client.query(

      `SELECT user_id, event_type, latitude, longitude, recorded_at

       FROM task_crew_events

       WHERE task_id = $1`,

      [taskId],

    ),

  ]);



  return {

    crewMembers: crewRes.rows,

    contacts: contactsRes.rows,

    completionNotes: notesRes.rows,

    history: historyRes.rows,

    attachments: attachmentsRes.rows,

    documents: documentsRes.rows,

    emails: emailsRes.rows,

    crewEvents: crewEventsRes.rows,

  };

}



/**

 * Move one cancelled task into archived_tasks and delete it from tasks.

 * @param {import('pg').PoolClient} client

 * @param {number} taskId

 * @param {string} [archiveReason]

 */

export async function archiveCancelledTask(

  client,

  taskId,

  archiveReason = "cancel_retention",

) {

  const snapshot = await buildTaskSnapshot(client, taskId);

  const taskCols = TASK_ARCHIVE_COLUMNS.join(", ");

  const selectCols = TASK_ARCHIVE_COLUMNS.map((c) => `t.${c}`).join(", ");



  await client.query(

    `INSERT INTO archived_tasks (${taskCols}, archived_at, archive_reason, related_snapshot)

     SELECT ${selectCols}, now(), $2, $3::jsonb

     FROM tasks t

     WHERE t.id = $1`,

    [taskId, archiveReason, JSON.stringify(snapshot)],

  );



  await client.query(`DELETE FROM task_attachments WHERE task_id = $1`, [

    taskId,

  ]);

  await client.query(`DELETE FROM task_documents WHERE task_id = $1`, [taskId]);

  await client.query(`DELETE FROM email_deliveries WHERE task_id = $1`, [

    taskId,

  ]);

  await client.query(`DELETE FROM task_status_events WHERE task_id = $1`, [

    taskId,

  ]);

  await client.query(`DELETE FROM task_history_events WHERE task_id = $1`, [

    taskId,

  ]);

  await client.query(`DELETE FROM task_crew_events WHERE task_id = $1`, [

    taskId,

  ]);



  const { rowCount } = await client.query(`DELETE FROM tasks WHERE id = $1`, [

    taskId,

  ]);

  if (rowCount === 0) {

    throw new Error(`Task ${taskId} not found for archive`);

  }

}



/**

 * Archive cancelled tasks whose archive_at deadline has passed.

 * @returns {Promise<number>} number of tasks archived

 */

export async function purgeExpiredCancelledTasks() {

  const pool = getPool();

  const { rows } = await pool.query(

    `SELECT id

     FROM tasks

     WHERE status = 'Cancelled'

       AND deleted_at IS NULL

       AND archive_at IS NOT NULL

       AND archive_at <= now()

     ORDER BY id ASC`,

  );



  if (rows.length === 0) {

    return 0;

  }



  let archived = 0;

  for (const row of rows) {

    const taskId = Number(row.id);

    const client = await pool.connect();

    try {

      await client.query("BEGIN");

      await archiveCancelledTask(client, taskId);

      await client.query("COMMIT");

      archived += 1;

    } catch (err) {

      try {

        await client.query("ROLLBACK");

      } catch {

        // ignore rollback errors

      }

      console.error(`Failed to archive cancelled task ${taskId}:`, err);

    } finally {

      client.release();

    }

  }



  return archived;

}



/**

 * Run purge once, then every hour. Safe to call after the API starts listening.

 */

export function startCancelledTaskPurgeScheduler() {

  const run = () => {

    purgeExpiredCancelledTasks()

      .then((n) => {

        if (n > 0) {

          console.log(`Archived ${n} cancelled task(s) past the retention window`);

        }

      })

      .catch((err) => {

        console.error("Cancelled task purge failed:", err);

      });

  };



  run();

  return setInterval(run, PURGE_INTERVAL_MS);

}


