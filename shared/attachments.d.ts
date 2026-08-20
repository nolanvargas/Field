export const MAX_ATTACHMENT_BYTES: number;
export const MAX_VIDEO_ATTACHMENT_BYTES: number;
export const ALLOWED_MIME_TYPES: ReadonlySet<string>;

export function normalizeMimeType(mimeType: string): string;

export function isVideoMimeType(mimeType: string): boolean;

export function maxBytesForMimeType(mimeType: string): number;

export function oversizeErrorMessage(mimeType: string, maxBytes: number): string;

export function kindFromMimeType(mimeType: string): "photo" | "video" | "document";
