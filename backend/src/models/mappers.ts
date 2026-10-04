import type {
  Alert,
  DisasterType,
  EmergencyContact,
  Incident,
  IncidentUpdate,
  SafetyGuide,
  Shelter,
  ShelterResource,
  User,
  UserSafetyStatus,
} from '@prisma/client';
import {
  bandForScore,
  coarsen,
  type AlertDTO,
  type DisasterTypeDTO,
  type EmergencyContactDTO,
  type Facility,
  type GuideSection,
  type IncidentDTO,
  type IncidentUpdateDTO,
  type PublicUser,
  type ReporterIncidentStatusDTO,
  type Role,
  type SafetyGuideDTO,
  type SafetyStatusDTO,
  type ShelterDTO,
  type SpecialRequirement,
} from '@resqnet/shared';

/** Prisma → API DTO mappers. These are the ONLY place DB rows become JSON. */

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: iso(u.createdAt),
  };
}

type PersonRow = Pick<User, 'id' | 'name'> | null;

export const incidentInclude = {
  reporter: { select: { id: true, name: true } },
  assignedResponder: { select: { id: true, name: true } },
  assignedVolunteer: { select: { id: true, name: true } },
} as const;

export const incidentWithUpdatesInclude = {
  ...incidentInclude,
  updates: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { name: true, role: true } } },
  },
} as const;

export type IncidentRow = Incident & {
  reporter: PersonRow;
  assignedResponder: PersonRow;
  assignedVolunteer: PersonRow;
  updates?: (IncidentUpdate & { author: Pick<User, 'name' | 'role'> | null })[];
};

export interface Viewer {
  userId: string;
  role: Role;
}

/**
 * Data minimisation: volunteers see an approximate (~1 km) location and no
 * phone number until they have accepted the task. Responders/admins see all.
 */
export function toIncidentDTO(row: IncidentRow, viewer?: Viewer): IncidentDTO {
  const isStaff = viewer?.role === 'RESPONDER' || viewer?.role === 'ADMIN';
  const isAssignedVolunteer = viewer?.role === 'VOLUNTEER' && row.assignedVolunteerId === viewer.userId;
  const isReporter = !!viewer && row.reporterId === viewer.userId;
  const fullDetail = isStaff || isAssignedVolunteer || isReporter;

  let latitude = row.latitude;
  let longitude = row.longitude;
  if (!fullDetail && latitude !== null && longitude !== null) {
    ({ latitude, longitude } = coarsen({ latitude, longitude }, 2));
  }

  return {
    id: row.id,
    clientId: row.clientId,
    referenceCode: row.referenceCode,
    type: row.type,
    severity: row.severity,
    peopleCount: row.peopleCount,
    specialRequirements: row.specialRequirements as SpecialRequirement[],
    description: row.description,
    latitude,
    longitude,
    accuracyMeters: fullDetail ? row.accuracyMeters : null,
    locationText: row.locationText,
    locationSource: row.locationSource,
    contactPhone: fullDetail ? row.contactPhone : null,
    status: row.status,
    priorityScore: row.priorityScore,
    priorityBand: bandForScore(row.priorityScore),
    priorityReasons: row.priorityReasons,
    reporter: isStaff ? row.reporter : null,
    assignedResponder: row.assignedResponder,
    assignedVolunteer: row.assignedVolunteer,
    clientCreatedAt: iso(row.clientCreatedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    resolvedAt: isoOrNull(row.resolvedAt),
    isDemo: row.isDemo,
    ...(row.updates ? { updates: row.updates.map(toIncidentUpdateDTO) } : {}),
  };
}

export function toIncidentUpdateDTO(
  u: IncidentUpdate & { author: Pick<User, 'name' | 'role'> | null },
): IncidentUpdateDTO {
  return {
    id: u.id,
    authorName: u.author?.name ?? null,
    authorRole: u.author?.role ?? null,
    status: u.status,
    note: u.note,
    createdAt: iso(u.createdAt),
  };
}

export function toReporterStatusDTO(
  row: Incident & { updates: Pick<IncidentUpdate, 'note'>[] },
): ReporterIncidentStatusDTO {
  return {
    clientId: row.clientId,
    id: row.id,
    referenceCode: row.referenceCode,
    status: row.status,
    assigned: !!(row.assignedResponderId || row.assignedVolunteerId),
    lastNote: row.updates[0]?.note ?? null,
    updatedAt: iso(row.updatedAt),
  };
}

export function toDisasterTypeDTO(d: DisasterType): DisasterTypeDTO {
  return { id: d.id, code: d.code, name: d.name, description: d.description };
}

export function toAlertDTO(a: Alert & { disasterType: DisasterType }): AlertDTO {
  return {
    id: a.id,
    title: a.title,
    disasterTypeCode: a.disasterType.code,
    disasterTypeName: a.disasterType.name,
    severity: a.severity,
    region: a.region,
    message: a.message,
    instruction: a.instruction,
    startsAt: iso(a.startsAt),
    expiresAt: iso(a.expiresAt),
    isActive: a.isActive,
    isDemo: a.isDemo,
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  };
}

export function toShelterDTO(s: Shelter & { resources: ShelterResource[] }): ShelterDTO {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    region: s.region,
    latitude: s.latitude,
    longitude: s.longitude,
    capacity: s.capacity,
    occupancy: s.occupancy,
    availableCapacity: Math.max(0, s.capacity - s.occupancy),
    facilities: s.facilities as Facility[],
    contactPhone: s.contactPhone,
    accessibilityInfo: s.accessibilityInfo,
    status: s.status,
    resources: s.resources.map((r) => ({
      id: r.id,
      resourceType: r.resourceType,
      quantity: r.quantity,
      unit: r.unit,
    })),
    updatedAt: iso(s.updatedAt),
  };
}

export function toContactDTO(c: EmergencyContact): EmergencyContactDTO {
  return {
    id: c.id,
    name: c.name,
    service: c.service,
    phone: c.phone,
    region: c.region,
    description: c.description,
    available24x7: c.available24x7,
    sortOrder: c.sortOrder,
    updatedAt: iso(c.updatedAt),
  };
}

export function toGuideDTO(g: SafetyGuide & { disasterType: DisasterType }): SafetyGuideDTO {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    disasterTypeCode: g.disasterType.code,
    summary: g.summary,
    sections: g.sections as unknown as GuideSection[],
    sortOrder: g.sortOrder,
    updatedAt: iso(g.updatedAt),
  };
}

export function toSafetyStatusDTO(s: UserSafetyStatus): SafetyStatusDTO {
  return {
    id: s.id,
    clientId: s.clientId,
    status: s.status,
    note: s.note,
    clientCreatedAt: iso(s.clientCreatedAt),
    createdAt: iso(s.createdAt),
  };
}
