/**
 * Core launch dashboard governed router (Story 5.4 / FR-35).
 * Pipeline: authorize → PopulationPort ∩ InferenceBulk (channel dashboard)
 * → reporting assembleDashboardSnapshot → payload.
 *
 * No Prisma in web; no parallel metric SoT.
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
  assertActorHasOrganizationRead,
  assertActorHasPersonRead,
  getPersonDb,
} from "@divan/person-employment";
import {
  assembleDashboardSnapshot,
  type DashboardSnapshotResult,
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
const MSG_RANGE_INVALID_FA = "بازه روند نامعتبر است.";
const MSG_DB_REQUIRED_FA =
  "پیکربندی پایگاه داده برای داشبورد موجود نیست.";

/** Shared filter object — one client state fed to snapshot so cards stay in sync. */
export const dashboardFilterSchema = z
  .object({
    teamId: z.string().uuid().optional(),
    evaluationMode: z.enum(["current", "as_of"]).optional(),
    asOfDate: z.string().optional(),
    trendRangeStart: z
      .string()
      .min(1)
      .superRefine((val, ctx) => {
        const parsed = parseDateOnly(val);
        if (!parsed.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: MSG_RANGE_INVALID_FA,
          });
        }
      }),
    trendRangeEnd: z
      .string()
      .min(1)
      .superRefine((val, ctx) => {
        const parsed = parseDateOnly(val);
        if (!parsed.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: MSG_RANGE_INVALID_FA,
          });
        }
      }),
    trendGranularity: z.enum(["daily", "monthly"]).default("monthly"),
  })
  .superRefine((val, ctx) => {
    if (val.trendRangeStart > val.trendRangeEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG_RANGE_INVALID_FA,
        path: ["trendRangeEnd"],
      });
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

export type DashboardFilterInput = z.infer<typeof dashboardFilterSchema>;

let dashboardPool: Pool | null = null;

function getDashboardPool(): Pool {
  if (dashboardPool) return dashboardPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  dashboardPool = getSharedPgPool(url);
  return dashboardPool;
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

function mapDashboardError(err: unknown): never {
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
    message: operationalCopy.dashboardLoadError,
  });
}

export type DashboardSnapshotResponse = DashboardSnapshotResult & {
  populationAuthzMode: "fixture-fail-closed" | "uuid-registry";
  populationDisclosureFa: string | null;
  evaluationMode: "current" | "as_of";
  resultSemantics: "effective" | "planned";
  filter: {
    teamId?: string;
    asOf: string;
    trendRangeStart: string;
    trendRangeEnd: string;
    trendGranularity: "daily" | "monthly";
  };
};

export const dashboardRouter = createTRPCRouter({
  /**
   * Single snapshot for synchronized metric cards (shared filter identity).
   * allowClientTemporal: true for as-of / evaluationMode.
   */
  snapshot: governedProcedure
    .meta({
      permission: PERSON_READ_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "dashboard.snapshot",
      sensitive: false,
      allowClientTemporal: true,
    })
    .input(dashboardFilterSchema)
    .query(async ({ ctx, input }): Promise<DashboardSnapshotResponse> => {
      try {
        await assertActorHasPersonRead(ctx.session.accountId);

        if (ctx.evaluationMode === "as_of" && !ctx.asOfDate?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: MSG_ASOF_REQUIRED_FA,
          });
        }

        const asOf =
          ctx.evaluationMode === "as_of" && ctx.asOfDate
            ? ctx.asOfDate
            : currentAsOfDate();

        const { registry, mode, disclosureFa } =
          await resolvePersonnelPopulationRegistry();

        const retrieval = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          channel: "dashboard",
          asOfDate: asOf,
          dataCategory: PERSON_DATA_CATEGORY,
          correlationId: ctx.correlationId,
          purpose: "dashboard.snapshot",
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

        const suppressedMessageFa =
          outcome === "suppressed"
            ? retrieval.payload.messageFa || operationalCopy.suppressedCohort
            : operationalCopy.suppressedCohort;

        const snapshot = await assembleDashboardSnapshot({
          subjectIds: retrieval.subjectIds,
          retrievalOutcome: outcome,
          suppressedMessageFa,
          emptyMessageFa: operationalCopy.emptyDashboardScope,
          filter: {
            asOf,
            teamId: input.teamId,
            trendRangeStart: input.trendRangeStart,
            trendRangeEnd: input.trendRangeEnd,
            trendGranularity: input.trendGranularity,
          },
          caps: {
            hasOrganizationRead,
            hasHeadcountApprovalRead,
          },
          eventDb: getDashboardPool(),
        });

        return {
          ...snapshot,
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
          evaluationMode: ctx.evaluationMode,
          resultSemantics: ctx.resultSemantics,
          filter: {
            teamId: input.teamId,
            asOf,
            trendRangeStart: input.trendRangeStart,
            trendRangeEnd: input.trendRangeEnd,
            trendGranularity: input.trendGranularity,
          },
        };
      } catch (err) {
        mapDashboardError(err);
      }
    }),
});
