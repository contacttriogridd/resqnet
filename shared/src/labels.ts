import type {
  AlertSeverity,
  ContactService,
  Facility,
  IncidentStatus,
  IncidentType,
  PeopleCount,
  Role,
  SafetyState,
  Severity,
  ShelterStatus,
  SpecialRequirement,
} from './enums.js';

/** Human-readable labels. Status is never conveyed by colour alone — always pair with these. */

export const ROLE_LABELS: Record<Role, string> = {
  CIVILIAN: 'Civilian',
  VOLUNTEER: 'Volunteer',
  RESPONDER: 'Responder',
  ADMIN: 'Administrator',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  MEDICAL: 'Medical emergency',
  TRAPPED: 'Trapped person',
  FLOOD: 'Flood',
  FIRE: 'Fire',
  BUILDING_COLLAPSE: 'Building collapse',
  MISSING_PERSON: 'Missing person',
  FOOD_WATER: 'Food / water needed',
  EVACUATION: 'Evacuation required',
  OTHER: 'Other',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const SEVERITY_HINTS: Record<Severity, string> = {
  CRITICAL: 'Life in danger right now',
  HIGH: 'Serious, needs help soon',
  MEDIUM: 'Needs help, not immediately dangerous',
  LOW: 'Minor or informational',
};

export const PEOPLE_COUNT_LABELS: Record<PeopleCount, string> = {
  ONE: '1',
  TWO_TO_FIVE: '2–5',
  SIX_TO_TEN: '6–10',
  MORE_THAN_TEN: '10+',
};

export const SPECIAL_REQUIREMENT_LABELS: Record<SpecialRequirement, string> = {
  CHILD: 'Child',
  ELDERLY: 'Elderly person',
  PREGNANT: 'Pregnant person',
  INJURED: 'Injured person',
  DISABLED: 'Person with disability',
  MEDICAL: 'Medical emergency',
  NO_FOOD: 'No food',
  NO_WATER: 'No drinking water',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  PENDING: 'Waiting for connection',
  RECEIVED: 'Received',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
};

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  INFO: 'Information',
  ADVISORY: 'Advisory',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
};

export const SAFETY_STATE_LABELS: Record<SafetyState, string> = {
  SAFE: 'I am safe',
  NEED_ASSISTANCE: 'I need assistance',
  EMERGENCY: 'Emergency',
  UNKNOWN: 'Unknown',
};

export const FACILITY_LABELS: Record<Facility, string> = {
  FOOD: 'Food',
  WATER: 'Drinking water',
  MEDICAL: 'Medical assistance',
  TOILETS: 'Toilets',
  ELECTRICITY: 'Electricity',
  CHARGING: 'Phone charging',
  WOMEN: "Women's facilities",
  CHILD_FRIENDLY: 'Child-friendly',
  DISABLED_ACCESS: 'Disabled access',
};

export const CONTACT_SERVICE_LABELS: Record<ContactService, string> = {
  EMERGENCY: 'All emergencies',
  POLICE: 'Police',
  FIRE_RESCUE: 'Fire & Rescue',
  AMBULANCE: 'Ambulance',
  DISASTER_MANAGEMENT: 'Disaster Management',
  CONTROL_ROOM: 'Emergency control room',
  HOSPITAL: 'Hospital',
  SHELTER_COORDINATOR: 'Shelter coordinator',
  HELPLINE: 'Helpline',
  SUPPORT: 'RESQNET support',
};

export const SHELTER_STATUS_LABELS: Record<ShelterStatus, string> = {
  OPEN: 'Open',
  FULL: 'Full',
  CLOSED: 'Closed',
};
