export function pickCuratedAttachmentStorageKey(kind: string, seed: number): string;

export function pickCuratedDemoAttachmentStorageKey(kind: string, seed: number): string;

export function curatedAttachmentByteSize(storageKey: string): number | null;

export function curatedAttachmentFileName(storageKey: string): string | null;
