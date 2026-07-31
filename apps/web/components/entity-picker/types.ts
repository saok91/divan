/**
 * Shared entity-picker value / option shapes (Story 8.3 / UX-DR29).
 * `id` is the internal identifier for mutations; operators never type it.
 */

export type EntityPickerOption = {
  id: string;
  /** Business code (personnel code, org code, job-ref code, …). May be empty for dependent records. */
  code: string;
  /** Primary display name (Persian). */
  labelFa: string;
  /** Disambiguating second line (team · title, parent unit, dates, …). */
  secondaryFa?: string;
};

export type EntityPickerValue = EntityPickerOption | null;

export type EntityPickerSearchFn = (
  normalizedQuery: string,
) => Promise<EntityPickerOption[]>;

export type EntityPickerVariant =
  | "person"
  | "orgUnit"
  | "organizationalRole"
  | "jobTitle"
  | "ladder"
  | "grade"
  | "seniority"
  | "headcountApproval"
  | "account"
  | "employment"
  | "primaryAssignment";
