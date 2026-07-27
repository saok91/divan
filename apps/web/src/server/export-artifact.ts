/**
 * Governed export tRPC procedures (Story 6.5 / FR-41 / FR-52).
 * Thin web: domain in @divan/reporting; reauth via identity-access hook.
 */
import {
  DEV_DEMO_CATEGORIES,
  DataLifecycleError,
  loadCategoryRegistry,
} from "@divan/audit-envelope";
import { getSharedPgPool, type Pool } from "@divan/db";
import {
  reauthorizeForQueuedOrArtifactWork,
  currentAsOfDate,
} from "@divan/identity-access";
import {
  PERSON_DATA_CATEGORY,
  actorHasCompensationRead,
  getPersonDb,
} from "@divan/person-employment";
import {
  CUSTODY_BOUNDARY_FA,
  ExportError,
  EXPORT_RETRIEVE_PERMISSION,
  PERSON_EXPORT_PERMISSION,
  REPORT_EXPORT_PERMISSION,
  assembleReportRun,
  createExportArtifact,
  disposeExportArtifact,
  downloadExportArtifact,
  getExportArtifactById,
  panelDtoFromArtifact,
  revokeExportArtifact,
  type ExportFieldDef,
  type ExportFormat,
  type LaunchReportKey,
} from "@divan/reporting";
import {
  HeadcountApprovalError,
  assertActorHasHeadcountApprovalRead,
} from "@divan/headcount";
import {
  OrgUnitError,
  PersonIdentityError,
  assertActorHasOrganizationRead,
} from "@divan/person-employment";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { operationalCopy } from "@/lib/operational-copy";

import {
  PERSONNEL_EXPORT_FIELDS,
  actorHoldsExportPermission,
  softHasPersonExport,
  softHasReportExport,
} from "./export-capability";
import {
  resolvePersonnelPopulationRegistry,
  runPersonnelScopedSearch,
} from "./personnel-scoped-search";
import { runGovernedRetrieval } from "./retrieval-control";
import { reportFilterSchema } from "./report";
import { createTRPCRouter, governedProcedure } from "./trpc";

const MSG_DB_REQUIRED_FA =
  "پیکربندی پایگاه داده برای خروجی موجود نیست.";

let exportPool: Pool | null = null;

function getExportPool(): Pool {
  if (exportPool) return exportPool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: MSG_DB_REQUIRED_FA,
    });
  }
  exportPool = getSharedPgPool(url);
  return exportPool;
}

function mapExportError(err: unknown): never {
  if (err instanceof DataLifecycleError) {
    throw new TRPCError({
      code:
        err.code === "DISPOSAL_BLOCKED_BY_HOLD" ||
        err.code === "LEGAL_HOLD_ACTIVE"
          ? "BAD_REQUEST"
          : err.code === "LIFECYCLE_DENIED"
            ? "FORBIDDEN"
            : "BAD_REQUEST",
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof ExportError) {
    const code =
      err.code === "EXPORT_DENIED" ||
      err.code === "REAUTH_FAILED" ||
      err.code === "SENSITIVE_EXPORT_DENIED"
        ? "FORBIDDEN"
        : err.code === "ARTIFACT_NOT_FOUND"
          ? "NOT_FOUND"
          : "BAD_REQUEST";
    throw new TRPCError({
      code,
      message: err.messageFa,
      cause: err,
    });
  }
  if (err instanceof PersonIdentityError || err instanceof OrgUnitError) {
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
    message: operationalCopy.exportLoadError,
  });
}

function categoryRegistry() {
  try {
    return loadCategoryRegistry();
  } catch {
    return DEV_DEMO_CATEGORIES;
  }
}

async function syncHoldsCategoryExport(
  accountId: string,
  categoryIds: readonly string[],
): Promise<(categoryId: string) => boolean> {
  const allowed = new Set<string>();
  for (const id of categoryIds) {
    const key = `${id}.export`;
    if (await actorHoldsExportPermission(accountId, key)) {
      allowed.add(id);
      continue;
    }
    if (
      id === "demo.sensitive_hr" &&
      (await actorHoldsExportPermission(accountId, "demo.sensitive_hr.export"))
    ) {
      allowed.add(id);
    }
  }
  return (categoryId: string) => allowed.has(categoryId);
}

function makeReauth(accountId: string, actorScopeCodes: string[]) {
  return (input: {
    accountId: string;
    populationChannel: "export";
    objectIds?: string[];
    actorScopeCodes?: string[];
    asOfDate?: string;
  }) =>
    reauthorizeForQueuedOrArtifactWork({
      accountId: input.accountId || accountId,
      populationChannel: "export",
      objectIds: input.objectIds,
      actorScopeCodes: input.actorScopeCodes ?? actorScopeCodes,
      asOfDate: input.asOfDate,
    });
}

async function softHasOrganizationRead(accountId: string): Promise<boolean> {
  try {
    await assertActorHasOrganizationRead(accountId);
    return true;
  } catch (err) {
    if (err instanceof OrgUnitError && err.code === "PERMISSION_DENIED") {
      return false;
    }
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
    if (
      err instanceof HeadcountApprovalError &&
      err.code === "PERMISSION_DENIED"
    ) {
      return false;
    }
    throw err;
  }
}

function personnelRowsToExport(
  rows: Awaited<ReturnType<typeof runPersonnelScopedSearch>>["rows"],
  includeCompensation: boolean,
) {
  const fields = PERSONNEL_EXPORT_FIELDS.filter(
    (f) => includeCompensation || f.id !== "compensation",
  );
  const exportRows = rows.map((r) => ({
    id: r.id,
    cells: {
      personnelCode: r.personnelCode,
      givenName: r.givenName,
      familyName: r.familyName,
      team: r.team,
      jobTitle: r.jobTitle,
      role: r.role,
      ...(includeCompensation
        ? { compensation: r.compensationPermitted ? r.compensation : null }
        : {}),
    } as Record<string, string | number | null>,
  }));
  return { fields, exportRows };
}

export const exportArtifactRouter = createTRPCRouter({
  createFromReport: governedProcedure
    .meta({
      permission: REPORT_EXPORT_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "export.artifact.create_report",
      sensitive: true,
      allowClientTemporal: true,
    })
    .input(
      z.object({
        filter: reportFilterSchema,
        reviewedSnapshotHash: z.string().min(16),
        format: z.enum(["csv", "xlsx"]),
        purpose: z.string().min(1).max(200).optional(),
        /** Top-level temporal for governedProcedure (must not nest only under filter). */
        evaluationMode: z.enum(["current", "as_of"]).optional(),
        asOfDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasPerm = await softHasReportExport(ctx.session.accountId);
        if (!hasPerm) {
          throw new ExportError("EXPORT_DENIED", operationalCopy.exportDenied);
        }

        const pool = getExportPool();
        const asOf =
          ctx.evaluationMode === "as_of" && ctx.asOfDate
            ? ctx.asOfDate.trim()
            : currentAsOfDate();

        const reportKey = input.filter.reportKey as LaunchReportKey;
        const { registry, mode, disclosureFa } =
          await resolvePersonnelPopulationRegistry();

        const retrieval = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          channel: "export",
          asOfDate: asOf,
          dataCategory: PERSON_DATA_CATEGORY,
          correlationId: ctx.correlationId,
          purpose: `export.report:${reportKey}`,
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
            message: operationalCopy.accessDeniedTitle,
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

        const run = await assembleReportRun({
          reportKey,
          subjectIds: retrieval.subjectIds,
          retrievalOutcome: outcome,
          suppressedMessageFa: operationalCopy.suppressedCohort,
          emptyMessageFa: operationalCopy.emptyReportScope,
          filter: {
            asOf,
            evaluationMode: ctx.evaluationMode,
            teamId: input.filter.teamId,
            rangeStart: input.filter.rangeStart?.trim() || undefined,
            rangeEnd: input.filter.rangeEnd?.trim() || undefined,
          },
          caps: {
            hasOrganizationRead,
            hasHeadcountApprovalRead,
            hasCompensationRead,
          },
          eventDb: pool,
        });

        const permittedCols = run.columns.filter((c) => c.permitted !== false);
        const fields: ExportFieldDef[] = permittedCols.map((c) => ({
          id: c.id,
          headerFa: c.headerFa,
          dataCategory: c.dataCategory ?? null,
        }));

        const filtersSnapshot = {
          reportKey,
          teamId: input.filter.teamId ?? null,
          asOf,
          rangeStart: input.filter.rangeStart?.trim() || null,
          rangeEnd: input.filter.rangeEnd?.trim() || null,
          evaluationMode: ctx.evaluationMode,
        };

        const categoryIds = [
          ...new Set(
            fields
              .map((f) => f.dataCategory)
              .filter((x): x is string => Boolean(x)),
          ),
        ];
        const holds = await syncHoldsCategoryExport(
          ctx.session.accountId,
          categoryIds,
        );

        const created = await createExportArtifact(pool, {
          ownerAccountId: ctx.session.accountId,
          purpose: input.purpose?.trim() || `report:${reportKey}`,
          sourceSurface: "report",
          sourceKey: reportKey,
          filtersSnapshot,
          reviewedSnapshotHash: input.reviewedSnapshotHash,
          asOf,
          format: input.format as ExportFormat,
          fields,
          rows: run.rows.map((r) => ({ id: r.id, cells: r.cells })),
          categoryRegistry: categoryRegistry(),
          holdsCategoryExport: holds,
          reauth: makeReauth(
            ctx.session.accountId,
            ctx.session.organizationalScopeCodes,
          ),
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          objectIds: retrieval.subjectIds,
          correlationId: ctx.correlationId,
          populationAuthzMode: mode,
        });

        return {
          ...panelDtoFromArtifact(created.artifact, {
            omittedSensitiveIds: created.omittedSensitiveIds,
            custodyBoundaryFa: created.custodyBoundaryFa,
          }),
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
        };
      } catch (err) {
        mapExportError(err);
      }
    }),

  createFromPersonnel: governedProcedure
    .meta({
      permission: PERSON_EXPORT_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "export.artifact.create_personnel",
      sensitive: true,
      allowClientTemporal: true,
    })
    .input(
      z.object({
        reviewedSnapshotHash: z.string().min(16),
        format: z.enum(["csv", "xlsx"]),
        purpose: z.string().min(1).max(200).optional(),
        normalizedQuery: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasPerm = await softHasPersonExport(ctx.session.accountId);
        if (!hasPerm) {
          throw new ExportError("EXPORT_DENIED", operationalCopy.exportDenied);
        }

        const pool = getExportPool();
        const asOf =
          ctx.evaluationMode === "as_of" && ctx.asOfDate
            ? ctx.asOfDate.trim()
            : currentAsOfDate();

        const search = await runPersonnelScopedSearch({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
          channel: "list",
          normalizedQuery: input.normalizedQuery,
        });

        if (search.outcome !== "allowed") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: search.messageFa || operationalCopy.accessDeniedTitle,
          });
        }

        // Export channel InferenceBulk — separate from list channel evidence.
        const { registry, mode, disclosureFa } =
          await resolvePersonnelPopulationRegistry();
        const retrieval = await runGovernedRetrieval({
          actorAccountId: ctx.session.accountId,
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          channel: "export",
          asOfDate: asOf,
          dataCategory: PERSON_DATA_CATEGORY,
          correlationId: ctx.correlationId,
          purpose: "export.personnel_list",
          organizationalScope:
            ctx.session.organizationalScopeCodes[0] ?? "org:selfcheck",
          populationRegistry: registry,
        });
        if (
          retrieval.payload.outcome !== "allowed" &&
          retrieval.payload.outcome !== "empty"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: operationalCopy.accessDeniedTitle,
          });
        }

        const allowed = new Set(retrieval.subjectIds);
        const scopedRows = search.rows.filter((r) => allowed.has(r.id));
        const { fields, exportRows } = personnelRowsToExport(
          scopedRows,
          search.hasCompensationRead,
        );

        const filtersSnapshot = {
          normalizedQuery: input.normalizedQuery ?? null,
          asOf,
          fieldIds: fields.map((f) => f.id),
        };

        const categoryIds = [
          ...new Set(
            fields
              .map((f) => f.dataCategory)
              .filter((x): x is string => Boolean(x)),
          ),
        ];

        const created = await createExportArtifact(pool, {
          ownerAccountId: ctx.session.accountId,
          purpose: input.purpose?.trim() || "personnel_list",
          sourceSurface: "personnel_list",
          sourceKey: null,
          filtersSnapshot,
          reviewedSnapshotHash: input.reviewedSnapshotHash,
          asOf,
          format: input.format as ExportFormat,
          fields,
          rows: exportRows,
          categoryRegistry: categoryRegistry(),
          holdsCategoryExport: await syncHoldsCategoryExport(
            ctx.session.accountId,
            categoryIds,
          ),
          reauth: makeReauth(
            ctx.session.accountId,
            ctx.session.organizationalScopeCodes,
          ),
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          objectIds: retrieval.subjectIds,
          correlationId: ctx.correlationId,
          populationAuthzMode: mode,
        });

        return {
          ...panelDtoFromArtifact(created.artifact, {
            omittedSensitiveIds: created.omittedSensitiveIds,
            custodyBoundaryFa: created.custodyBoundaryFa,
          }),
          populationAuthzMode: mode,
          populationDisclosureFa: disclosureFa,
        };
      } catch (err) {
        mapExportError(err);
      }
    }),

  getArtifact: governedProcedure
    .meta({
      permission: EXPORT_RETRIEVE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "export.artifact.get",
      sensitive: true,
    })
    .input(z.object({ artifactId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const hasReport = await softHasReportExport(ctx.session.accountId);
        const hasPerson = await softHasPersonExport(ctx.session.accountId);
        if (!hasReport && !hasPerson) {
          throw new ExportError("EXPORT_DENIED", operationalCopy.exportDenied);
        }
        const artifact = await getExportArtifactById(
          getExportPool(),
          input.artifactId,
        );
        if (!artifact || artifact.ownerAccountId !== ctx.session.accountId) {
          throw new ExportError(
            "ARTIFACT_NOT_FOUND",
            operationalCopy.exportArtifactNotFound,
          );
        }
        return panelDtoFromArtifact(artifact, {
          custodyBoundaryFa: CUSTODY_BOUNDARY_FA,
        });
      } catch (err) {
        mapExportError(err);
      }
    }),

  download: governedProcedure
    .meta({
      permission: EXPORT_RETRIEVE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "export.artifact.download",
      sensitive: true,
    })
    .input(
      z.object({
        artifactId: z.string().uuid(),
        recipient: z.string().trim().min(1).max(200),
        destinationClass: z
          .enum(["local_download", "shared_drive", "email", "other"])
          .default("local_download"),
        custodyAck: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasReport = await softHasReportExport(ctx.session.accountId);
        const hasPerson = await softHasPersonExport(ctx.session.accountId);
        if (!hasReport && !hasPerson) {
          throw new ExportError("EXPORT_DENIED", operationalCopy.exportDenied);
        }
        const result = await downloadExportArtifact(getExportPool(), {
          artifactId: input.artifactId,
          retrieverAccountId: ctx.session.accountId,
          recipient: input.recipient.trim(),
          destinationClass: input.destinationClass,
          custodyAck: input.custodyAck,
          reauth: makeReauth(
            ctx.session.accountId,
            ctx.session.organizationalScopeCodes,
          ),
          actorScopeCodes: ctx.session.organizationalScopeCodes,
          correlationId: ctx.correlationId,
        });
        return {
          artifactId: result.artifact.id,
          filename: result.contentFilename,
          contentType: result.contentType,
          contentBase64: result.contentBytes.toString("base64"),
          custodyBoundaryFa: result.custodyBoundaryFa,
          retrievalId: result.retrievalId,
          classificationFa: result.artifact.classificationFa,
          handlingFa: result.artifact.handlingFa,
          expiresAt: result.artifact.expiresAt,
        };
      } catch (err) {
        mapExportError(err);
      }
    }),

  revoke: governedProcedure
    .meta({
      permission: EXPORT_RETRIEVE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "export.artifact.revoke",
      sensitive: true,
    })
    .input(
      z.object({
        artifactId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasReport = await softHasReportExport(ctx.session.accountId);
        const hasPerson = await softHasPersonExport(ctx.session.accountId);
        if (!hasReport && !hasPerson) {
          throw new ExportError("EXPORT_DENIED", operationalCopy.exportDenied);
        }
        const existing = await getExportArtifactById(
          getExportPool(),
          input.artifactId,
        );
        if (!existing || existing.ownerAccountId !== ctx.session.accountId) {
          throw new ExportError(
            "ARTIFACT_NOT_FOUND",
            operationalCopy.exportArtifactNotFound,
          );
        }
        const updated = await revokeExportArtifact(getExportPool(), {
          artifactId: input.artifactId,
          actorAccountId: ctx.session.accountId,
          reason: input.reason,
          correlationId: ctx.correlationId,
        });
        return panelDtoFromArtifact(updated);
      } catch (err) {
        mapExportError(err);
      }
    }),

  dispose: governedProcedure
    .meta({
      permission: EXPORT_RETRIEVE_PERMISSION,
      dataCategory: PERSON_DATA_CATEGORY,
      action: "export",
      organizationalScope: "org:selfcheck",
      operation: "export.artifact.dispose",
      sensitive: true,
    })
    .input(
      z.object({
        artifactId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasReport = await softHasReportExport(ctx.session.accountId);
        const hasPerson = await softHasPersonExport(ctx.session.accountId);
        if (!hasReport && !hasPerson) {
          throw new ExportError("EXPORT_DENIED", operationalCopy.exportDenied);
        }
        const existing = await getExportArtifactById(
          getExportPool(),
          input.artifactId,
        );
        if (!existing || existing.ownerAccountId !== ctx.session.accountId) {
          throw new ExportError(
            "ARTIFACT_NOT_FOUND",
            operationalCopy.exportArtifactNotFound,
          );
        }
        const updated = await disposeExportArtifact(getExportPool(), {
          artifactId: input.artifactId,
          actorAccountId: ctx.session.accountId,
          reason: input.reason,
          correlationId: ctx.correlationId,
        });
        return panelDtoFromArtifact(updated);
      } catch (err) {
        mapExportError(err);
      }
    }),
});
