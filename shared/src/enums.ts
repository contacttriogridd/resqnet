/**
 * Domain enumerations. Values are kept identical to the Prisma enums in
 * prisma/schema.prisma so they can cross the API boundary unchanged.
 */

export const ROLES = ['CIVILIAN', 'VOLUNTEER', 'RESPONDER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const INCIDENT_TYPES = [
  'MEDICAL',
  'TRAPPED',
  'FLOOD',
  'FIRE',
  'BUILDING_COLLAPSE',
  'MISSING_PERSON',
  'FOOD_WATER',
  'EVACUATION',
  'OTHER',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PEOPLE_COUNTS = ['ONE', 'TWO_TO_FIVE', 'SIX_TO_TEN', 'MORE_THAN_TEN'] as const;
export type PeopleCount = (typeof PEOPLE_COUNTS)[number];

export const SPECIAL_REQUIREMENTS = [
  'CHILD',
  'ELDERLY',
  'PREGNANT',
  'INJURED',
  'DISABLED',
  'MEDICAL',
  'NO_FOOD',
  'NO_WATER',
] as const;
export type SpecialRequirement = (typeof SPECIAL_REQUIREMENTS)[number];

/**
 * Server-side lifecycle. PENDING is used on devices for reports that have not
 * reached the server yet; the server stores RECEIVED as the first state.
 */
export const INCIDENT_STATUSES = [
  'PENDING',
  'RECEIVED',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const ACTIVE_INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'RECEIVED',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
];

export const LOCATION_SOURCES = ['GPS', 'MANUAL', 'SAVED'] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const ALERT_SEVERITIES = ['INFO', 'ADVISORY', 'WARNING', 'CRITICAL'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const SAFETY_STATES = ['SAFE', 'NEED_ASSISTANCE', 'EMERGENCY', 'UNKNOWN'] as const;
export type SafetyState = (typeof SAFETY_STATES)[number];

export const FACILITIES = [
  'FOOD',
  'WATER',
  'MEDICAL',
  'TOILETS',
  'ELECTRICITY',
  'CHARGING',
  'WOMEN',
  'CHILD_FRIENDLY',
  'DISABLED_ACCESS',
] as const;
export type Facility = (typeof FACILITIES)[number];

export const CONTACT_SERVICES = [
  'EMERGENCY',
  'POLICE',
  'FIRE_RESCUE',
  'AMBULANCE',
  'DISASTER_MANAGEMENT',
  'CONTROL_ROOM',
  'HOSPITAL',
  'SHELTER_COORDINATOR',
  'HELPLINE',
  'SUPPORT',
] as const;
export type ContactService = (typeof CONTACT_SERVICES)[number];

export const SHELTER_STATUSES = ['OPEN', 'FULL', 'CLOSED'] as const;
export type ShelterStatus = (typeof SHELTER_STATUSES)[number];

/** Entities that can be created/changed offline and replayed through /api/sync. */
export const SYNC_ENTITY_TYPES = ['INCIDENT', 'SAFETY_STATUS'] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const SYNC_OPERATION_TYPES = ['CREATE', 'CANCEL'] as const;
export type SyncOperationType = (typeof SYNC_OPERATION_TYPES)[number];

/** Result of applying one queued operation on the server. */
export const SYNC_RESULT_STATUSES = ['APPLIED', 'DUPLICATE', 'REJECTED'] as const;
export type SyncResultStatus = (typeof SYNC_RESULT_STATUSES)[number];
