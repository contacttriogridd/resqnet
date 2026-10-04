import type {
  AlertCreateInput,
  AlertDTO,
  AnalyticsDTO,
  ContactCreateInput,
  EmergencyContactDTO,
  IncidentDTO,
  IncidentUpdateInput,
  PublicUser,
  Role,
  ShelterCreateInput,
  ShelterDTO,
} from '@resqnet/shared';
import { saveDataset } from '../offline/datasets';
import { api } from './apiClient';

/**
 * APIs for volunteers, responders and administrators. These are online
 * operations; the last fetched task list is cached so field staff can still
 * read assignments if the connection drops.
 */

export interface IncidentQuery {
  status?: string;
  assigned?: 'me' | 'unassigned' | 'any';
  includeDemo?: boolean;
}

export async function fetchIncidents(q: IncidentQuery = {}): Promise<IncidentDTO[]> {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.assigned) params.set('assigned', q.assigned);
  if (q.includeDemo === false) params.set('includeDemo', 'false');
  const res = await api<{ incidents: IncidentDTO[] }>(`/incidents?${params}`);
  await saveDataset('tasks', res.incidents, new Date().toISOString());
  return res.incidents;
}

export async function fetchIncident(id: string) {
  return (await api<{ incident: IncidentDTO }>(`/incidents/${id}`)).incident;
}

export async function updateIncident(id: string, body: IncidentUpdateInput) {
  return (await api<{ incident: IncidentDTO }>(`/incidents/${id}`, { method: 'PATCH', body })).incident;
}

export async function acceptIncident(id: string) {
  return (await api<{ incident: IncidentDTO }>(`/incidents/${id}/accept`, { method: 'POST' })).incident;
}

export async function addIncidentNote(id: string, note: string) {
  return (await api<{ incident: IncidentDTO }>(`/incidents/${id}/notes`, { method: 'POST', body: { note } })).incident;
}

export async function fetchAssignable(role: 'RESPONDER' | 'VOLUNTEER') {
  return (await api<{ users: { id: string; name: string; role: Role }[] }>(`/users/assignable?role=${role}`)).users;
}

/* ── Admin ── */

export async function fetchAnalytics(includeDemo: boolean) {
  return api<AnalyticsDTO>(`/admin/analytics?includeDemo=${includeDemo}`);
}

export async function fetchUsers(q?: string, role?: Role) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (role) params.set('role', role);
  return (await api<{ users: PublicUser[] }>(`/admin/users?${params}`)).users;
}

export async function createUser(body: { name: string; email: string; password: string; role: Role; phone?: string }) {
  return (await api<{ user: PublicUser }>('/admin/users', { method: 'POST', body })).user;
}

export async function updateUser(id: string, body: { role?: Role; isActive?: boolean }) {
  return (await api<{ user: PublicUser }>(`/admin/users/${id}`, { method: 'PATCH', body })).user;
}

export async function fetchAllAlerts() {
  return (await api<{ alerts: AlertDTO[] }>('/admin/alerts')).alerts;
}

export async function createAlert(body: AlertCreateInput) {
  return (await api<{ alert: AlertDTO }>('/alerts', { method: 'POST', body })).alert;
}

export async function deactivateAlert(id: string) {
  return (await api<{ alert: AlertDTO }>(`/alerts/${id}`, { method: 'DELETE' })).alert;
}

export async function fetchShelters() {
  return (await api<{ shelters: ShelterDTO[] }>('/shelters')).shelters;
}

export async function createShelter(body: ShelterCreateInput) {
  return (await api<{ shelter: ShelterDTO }>('/shelters', { method: 'POST', body })).shelter;
}

export async function updateShelter(id: string, body: Partial<ShelterCreateInput>) {
  return (await api<{ shelter: ShelterDTO }>(`/shelters/${id}`, { method: 'PATCH', body })).shelter;
}

export async function removeShelter(id: string) {
  await api<void>(`/shelters/${id}`, { method: 'DELETE' });
}

export async function fetchContacts() {
  return (await api<{ contacts: EmergencyContactDTO[] }>('/emergency-contacts')).contacts;
}

export async function createContact(body: ContactCreateInput) {
  return (await api<{ contact: EmergencyContactDTO }>('/emergency-contacts', { method: 'POST', body })).contact;
}

export async function removeContact(id: string) {
  await api<void>(`/emergency-contacts/${id}`, { method: 'DELETE' });
}

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorRole: Role | null;
  createdAt: string;
}

export async function fetchAuditLogs() {
  return (await api<{ logs: AuditLogRow[] }>('/admin/audit-logs')).logs;
}

/* ── Demo / simulation (admin, DEMO_MODE_ENABLED only) ── */

export const demo = {
  floodAlert: (region: string) => api<{ alert: AlertDTO }>('/demo/flood-alert', { method: 'POST', body: { region } }),
  rescueRequests: (region: string, count: number) =>
    api<{ created: number }>('/demo/rescue-requests', { method: 'POST', body: { region, count } }),
  shelterCapacity: (region: string) =>
    api<{ updated: number }>('/demo/shelter-capacity', { method: 'POST', body: { region } }),
  reset: () => api<{ incidentsRemoved: number; alertsRemoved: number }>('/demo/reset', { method: 'POST' }),
};
