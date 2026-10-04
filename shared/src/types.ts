import type {
  AlertSeverity,
  ContactService,
  Facility,
  IncidentStatus,
  IncidentType,
  LocationSource,
  PeopleCount,
  Role,
  SafetyState,
  Severity,
  ShelterStatus,
  SpecialRequirement,
  SyncEntityType,
  SyncResultStatus,
} from './enums.js';
import type { GuideSection } from './schemas.js';
import type { PriorityBand } from './priority.js';

/** API response shapes (dates are ISO-8601 strings on the wire). */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: PublicUser;
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface IncidentUpdateDTO {
  id: string;
  authorName: string | null;
  authorRole: Role | null;
  status: IncidentStatus | null;
  note: string | null;
  createdAt: string;
}

export interface IncidentDTO {
  id: string;
  clientId: string;
  referenceCode: string;
  type: IncidentType;
  severity: Severity;
  peopleCount: PeopleCount;
  specialRequirements: SpecialRequirement[];
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationText: string | null;
  locationSource: LocationSource;
  contactPhone: string | null;
  status: IncidentStatus;
  priorityScore: number;
  priorityBand: PriorityBand;
  priorityReasons: string[];
  reporter: PersonRef | null;
  assignedResponder: PersonRef | null;
  assignedVolunteer: PersonRef | null;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  /** SYNC = it was saved offline on the device and delivered later by the sync queue. */
  receivedVia: 'DIRECT' | 'SYNC';
  isDemo: boolean;
  updates?: IncidentUpdateDTO[];
}

/** What a reporter's device is allowed to learn about its own reports. */
export interface ReporterIncidentStatusDTO {
  clientId: string;
  id: string;
  referenceCode: string;
  status: IncidentStatus;
  assigned: boolean;
  lastNote: string | null;
  updatedAt: string;
}

export interface DisasterTypeDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface AlertDTO {
  id: string;
  title: string;
  disasterTypeCode: string;
  disasterTypeName: string;
  severity: AlertSeverity;
  region: string;
  message: string;
  instruction: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShelterResourceDTO {
  id: string;
  resourceType: string;
  quantity: number;
  unit: string;
}

export interface ShelterDTO {
  id: string;
  name: string;
  address: string;
  region: string;
  latitude: number;
  longitude: number;
  capacity: number;
  occupancy: number;
  availableCapacity: number;
  facilities: Facility[];
  contactPhone: string | null;
  accessibilityInfo: string | null;
  status: ShelterStatus;
  resources: ShelterResourceDTO[];
  updatedAt: string;
}

export interface EmergencyContactDTO {
  id: string;
  name: string;
  service: ContactService;
  phone: string;
  region: string | null;
  description: string | null;
  available24x7: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface SafetyGuideDTO {
  id: string;
  slug: string;
  title: string;
  disasterTypeCode: string;
  summary: string;
  sections: GuideSection[];
  sortOrder: number;
  updatedAt: string;
}

export interface SafetyStatusDTO {
  id: string;
  clientId: string;
  status: SafetyState;
  note: string | null;
  clientCreatedAt: string;
  createdAt: string;
}

export interface SyncOperationResult {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  status: SyncResultStatus;
  serverId?: string;
  referenceCode?: string;
  /** Present when status is REJECTED: a safe, user-facing reason. */
  error?: string;
  /** Whether the client should retry later (e.g. transient server issue). */
  retryable?: boolean;
}

export interface SyncBatchResponse {
  results: SyncOperationResult[];
  serverTime: string;
}

export interface SyncStatusResponse {
  serverTime: string;
  deviceId: string | null;
  lastSyncAt: string | null;
  operationsReceived: number;
}

export interface OfflinePackDTO {
  region: string | null;
  generatedAt: string;
  contacts: EmergencyContactDTO[];
  shelters: ShelterDTO[];
  alerts: AlertDTO[];
  guides: SafetyGuideDTO[];
  disasterTypes: DisasterTypeDTO[];
}

export interface CountByKey {
  key: string;
  count: number;
}

export interface AnalyticsDTO {
  totals: {
    users: number;
    volunteers: number;
    responders: number;
    activeIncidents: number;
    criticalIncidents: number;
    resolvedIncidents: number;
    shelters: number;
    activeAlerts: number;
    pendingSafetyChecks: number;
  };
  incidentsByType: CountByKey[];
  incidentsBySeverity: CountByKey[];
  incidentsByLocation: CountByKey[];
  incidentsByStatus: CountByKey[];
  dailyVolume: { date: string; count: number }[];
  responseTime: {
    /** Median minutes from report to first assignment. */
    medianMinutesToAssign: number | null;
    /** Median minutes from report to resolution. */
    medianMinutesToResolve: number | null;
    sampleSize: number;
  };
  generatedAt: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  serverTime: string;
  demoMode: boolean;
  version: string;
}
