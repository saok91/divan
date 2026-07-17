/**
 * Epic 4 handoff checklist for compensation / contractual facts (Story 3.4).
 *
 * | Fact | Owner | Notes |
 * | --- | --- | --- |
 * | Isolated schema + projection writers | 3.4 | Required before 4.8 |
 * | Dictionary-approved field set | 3.3 + AR-DATA | Only approved fields retained on finalize |
 * | Separate compensation view/export permissions | 2.2 / AD-5 | Category still disabled until AR-DATA |
 * | Personnel Event finalize → projection refresh | 4.8 | Calls same apply*Projection surface |
 * | Current/historical person state | 4.9–4.10 | Reads from events + projections |
 * | Payroll / tax / payment | Out of scope | Must never appear |
 */

export type CompensationMinimumFact = {
  fact: string;
  ownerStory: string;
  required: boolean;
  notes: string;
};

export const COMPENSATION_MINIMUM_FACTS: readonly CompensationMinimumFact[] = [
  {
    fact: "Isolated schema + projection writers",
    ownerStory: "3.4",
    required: true,
    notes: "Required before Story 4.8 — applyCompensationProjection / applyContractualProjection",
  },
  {
    fact: "Dictionary-approved field set",
    ownerStory: "3.3 + AR-DATA",
    required: true,
    notes: "Only approved fields retained on finalize; seed candidates stay later",
  },
  {
    fact: "Separate compensation view/export permissions",
    ownerStory: "2.2 / AD-5",
    required: true,
    notes: "Category still disabled until AR-DATA; export ≠ view",
  },
  {
    fact: "Personnel Event finalize → projection refresh",
    ownerStory: "4.8",
    required: true,
    notes: "Calls same apply*Projection surface — no throwaway CRUD",
  },
  {
    fact: "Current/historical person state",
    ownerStory: "4.9–4.10",
    required: true,
    notes: "Reads from events + projections",
  },
  {
    fact: "Payroll / tax / payment",
    ownerStory: "Out of scope",
    required: false,
    notes: "Must never appear in this module",
  },
] as const;
