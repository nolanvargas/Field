import type { OrgCustomFieldDef } from '../api/orgSettings';

export type TaskStatus =
  | 'Unassigned'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Failed'
  | 'Undetermined'
  | 'Cancelled';

export type TaskType = string;

export interface Task {
  id: number;
  taskType: TaskType;
  status: TaskStatus;
  externalKey: string;
  jobTitle: string;
  contactNames: string;
  destinationAddressName: string;
  destinationStreet: string;
  destinationBuilding: string;
  destinationAddress: string;
  crewName: string | null;
  windowStartAt: string | null;
  windowEndAt: string | null;
  description: string;
  createdByName: string;
  cancelledAt: string | null;
  archiveAt?: string | null;
  trackingToken?: string;
  trackingPath?: string;
  trackingUrl?: string;
  customFields?: Record<string, CustomFieldValue>;
  customFieldDefs?: OrgCustomFieldDef[];
  customFieldDisplays?: Record<string, string>;
}

export interface TaskCrewMember {
  id: string;
  displayName: string;
  /** True when this crew member is the task lead; others are sub. */
  isLead: boolean;
  startedAt: string | null;
  endedAt: string | null;
}

export interface TaskContact {
  id: number;
  name: string;
  title: string;
  phone: string;
  email: string;
  isPoc: boolean;
  /** Whether this contact receives automated emails about the task. */
  receivesEmail: boolean;
}

export type AttachmentKind = 'photo' | 'signature' | 'document' | 'video';

export interface TaskAttachment {
  id: number;
  taskId: number;
  kind: AttachmentKind;
  storageKey: string;
  mimeType: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  caption: string | null;
  createdAt: string;
  uploadedByUserId: string;
  uploadedByName: string | null;
}

export interface TaskCompletionNote {
  userId: string;
  displayName: string;
  outcome: 'Completed' | 'Failed';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomFieldValue = string | number | boolean | string[] | null;

export interface TaskDetail {
  id: number;
  taskType: TaskType;
  taskTypeId?: number | null;
  status: TaskStatus;
  description: string;
  jobTitle: string;
  externalKey: string;
  destinationAddressId: number | null;
  destinationAddressName: string;
  destinationAddress: string;
  destinationBuilding: string;
  destinationNotes: string;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  contacts: TaskContact[];
  customFields: Record<string, CustomFieldValue>;
  customFieldDefs?: OrgCustomFieldDef[];
  customFieldDisplays: Record<string, string>;
  windowStartAt: string | null;
  windowEndAt: string | null;
  completedNotes: string | null;
  completedAt: string | null;
  failedReason: string | null;
  cancelledAt: string | null;
  archiveAt?: string | null;
  trackingToken?: string;
  trackingPath?: string;
  trackingUrl?: string;
  completionNotes: TaskCompletionNote[];
  completionNotesByName: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  crewMembers: TaskCrewMember[];
  attachments?: TaskAttachment[];
}
