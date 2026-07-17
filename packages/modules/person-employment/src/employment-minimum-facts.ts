/**
 * Epic 4 minimum facts for a valid Employment + Primary Assignment pair (AC #5).
 * Documented for finalization checks — not enforced as live FKs in Story 3.2.
 *
 * | Fact | Owner story | Notes |
 * | --- | --- | --- |
 * | Stable Person + Personnel Code | 3.1 | Required |
 * | Employment start date (date-only) | 3.2 | Required |
 * | Collaboration / approved employment status | 3.2 lean / AR-DATA | Required for Start; exact codes AR-DATA |
 * | Legal Entity → … → Team (Primary org) | 3.5 | Required at finalization |
 * | Exactly one active Primary Assignment | 3.7 + Epic 4 | Required; mutations only via events |
 * | Headcount capacity / Override | Epic 4 / FR-20 | Not this story |
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
    ownerStory: "3.5",
    required: true,
    notes: "OrgUnit schema live (3.5); Primary Assignment Team membership still Epic 4 / Story 3.7 — no Employment.orgUnitId FK yet",
  },
  {
    fact: "Exactly one active Primary Assignment",
    ownerStory: "3.7 + Epic 4",
    required: true,
    notes: "Required; mutations only via personnel events",
  },
  {
    fact: "Headcount capacity / Override",
    ownerStory: "Epic 4 / FR-20",
    required: false,
    notes: "Not this story",
  },
] as const;
