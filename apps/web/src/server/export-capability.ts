/**
 * Export capability helpers shared by report / personnel / export routers.
 * Kept separate to avoid circular imports (Story 6.5).
 */
import { getPersonDb } from "@divan/person-employment";
import {
  PERSON_EXPORT_PERMISSION,
  REPORT_EXPORT_PERMISSION,
  computeExportSnapshotHash,
  type ExportFieldDef,
} from "@divan/reporting";

export async function actorHoldsExportPermission(
  accountId: string,
  permission: string,
): Promise<boolean> {
  const db = getPersonDb();
  const rows = await db.accountAccessRole.findMany({
    where: { accountId },
    include: {
      accessRole: { include: { permissionSet: true } },
    },
  });
  return rows.some((row) =>
    (row.accessRole.permissionSet?.permissions ?? []).includes(permission),
  );
}

export async function softHasReportExport(
  accountId: string,
): Promise<boolean> {
  return actorHoldsExportPermission(accountId, REPORT_EXPORT_PERMISSION);
}

export async function softHasPersonExport(
  accountId: string,
): Promise<boolean> {
  return actorHoldsExportPermission(accountId, PERSON_EXPORT_PERMISSION);
}

export function computeReportExportSnapshotHash(input: {
  reportKey: string;
  teamId?: string | null;
  asOf: string;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  evaluationMode: string;
  fieldIds: readonly string[];
}): string {
  return computeExportSnapshotHash({
    sourceSurface: "report",
    sourceKey: input.reportKey,
    filters: {
      reportKey: input.reportKey,
      teamId: input.teamId ?? null,
      asOf: input.asOf,
      rangeStart: input.rangeStart ?? null,
      rangeEnd: input.rangeEnd ?? null,
      evaluationMode: input.evaluationMode,
    },
    fieldIds: input.fieldIds,
    asOf: input.asOf,
  });
}

export function computePersonnelExportSnapshotHash(input: {
  normalizedQuery?: string | null;
  asOf: string;
  fieldIds: readonly string[];
  /** Story 9.7 — include team reconcile filter in export identity. */
  teamId?: string | null;
}): string {
  return computeExportSnapshotHash({
    sourceSurface: "personnel_list",
    sourceKey: null,
    filters: {
      normalizedQuery: input.normalizedQuery ?? null,
      asOf: input.asOf,
      fieldIds: [...input.fieldIds],
      teamId: input.teamId?.trim() || null,
    },
    fieldIds: input.fieldIds,
    asOf: input.asOf,
  });
}

export const PERSONNEL_EXPORT_FIELDS: ExportFieldDef[] = [
  {
    id: "personnelCode",
    headerFa: "کد پرسنلی",
    dataCategory: "identity.person",
  },
  { id: "givenName", headerFa: "نام", dataCategory: "identity.person" },
  {
    id: "familyName",
    headerFa: "نام خانوادگی",
    dataCategory: "identity.person",
  },
  { id: "team", headerFa: "تیم", dataCategory: "identity.person" },
  { id: "jobTitle", headerFa: "عنوان شغل", dataCategory: "identity.person" },
  { id: "role", headerFa: "نقش سازمانی", dataCategory: "identity.person" },
  {
    id: "compensation",
    headerFa: "جبران خدمات",
    dataCategory: "compensation",
  },
];
