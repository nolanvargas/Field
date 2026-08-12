import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maybeSendTerminalEmails } from '../server/taskCompletionEmails.mjs';

const mocks = vi.hoisted(() => ({
  getPool: vi.fn(),
  dispatchOutboundEmail: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: mocks.getPool }));
vi.mock('../server/emailDeliveries.mjs', () => ({
  dispatchOutboundEmail: mocks.dispatchOutboundEmail,
}));

type PoolQuery = (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

interface PoolOptions {
  taskType?: string;
  alreadySentTriggers?: Set<string>;
  recipients?: Array<{ id: number; name: string; email: string }>;
}

function makePool(options: PoolOptions = {}): { query: ReturnType<typeof vi.fn> } {
  const taskRow = {
    id: 42,
    task_type: options.taskType ?? 'Delivery',
    job_title: 'ACME order',
    completed_at: '2026-08-12T10:00:00Z',
    failed_reason: null,
    public_token: 'tok123',
    destination_name: 'ACME HQ',
  };
  const recipients = options.recipients ?? [
    { id: 7, name: 'Jane', email: 'jane@example.com' },
  ];
  const alreadySent = options.alreadySentTriggers ?? new Set<string>();

  const query: PoolQuery = async (sql, params) => {
    if (sql.includes('FROM tasks t')) {
      return { rows: [taskRow], rowCount: 1 };
    }
    if (sql.includes('FROM email_deliveries')) {
      const trigger = String(params?.[1] ?? '');
      return alreadySent.has(trigger)
        ? { rows: [{}], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM task_contacts tc')) {
      return { rows: recipients, rowCount: recipients.length };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  return { query: vi.fn(query) };
}

describe('maybeSendTerminalEmails', () => {
  beforeEach(() => {
    mocks.getPool.mockReset();
    mocks.dispatchOutboundEmail.mockReset();
    mocks.dispatchOutboundEmail.mockResolvedValue({
      id: 1,
      taskId: 42,
      trigger: 'task_completed',
      toAddresses: 'jane@example.com',
      subject: 'Your order has been delivered!',
      status: 'sent',
      providerMessageId: 'msg-1',
      errorMessage: null,
      sentAt: '2026-08-12T10:00:00Z',
      createdAt: '2026-08-12T10:00:00Z',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the completed email on the first transition into Completed', async () => {
    const pool = makePool();
    mocks.getPool.mockReturnValue(pool);

    await maybeSendTerminalEmails(42, {
      fromStatus: 'In Progress',
      toStatus: 'Completed',
    });

    expect(mocks.dispatchOutboundEmail).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchOutboundEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 42,
        trigger: 'task_completed',
        to: 'jane@example.com',
      }),
    );
  });

  it('does not re-send when a sent delivery exists for the same trigger', async () => {
    const pool = makePool({ alreadySentTriggers: new Set(['task_completed']) });
    mocks.getPool.mockReturnValue(pool);

    // Task was Completed before, got reopened, and is now Completed again.
    await maybeSendTerminalEmails(42, {
      fromStatus: 'In Progress',
      toStatus: 'Completed',
    });

    expect(mocks.dispatchOutboundEmail).not.toHaveBeenCalled();
  });

  it('still sends when only the other trigger was already emailed', async () => {
    const pool = makePool({
      alreadySentTriggers: new Set(['task_completed']),
    });
    mocks.getPool.mockReturnValue(pool);

    // Only a completed email exists; a later failure must still go out.
    await maybeSendTerminalEmails(42, {
      fromStatus: 'Completed',
      toStatus: 'Failed',
    });

    expect(mocks.dispatchOutboundEmail).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchOutboundEmail).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 42, trigger: 'task_failed' }),
    );
  });

  it('does not send when the status did not actually change', async () => {
    const pool = makePool();
    mocks.getPool.mockReturnValue(pool);

    await maybeSendTerminalEmails(42, {
      fromStatus: 'Completed',
      toStatus: 'Completed',
    });

    expect(mocks.dispatchOutboundEmail).not.toHaveBeenCalled();
  });

  it('does not send for non-terminal statuses', async () => {
    const pool = makePool();
    mocks.getPool.mockReturnValue(pool);

    await maybeSendTerminalEmails(42, {
      fromStatus: 'In Progress',
      toStatus: 'Undetermined',
    });

    expect(mocks.dispatchOutboundEmail).not.toHaveBeenCalled();
  });

  it('does not send for non-emailable task types', async () => {
    const pool = makePool({ taskType: 'Pickup' });
    mocks.getPool.mockReturnValue(pool);

    await maybeSendTerminalEmails(42, {
      fromStatus: 'In Progress',
      toStatus: 'Completed',
    });

    expect(mocks.dispatchOutboundEmail).not.toHaveBeenCalled();
  });

  it('does not send when there are no email recipients', async () => {
    const pool = makePool({ recipients: [] });
    mocks.getPool.mockReturnValue(pool);

    await maybeSendTerminalEmails(42, {
      fromStatus: 'In Progress',
      toStatus: 'Completed',
    });

    expect(mocks.dispatchOutboundEmail).not.toHaveBeenCalled();
  });
});
