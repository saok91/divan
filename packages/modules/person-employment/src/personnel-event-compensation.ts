/**
 * Compensation / Contract personnel event helpers (Story 4.8 / FR-24).
 * Structural payload only; monetary values via compensation-facts draft sidecar.
 * Product path = Draft → Finalize → hook — no public changeSalary / updateContract.
 */

import type { PoolClient, PrismaClient } from "@divan/db";
import {
  applyCompensationProjection,
  applyContractualProjection,
  clearDraftCompensationValues,
  closeCompensationProjection,
  deleteCompensationProjection,
  getCompensationAsOf,
  getCompensationDb,
  getContractualAsOf,
  listCompensationFactsForPerson,
  peekDraftCompensationValues,
  reopenCompensationProjection,
  restoreDraftCompensationValues,
  takeDraftCompensationValues,
  type DraftCompensationValues,
  FACT_KIND,
} from "@divan/compensation-facts";
import { getBusinessEventById } from "@divan/event-store";

import { getPersonDb } from "./db";
import {
  getEmploymentById,
  isEmploymentActiveAsOf,
} from "./employment";
import { PersonnelEventError } from "./errors";
import type { ProjectionRefreshContext } from "./personnel-event-projection-hook";

export const PRODUCT_COMPENSATION_EVENT_TYPE = "CompensationChanged";
export const PRODUCT_CONTRACT_EVENT_TYPE = "ContractChanged";

export const COMPENSATION_EVENT_TYPES = new Set([
  PRODUCT_COMPENSATION_EVENT_TYPE,
  PRODUCT_CONTRACT_EVENT_TYPE,
]);

export type CompensationStructuralFacts = {
  employmentId: string | null;
  currency: string | null;
  changeType: string | null;
  collaborationType: string | null;
  contractType: string | null;
  contractingEntity: string | null;
  insuringEntity: string | null;
  contractReference: string | null;
  contractStartDate: string | null;
  contractEndDateExclusive: string | null;
};

export type MissingCompensationFact = {
  code: string;
  messageFa: string;
};

function strField(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/**
 * Structural refs only — amount/components must live in sidecar.
 */
export function parseCompensationPayload(
  eventType: string,
  payload: Record<string, unknown>,
  opts?: { employmentIdFallback?: string | null },
): {
  facts: CompensationStructuralFacts | null;
  missing: MissingCompensationFact[];
} {
  const missing: MissingCompensationFact[] = [];
  const employmentId =
    strField(payload, "employmentId") ||
    (opts?.employmentIdFallback?.trim() || null);
  if (!employmentId) {
    missing.push({
      code: "MISSING_EMPLOYMENT",
      messageFa: "شناسه همکاری برای تغییر جبران‌خدمت/قرارداد الزامی است.",
    });
  }

  if (
    eventType !== PRODUCT_COMPENSATION_EVENT_TYPE &&
    eventType !== PRODUCT_CONTRACT_EVENT_TYPE
  ) {
    missing.push({
      code: "UNKNOWN_COMPENSATION_TYPE",
      messageFa: "نوع رویداد جبران‌خدمت/قرارداد ناشناخته است.",
    });
  }

  if (missing.length > 0) {
    return { facts: null, missing };
  }

  return {
    facts: {
      employmentId,
      currency: strField(payload, "currency"),
      changeType: strField(payload, "changeType"),
      collaborationType: strField(payload, "collaborationType"),
      contractType: strField(payload, "contractType"),
      contractingEntity: strField(payload, "contractingEntity"),
      insuringEntity: strField(payload, "insuringEntity"),
      contractReference: strField(payload, "contractReference"),
      contractStartDate: strField(payload, "contractStartDate"),
      contractEndDateExclusive: strField(payload, "contractEndDateExclusive"),
    },
    missing: [],
  };
}

export type CompensationSource = {
  personId: string;
  effectiveDate: string;
  payload: Record<string, unknown>;
  employmentId: string | null;
  eventType: string;
  draftId: string | null;
};

export async function resolveCompensationSource(
  ctx: ProjectionRefreshContext,
): Promise<CompensationSource | null> {
  if (ctx.draft) {
    return {
      personId: ctx.draft.personId,
      effectiveDate: ctx.draft.effectiveDate,
      payload: ctx.draft.payload,
      employmentId: ctx.draft.employmentId,
      eventType: ctx.eventType,
      draftId: ctx.draft.id,
    };
  }
  const event = await getBusinessEventById(ctx.client, ctx.eventId);
  if (!event) return null;
  const draftIdFromPayload =
    typeof event.payload?.draftId === "string" && event.payload.draftId.trim()
      ? event.payload.draftId.trim()
      : null;
  return {
    personId: event.personId,
    effectiveDate: event.effectiveDate,
    payload: event.payload,
    employmentId: event.employmentId,
    eventType: event.eventType,
    draftId: draftIdFromPayload,
  };
}

export type CompensationApplyResult = {
  employmentId: string;
  personId: string;
  endDateExclusive: string;
  priorFactId: string | null;
  previousPriorEnd: string | null;
  newFactId: string | null;
  mutated: boolean;
  didClosePrior: boolean;
  didOpenNew: boolean;
  takenSidecar: DraftCompensationValues | null;
  draftId: string | null;
};

export async function clearCompensationSidecarForDraft(
  draftId: string,
): Promise<void> {
  await clearDraftCompensationValues(draftId);
}

/**
 * Effective CompensationChanged / ContractChanged:
 * take sidecar → close prior open fact → apply full snapshot with sourceEventId.
 * Recalc (no draft/sidecar): rebuild from existing projections via sourceEventId idempotency
 * or structural payload + prior fact fields already stored.
 */
export async function applyCompensationProjections(
  ctx: ProjectionRefreshContext,
  db: PrismaClient = getPersonDb(),
): Promise<CompensationApplyResult> {
  if (!COMPENSATION_EVENT_TYPES.has(ctx.eventType)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "نوع رویداد جبران‌خدمت/قرارداد نیست.",
      "not_compensation",
    );
  }

  const source = await resolveCompensationSource(ctx);
  if (!source) {
    throw new PersonnelEventError(
      "VALIDATION",
      "منبع رویداد جبران‌خدمت یافت نشد.",
      "missing_source",
    );
  }

  const { facts, missing } = parseCompensationPayload(
    source.eventType,
    source.payload,
    { employmentIdFallback: source.employmentId },
  );
  if (!facts || missing.length > 0) {
    throw new PersonnelEventError(
      "VALIDATION",
      missing[0]?.messageFa ?? "واقعیت‌های ساختاری ناقص است.",
      "missing_facts",
    );
  }

  const employmentId =
    source.employmentId?.trim() || facts.employmentId?.trim() || null;
  if (!employmentId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "شناسه همکاری الزامی است.",
      "missing_employment",
    );
  }

  const employment = await getEmploymentById(employmentId, db);
  if (!employment || employment.personId !== source.personId) {
    throw new PersonnelEventError(
      "VALIDATION",
      "سابقه همکاری هدف یافت نشد یا متعلق به این فرد نیست.",
      "employment_not_found",
    );
  }
  if (!isEmploymentActiveAsOf(employment, source.effectiveDate)) {
    throw new PersonnelEventError(
      "VALIDATION",
      "همکاری در تاریخ مؤثر فعال نیست.",
      "employment_inactive",
    );
  }

  const compDb = getCompensationDb();
  const isComp = source.eventType === PRODUCT_COMPENSATION_EVENT_TYPE;
  const kind = isComp ? FACT_KIND.compensation : FACT_KIND.contractual;

  // Idempotent: fact already opened for this event
  const existingList = await listCompensationFactsForPerson(
    source.personId,
    kind,
    compDb,
  );
  const existing = existingList.find((f) => f.sourceEventId === ctx.eventId);
  if (existing) {
    return {
      employmentId,
      personId: source.personId,
      endDateExclusive: source.effectiveDate,
      priorFactId: null,
      previousPriorEnd: null,
      newFactId: existing.id,
      mutated: false,
      didClosePrior: false,
      didOpenNew: false,
      takenSidecar: null,
      draftId: source.draftId,
    };
  }

  let takenSidecar: DraftCompensationValues | null = null;
  if (source.draftId) {
    takenSidecar = await takeDraftCompensationValues(source.draftId, compDb);
  }

  const prior = isComp
    ? await getCompensationAsOf(source.personId, source.effectiveDate, compDb)
    : await getContractualAsOf(source.personId, source.effectiveDate, compDb);

  let didClosePrior = false;
  let didOpenNew = false;
  let newFactId: string | null = null;
  const previousPriorEnd = prior?.endDateExclusive ?? null;

  try {
    if (prior) {
      if (
        prior.endDateExclusive === null ||
        prior.endDateExclusive > source.effectiveDate
      ) {
        if (prior.endDateExclusive !== source.effectiveDate) {
          await closeCompensationProjection(
            prior.id,
            source.effectiveDate,
            compDb,
          );
          didClosePrior = true;
        }
      }
    }

    if (isComp) {
      const amount =
        takenSidecar?.amount !== undefined && takenSidecar.amount !== null
          ? takenSidecar.amount
          : (prior?.amount ?? null);
      const components =
        takenSidecar?.components !== undefined
          ? (takenSidecar.components as never)
          : ((prior?.components as never) ?? null);

      // Finalize with draft must have sidecar amount (or prior to carry forward)
      if (source.draftId && amount === null && !prior) {
        throw new PersonnelEventError(
          "VALIDATION",
          "مبلغ جبران‌خدمت از کانال حساس پیش‌نویس یافت نشد.",
          "missing_sidecar_amount",
        );
      }

      const created = await applyCompensationProjection(
        {
          personId: source.personId,
          employmentId,
          startDate: source.effectiveDate,
          endDateExclusive: null,
          amount,
          components,
          currency: facts.currency ?? prior?.currency ?? null,
          changeType: facts.changeType ?? prior?.changeType ?? null,
          sourceEventId: ctx.eventId,
        },
        compDb,
      );
      newFactId = created.id;
      didOpenNew = true;
    } else {
      const created = await applyContractualProjection(
        {
          personId: source.personId,
          employmentId,
          startDate: source.effectiveDate,
          endDateExclusive: null,
          collaborationType:
            facts.collaborationType ?? prior?.collaborationType ?? null,
          contractType: facts.contractType ?? prior?.contractType ?? null,
          contractingEntity:
            facts.contractingEntity ?? prior?.contractingEntity ?? null,
          insuringEntity: facts.insuringEntity ?? prior?.insuringEntity ?? null,
          contractReference:
            facts.contractReference ?? prior?.contractReference ?? null,
          contractStartDate:
            facts.contractStartDate ?? prior?.contractStartDate ?? null,
          contractEndDateExclusive:
            facts.contractEndDateExclusive ??
            prior?.contractEndDateExclusive ??
            null,
          sourceEventId: ctx.eventId,
        },
        compDb,
      );
      newFactId = created.id;
      didOpenNew = true;
    }

    return {
      employmentId,
      personId: source.personId,
      endDateExclusive: source.effectiveDate,
      priorFactId: prior?.id ?? null,
      previousPriorEnd,
      newFactId,
      mutated: didClosePrior || didOpenNew,
      didClosePrior,
      didOpenNew,
      takenSidecar,
      draftId: source.draftId,
    };
  } catch (err) {
    await compensateCompensationApply(
      {
        personId: source.personId,
        endDateExclusive: source.effectiveDate,
        priorFactId: prior?.id ?? null,
        previousPriorEnd,
        newFactId,
        didClosePrior,
        didOpenNew,
        takenSidecar,
        draftId: source.draftId,
        kind,
      },
      compDb,
    );
    if (err instanceof PersonnelEventError) throw err;
    throw err;
  }
}

export async function compensateCompensationApply(
  opts: {
    personId: string;
    endDateExclusive: string;
    priorFactId: string | null;
    previousPriorEnd: string | null;
    newFactId: string | null;
    didClosePrior: boolean;
    didOpenNew: boolean;
    takenSidecar: DraftCompensationValues | null;
    draftId: string | null;
    kind: string;
  },
  db: PrismaClient = getCompensationDb(),
): Promise<void> {
  try {
    if (opts.didOpenNew && opts.newFactId) {
      await deleteCompensationProjection(opts.newFactId, db);
    }
    if (opts.didClosePrior && opts.priorFactId) {
      await reopenCompensationProjection(
        opts.priorFactId,
        opts.previousPriorEnd,
        opts.endDateExclusive,
        db,
      );
    }
    if (opts.draftId && opts.takenSidecar) {
      await restoreDraftCompensationValues(
        opts.draftId,
        opts.takenSidecar,
        db,
      );
    }
  } catch {
    // Best-effort
  }
}

/**
 * Reverse Effective CompensationChanged / ContractChanged — delete successor fact,
 * reopen prior closed at ED (Transfer-style undo).
 */
export async function undoCompensationApply(
  target: {
    id: string;
    personId: string;
    effectiveDate: string;
    eventType: string;
  },
  db: PrismaClient = getCompensationDb(),
): Promise<void> {
  const kind =
    target.eventType === PRODUCT_COMPENSATION_EVENT_TYPE
      ? FACT_KIND.compensation
      : FACT_KIND.contractual;
  const facts = await listCompensationFactsForPerson(
    target.personId,
    kind,
    db,
  );
  const opened = facts.find((f) => f.sourceEventId === target.id) ?? null;
  if (opened) {
    await deleteCompensationProjection(opened.id, db);
  }
  const prior =
    facts.find(
      (f) =>
        f.id !== opened?.id && f.endDateExclusive === target.effectiveDate,
    ) ?? null;
  if (prior) {
    await reopenCompensationProjection(
      prior.id,
      null,
      target.effectiveDate,
      db,
    );
  }
}

/** Conflicts helper: CompensationChanged with draft should have sidecar amount when no prior. */
export async function peekCompensationSidecarForDraft(
  draftId: string,
): Promise<DraftCompensationValues | null> {
  return peekDraftCompensationValues(draftId);
}

export type { PoolClient, DraftCompensationValues };
