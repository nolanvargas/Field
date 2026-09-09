export function isRestoreWindowOpenFromArchiveAt(
  archiveAt: string | null | undefined,
): boolean;

export function assertRestoreWindowOpenFromArchiveAt(
  archiveAt: string | null | undefined,
): void;

/** @deprecated Use per-task archiveAt */
export function archiveAtFromCancelledAt(
  cancelledAt: string | null | undefined,
  retentionDays: number | null | undefined,
): string | null;

/** @deprecated Use isRestoreWindowOpenFromArchiveAt */
export function isRestoreWindowOpen(
  cancelledAt: string | null | undefined,
  retentionDays: number | null | undefined,
): boolean;

/** @deprecated Use assertRestoreWindowOpenFromArchiveAt */
export function assertRestoreWindowOpen(
  cancelledAt: string | null | undefined,
  retentionDays: number | null | undefined,
): void;
