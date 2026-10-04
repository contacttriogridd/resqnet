import type { IncidentStatus, Role } from './enums.js';

/**
 * Allowed incident status transitions. Used by the API to reject invalid
 * changes and by the UI to decide which action buttons to show.
 */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  PENDING: ['RECEIVED'],
  RECEIVED: ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  VERIFIED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  ASSIGNED: ['VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['ASSIGNED', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['IN_PROGRESS'],
  CANCELLED: ['RECEIVED'],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return from === to || INCIDENT_TRANSITIONS[from].includes(to);
}

/** Statuses a volunteer may set on a task assigned to them. */
export const VOLUNTEER_SETTABLE_STATUSES: readonly IncidentStatus[] = ['IN_PROGRESS', 'RESOLVED'];

/** Reporters may withdraw a request until it is resolved. */
export const REPORTER_CANCELLABLE_STATUSES: readonly IncidentStatus[] = [
  'PENDING',
  'RECEIVED',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
];

export const STAFF_ROLES: readonly Role[] = ['RESPONDER', 'ADMIN'];
export const FIELD_ROLES: readonly Role[] = ['VOLUNTEER', 'RESPONDER', 'ADMIN'];
