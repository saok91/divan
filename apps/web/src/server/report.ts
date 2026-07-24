/**
 * Launch report catalogue governed router (Story 5.5 / FR-36).
 * Pipeline: authorize → PopulationPort ∩ InferenceBulk (channel report)
 * → reporting assembleReportRun → payload.
 *
 * No Prisma in web; no parallel report SoT; export stub only (6.5).
 */
import { getSharedPgPool, type Pool } from "@divan/db";
import {
  HeadcountApprovalError,
  assertActorHasHeadcountApprovalRead,
} from "@divan/headcount";
import { currentAsOfDate } from "@divan/identity-access";
import {
  PERSON_DATA_CATEGORY,
  PERSON_READ_PERMISSION,
  OrgUnitError,
  PersonIdentityError,
  actorHasCompensationRead,
  assertActorHasOrganizationRead,
  assertActorHasPersonRead,
  getPersonDb,
} from "@divan/person-employment";
import {
  LAUNCH_REPORT_DEFINITIONS,
  assembleReportRun,
  isLaunchReportKey,
  reportRequiresEffectiveDateRange,
  requireLaunchReportCatalogue,
  type LaunchReportKey,
  type ReportRunResult,
} from "@divan/reporting";
import { parseDateOnly } from "@divan/temporal-engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import { resolvePersonnelPopulationRegistry } from "./personnel-scoped-search";
import { runGovernedRetrieval } from "./retrieval-control";
import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_ASOF_INVALID_FA = "تاریخ مبنا نامعتبر است.";
const MSG_ASOF_REQUIRED_FA = "در حالت مبنا، تاریخ مبنا الزامی است.";
const MSG_RANGE_INVALID_FA = "بازه گزارش نامعتبر است.";
const MSG_DB_REQUIRED_FA =
  "پیکربندی پایگاه داده برای گزارش‌ها موجود نیست.";
const MSG_REPORT_KEY_INVALID_FA = "کلید گزارش نامعتبر است.";

/** Shared filter object — mirrors dashboard filter identity where practical. */
export const reportFilterSchema = z
  .object({
    reportKey: z.string().min(1),
    teamId: z.string().uuid().optional(),
    evaluationMode: z.enum(["current", "as_of"]).optional(),
    asOfDate: z.string().optional(),
    rangeStart: z.string().optional(),
    rangeEnd: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (!isLaunchReportKey(val.reportKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_REPORT_KEY_INVALID_FA,
        path: ["reportKey"],
      });
      return;
    }

    const rs = val.rangeStart?.trim() ?? "";
    const re = val.rangeEnd?.trim() ?? "";
    const needsRange = reportRequiresEffectiveDateRange(val.reportKey);

    if (needsRange && (!rs || !re)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_RANGE_INVALID_FA,
        path: rs ? ["rangeEnd"] : ["rangeStart"],
      });
    } else if ((rs && !re) || (!rs && re)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_RANGE_INVALID_FA,
        path: rs ? ["rangeEnd"] : ["rangeStart"],
      });
    } else if (rs && re) {
      const startParsed = parseDateOnly(rs);
      const endParsed = parseDateOnly(re);
      if (!startParsed.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MSG_RANGE_INVALID_FA,
          path: ["rangeStart"],
        });
      }
      if (!endParsed.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MSG_RANGE_INVALID_FA,
          path: ["rangeEnd"],
        });
      }
      if (startParsed.ok && endParsed.ok && rs > re) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MSG_RANGE_INVALID_FA,
          path: ["rangeEnd"],
        });
      }
    }

    if (val.evaluationMode === "as_of") {
      const raw = val.asOfDate?.trim() ?? "";
      if (!raw) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MSG_ASOF_REQUIRED_FA,
          path: ["asOfDate"],
        });
      } else {
        const parsed = parseDateOnly(raw);
        if (!parsed.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: MSG_ASOF_INVALID_FA,
            path: ["asOfDate"],
          });
        }
      }
    } else if (val.asOfDate != null && val.asOfDate.trim()) {
      const parsed = parseDateOnly(val.asOfDate.trim());
      if (!parsed.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MSG_ASOF_INVALID_FA,
          path: ["asOfDate"],
        });
      }
    }
  });

export type ReportFilterInput = z.infer<typeof reportFilterSchema>;

let reportPool: Pool | null = null;

function getReportPool(): Pool {
  if (reportPool) return reportPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  reportPool = getSharedPgPool(url);
  return reportPool;
}

function isPermissionDeniedError(err: unknown): boolean {
  if (err instanceof PersonIdentityError && err.code === "PERMISSION_DENIED") {
    return true;
  }
  if (err instanceof OrgUnitError && err.code === "PERMISSION_DENIED") {
    return true;
  }
  if (
    err instanceof HeadcountApprovalError &&
    err.code === "PERMISSION_DENIED"
  ) {
    return true;
  }
  return false;
}

async function softHasOrganizationRead(accountId: string): Promise<boolean> {
  try {
    await assertActorHasOrganizationRead(accountId);
    return true;
  } catch (err) {
    if (isPermissionDeniedError(err)) return false;
    throw err;
  }
}

async function softHasHeadcountApprovalRead(
  accountId: string,
): Promise<boolean> {
  try {
    await assertActorHasHeadcountApprovalRead(accountId, getPersonDb());
    return true;
  } catch (err) {
    if (isPermissionDeniedError(err)) return false;
    throw err;
  }
}

function mapReportError(err: unknown): never {
  if (err instanceof PersonIdentityError) {
    throw new TRPCError({
      code: err.code === "PERMISSION_DENIED" ? "FORBIDDEN" : "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof OrgUnitError) {
    throw new TRPCError({
      code: err.code === "PERMISSION_DENIED" ? "FORBIDDEN" : "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof HeadcountApprovalError) {
    throw new TRPCError({
      code: err.code === "PERMISSION_DENIED" ? "FORBIDDEN" : "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof TRPCError) throw err;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: operationalCopy.reportLoadError,
  });
}

export type ReportCatalogueEntry = {
  key: LaunchReportKey;
  titleFa: string;
};

export type ReportCatalogueResponse = {
  reports: ReportCatalogueEntry[];
  populationAuthzMode: "fixture-fail-closed" | "uuid-registry";
  populationDisclosureFa: string | null;
};

export type ReportRunResponse = ReportRunResult & {
  populationAuthzMode: "fixture-fail-closed" | "uuid-registry";
  populationDisclosureFa: string | null;
  evaluationMode: "current" | "as_of";
  resultSemantics: "effective" | "planned";
  filter: {
    reportKey: LaunchReportKey;
    teamId?: string;
    asOf: string;
    rangeStart: string;
    rangeEnd: string;
  };
  /** Export affordance is stub until Story 6.5 — never claim FR-41 done. */
  exportAvailable: false;
};

function catalogueForCaps(caps: {
  hasOrganizationRead: boolean;
  hasHeadcountApprovalRead: boolean;
  hasCompensationRead: boolean;
}): ReportCatalogueEntry[] {
  requireLaunchReportCatalogue();
  return LAUNCH_REPORT_DEFINITIONS.filter((d) => {
    if (d.requiresCompensationRead && !caps.hasCompensationRead) return false;
    if (d.requiresOrganizationRead && !caps.hasOrganizationRead) return false;
    if (d.requiresHeadcountApprovalRead && !caps.hasHeadcountApprovalRead) {
      return false;
    }
    return true;
  }).map((d) => ({ key: d.key, titleFa: d.titleFa }));
}

export const reportRouter = createTRPCRouter({
  /**
   * Soft-permission catalogue — omit keys the actor cannot run (no disabled theater).
   */
  catalogue: governedProcedure
    .meta({
      permission: PERSON_READ_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "report.catalogue",
      sensitive: false,
      allowClientTemporal: true,
    })
    .query(async ({ ctx }): Promise<ReportCatalogueResponse> => {
      try {
        await assertActorHasPersonRead(ctx.session.accountId);
        const { mode, disclosureFa } =
          await resolvePersonnelPopulationRegistry();
        const hasOrganizationRead = await softHasOrganizationRead(
          ctx.session.accountId,
        );
        const hasHeadcountApprovalRead = await softHasHeadcountApprovalRead(
          ctx.session.accountId,
        );
        const hasCompensationRead = await actorHasCompensationRead(
          ctx.session.accountId,
        );
        return {
          reports: catalogueForCaps({
            hasOrganizationRead,
            hasHeadcountApprovalRead,
            hasCompensationRead,
          }),
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
        };
      } catch (err) {
        mapReportError(err);
      }
    }),

  /**
   * Single report run — channel `report` via runGovernedRetrieval.
   * allowClientTemporal: true for as-of / evaluationMode.
   */
  run: governedProcedure
    .meta({
      permission: PERSON_READ_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "report.run",
      sensitive: false,
      allowClientTemporal: true,
    })
    .input(reportFilterSchema)
    .query(async ({ ctx, input }): Promise<ReportRunResponse> => {
      try {
        await assertActorHasPersonRead(ctx.session.accountId);

        if (ctx.evaluationMode === "as_of" && !ctx.asOfDate?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: MSG_ASOF_REQUIRED_FA,
          });
        }

        const reportKey = input.reportKey as LaunchReportKey;

        const asOf =
          ctx.evaluationMode === "as_of" && ctx.asOfDate
            ? ctx.asOfDate.trim()
            : currentAsOfDate();

        const { registry, mode, disclosureFa } =
          await resolvePersonnelPopulationRegistry();

        const retrieval = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          channel: "report",
          asOfDate: asOf,
          dataCategory: PERSON_DATA_CATEGORY,
          correlationId: ctx.correlationId,
          purpose: `report.run:${reportKey}`,
          organizationalScope:
            ctx.session.organizationalScopeCodes[0] ?? "org:selfcheck",
          populationRegistry: registry,
        });

        const outcome = retrieval.payload.outcome;
        if (
          outcome !== "allowed" &&
          outcome !== "empty" &&
          outcome !== "suppressed"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              ("messageFa" in retrieval.payload
                ? retrieval.payload.messageFa
                : undefined) ?? operationalCopy.accessDeniedTitle,
          });
        }

        const hasOrganizationRead = await softHasOrganizationRead(
          ctx.session.accountId,
        );
        const hasHeadcountApprovalRead = await softHasHeadcountApprovalRead(
          ctx.session.accountId,
        );
        const hasCompensationRead = await actorHasCompensationRead(
          ctx.session.accountId,
        );

        // Soft-omit: do not run forbidden keys (no disabled theater payload).
        const visible = catalogueForCaps({
          hasOrganizationRead,
          hasHeadcountApprovalRead,
          hasCompensationRead,
        });
        if (!visible.some((r) => r.key === reportKey)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: operationalCopy.accessDeniedTitle,
          });
        }

        const suppressedMessageFa =
          outcome === "suppressed"
            ? retrieval.payload.messageFa || operationalCopy.suppressedCohort
            : operationalCopy.suppressedCohort;

        const run = await assembleReportRun({
          reportKey,
          subjectIds: retrieval.subjectIds,
          retrievalOutcome: outcome,
          suppressedMessageFa,
          emptyMessageFa: operationalCopy.emptyReportScope,
          filter: {
            asOf,
            evaluationMode: ctx.evaluationMode,
            teamId: input.teamId,
            rangeStart: input.rangeStart?.trim() || undefined,
            rangeEnd: input.rangeEnd?.trim() || undefined,
          },
          caps: {
            hasOrganizationRead,
            hasHeadcountApprovalRead,
            hasCompensationRead,
          },
          eventDb: getReportPool(),
        });

        return {
          ...run,
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
          evaluationMode: ctx.evaluationMode,
          resultSemantics: ctx.resultSemantics,
          filter: {
            reportKey,
            teamId: input.teamId,
            asOf,
            rangeStart: input.rangeStart?.trim() || "",
            rangeEnd: input.rangeEnd?.trim() || "",
          },
          exportAvailable: false,
        };
      } catch (err) {
        mapReportError(err);
      }
    }),
});
