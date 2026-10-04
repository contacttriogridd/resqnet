import type {
  IncidentCreate,
  IncidentStatus,
  SafetyState,
  SyncEntityType,
  SyncOperationType,
} from '@resqnet/shared';

/** Types for data stored on the device (IndexedDB). */

/** Where a locally-created record is in its journey to the server. */
export type LocalSyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

/** One queued change waiting to be sent to /api/sync. */
export interface QueueOperation {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  operationType: SyncOperationType;
  payload: unknown;
  /** ISO time the operation was queued. */
  createdAt: string;
  retryCount: number;
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED';
  lastAttempt: string | null;
  /** Epoch ms before which the operation should not be retried (backoff). */
  nextAttemptAt: number;
  lastError: string | null;
}

export interface LocalIncident {
  clientId: string;
  payload: IncidentCreate;
  /** PENDING until the server has it; then mirrors the server status. */
  status: IncidentStatus;
  syncStatus: LocalSyncStatus;
  syncError: string | null;
  serverId: string | null;
  referenceCode: string | null;
  createdAt: string;
  syncedAt: string | null;
  statusCheckedAt: string | null;
  assigned: boolean;
  lastNote: string | null;
}

export interface LocalSafetyStatus {
  clientId: string;
  status: SafetyState;
  note: string | null;
  createdAt: string;
  syncStatus: LocalSyncStatus;
  syncedAt: string | null;
}

export type DatasetKey = 'contacts' | 'guides' | 'shelters' | 'alerts' | 'disasterTypes' | 'tasks';

export interface Dataset<T = unknown> {
  key: DatasetKey;
  data: T;
  /** When the server produced this data. null for data bundled with the app. */
  syncedAt: string | null;
  region: string | null;
  source: 'bundled' | 'server';
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  phone: string | null;
  medicalInfo: string | null;
  accessibilityNeeds: string | null;
  preferredShelterId: string | null;
  preferredShelterName: string | null;
  safetyNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedLocation {
  latitude?: number;
  longitude?: number;
  text?: string;
  label: string;
  savedAt: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export interface Draft {
  id: string;
  values: unknown;
  updatedAt: string;
}

/** The user's own emergency details — stored ONLY on this device. */
export interface MyEmergencyInfo {
  name?: string;
  phone?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  /** Attach the phone number to help requests so responders can call back. */
  sharePhoneWithRequests: boolean;
}
