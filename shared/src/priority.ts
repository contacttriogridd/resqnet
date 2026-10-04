import type { IncidentType, PeopleCount, Severity, SpecialRequirement } from './enums.js';

/**
 * Transparent, rule-based incident prioritisation.
 *
 * This is ADVISORY ONLY. It produces a suggested score and the human-readable
 * reasons behind it; responders always make the final decision. The
 * `PriorityAdvisor` interface is the seam where an ML model could later be
 * plugged in without changing callers.
 */

export interface PriorityInput {
  type: IncidentType;
  severity: Severity;
  peopleCount: PeopleCount;
  specialRequirements: readonly SpecialRequirement[];
}

export type PriorityBand = 'IMMEDIATE' | 'URGENT' | 'PRIORITY' | 'ROUTINE';

export interface PriorityAssessment {
  score: number;
  band: PriorityBand;
  reasons: string[];
  /** Identifies which advisor produced the result, for audit trails. */
  advisor: string;
}

export interface PriorityAdvisor {
  readonly name: string;
  assess(input: PriorityInput): PriorityAssessment;
}

const SEVERITY_POINTS: Record<Severity, number> = { CRITICAL: 60, HIGH: 40, MEDIUM: 20, LOW: 5 };
const PEOPLE_POINTS: Record<PeopleCount, number> = {
  ONE: 0,
  TWO_TO_FIVE: 5,
  SIX_TO_TEN: 10,
  MORE_THAN_TEN: 15,
};
const TYPE_POINTS: Partial<Record<IncidentType, number>> = {
  TRAPPED: 8,
  BUILDING_COLLAPSE: 8,
  FIRE: 8,
  MEDICAL: 8,
  FLOOD: 5,
  EVACUATION: 5,
  MISSING_PERSON: 4,
};
const VULNERABLE: readonly SpecialRequirement[] = ['CHILD', 'ELDERLY', 'PREGNANT', 'DISABLED'];

export const PRIORITY_BAND_LABELS: Record<PriorityBand, string> = {
  IMMEDIATE: 'P1 · Immediate',
  URGENT: 'P2 · Urgent',
  PRIORITY: 'P3 · Priority',
  ROUTINE: 'P4 · Routine',
};

export function bandForScore(score: number): PriorityBand {
  if (score >= 75) return 'IMMEDIATE';
  if (score >= 50) return 'URGENT';
  if (score >= 30) return 'PRIORITY';
  return 'ROUTINE';
}

export const ruleBasedPriorityAdvisor: PriorityAdvisor = {
  name: 'rules-v1',
  assess(input) {
    const reasons: string[] = [];
    let score = SEVERITY_POINTS[input.severity];
    reasons.push(`Reported severity: ${input.severity.toLowerCase()}`);

    const people = PEOPLE_POINTS[input.peopleCount];
    if (people > 0) {
      score += people;
      reasons.push('Multiple people affected');
    }

    const typePts = TYPE_POINTS[input.type] ?? 0;
    if (typePts > 0) {
      score += typePts;
      reasons.push(`High-risk incident type (${input.type.toLowerCase().replace(/_/g, ' ')})`);
    }

    const reqs = new Set(input.specialRequirements);
    const vulnerableCount = VULNERABLE.filter((r) => reqs.has(r)).length;
    if (vulnerableCount > 0) {
      score += Math.min(vulnerableCount * 4, 12);
      reasons.push('Vulnerable people present');
    }
    const medicalCount = (reqs.has('INJURED') ? 1 : 0) + (reqs.has('MEDICAL') ? 1 : 0);
    if (medicalCount > 0) {
      score += Math.min(medicalCount * 6, 10);
      reasons.push('Injury or medical need');
    }
    if (reqs.has('NO_WATER')) {
      score += 4;
      reasons.push('No drinking water');
    }
    if (reqs.has('NO_FOOD')) {
      score += 2;
      reasons.push('No food');
    }

    score = Math.max(0, Math.min(100, score));
    return { score, band: bandForScore(score), reasons, advisor: this.name };
  },
};

export function assessPriority(
  input: PriorityInput,
  advisor: PriorityAdvisor = ruleBasedPriorityAdvisor,
): PriorityAssessment {
  return advisor.assess(input);
}

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Sort order for responder queues: severity first, then suggested score, then oldest first. */
export function compareIncidentsForTriage(
  a: { severity: Severity; priorityScore: number; createdAt: string | Date },
  b: { severity: Severity; priorityScore: number; createdAt: string | Date },
): number {
  const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (sev !== 0) return sev;
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
