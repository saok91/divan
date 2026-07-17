/**
 * Epic 4 minimum facts for a valid Employment + Primary Assignment pair (AC #5).
 * Story 3.7: Primary schema + invariants live; product mutations still Epic 4.
 * Story 3.8: Secondary schema + invariants live (dual-role fidelity); no headcount; mutations still Epic 4.
 *
 * | Fact | Owner story | Notes |
 * | --- | --- | --- |
 * | Stable Person + Personnel Code | 3.1 | Required |
 * | Employment start date (date-only) | 3.2 | Required |
 * | Collaboration / approved employment status | 3.2 lean / AR-DATA | Required for Start; exact codes AR-DATA |
 * | Legal Entity → … → Team (Primary org) | 3.5 + 3.7 | OrgUnit live; Team via PrimaryAssignment.teamId |
 * | Exactly one active Primary Assignment | 3.7 + Epic 4 | Schema + invariants live (3.7); mutations via events (Epic 4) |
 * | Secondary Assignment (0..* concurrent dual roles) | 3.8 + Epic 4 | Schema + inventory gate live (3.8); no headcount; mutations Epic 4 |
 * | Headcount capacity / Override | Epic 4 / FR-20 | Not this story — Primary only by default |
 */

export type EmploymentMinimumFact = {
  fact: string;
  ownerStory: string;
  required: boolean;
  notes: string;
};

export const EMPLOYMENT_MINIMUM_FACTS: readonly EmploymentMinimumFact[] = [
  {
    fact: "Stable Person + Personnel Code",
    ownerStory: "3.1",
    required: true,
    notes: "Person UUID PK; Personnel Code unique domain identifier",
  },
  {
    fact: "Employment start date (date-only)",
    ownerStory: "3.2",
    required: true,
    notes: "Half-open [start, endExclusive); Asia/Tehran date-only",
  },
  {
    fact: "Collaboration / approved employment status",
    ownerStory: "3.2 lean / AR-DATA",
    required: true,
    notes: "Required for Start; exact codes owned by AR-DATA",
  },
  {
    fact: "Legal Entity → … → Team (Primary org)",
    ownerStory: "3.5 + 3.7",
    required: true,
    notes:
      "OrgUnit schema live (3.5); Team membership via PrimaryAssignment.teamId (3.7) — no Employment.orgUnitId",
  },
  {
    fact: "Organizational Role (job reference)",
    ownerStory: "3.6 + 3.7",
    required: true,
    notes:
      "Schema ready (3.6); PrimaryAssignment.organizationalRoleId carrier live (3.7); mutations Epic 4",
  },
  {
    fact: "Job Title (job reference)",
    ownerStory: "3.6 + 3.7",
    required: true,
    notes:
      "Schema ready (3.6); PrimaryAssignment.jobTitleId carrier live (3.7); headcount match Epic 4",
  },
  {
    fact: "Ladder + Grade (job reference; Grade∈Ladder, half-grades)",
    ownerStory: "3.6 + 3.7",
    required: true,
    notes:
      "Schema ready (3.6); Primary ladderId/gradeId + Grade∈Ladder assert live (3.7); no Grade↔Seniority map",
  },
  {
    fact: "Seniority (independent job reference)",
    ownerStory: "3.6 + 3.7",
    required: false,
    notes:
      "Schema ready (3.6); optional PrimaryAssignment.seniorityId (3.7); no required Grade/Ladder FK",
  },
  {
    fact: "Exactly one active Primary Assignment",
    ownerStory: "3.7 + Epic 4",
    required: true,
    notes:
      "Schema + EXCLUDE + domain invariants live (3.7); product create/change/end only via personnel events (Epic 4)",
  },
  {
    fact: "Secondary Assignment (dual-role fidelity)",
    ownerStory: "3.8 + Epic 4",
    required: false,
    notes:
      "Schema + equivalent-overlap EXCLUDE + inventory gate + Employment coverage live (3.8); no headcount consumption; product mutations via events (Epic 4); migration Epic 6",
  },
  {
    fact: "Headcount capacity / Override",
    ownerStory: "Epic 4 / FR-20",
    required: false,
    notes:
      "Deferred — Primary consumes headcount (Epic 4); Secondary never by default (FR-12 / FR-29)",
  },
] as const;
