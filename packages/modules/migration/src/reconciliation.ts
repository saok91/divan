/**
 * Migration reconciliation domain (Story 6.4 / FR-40 / LG-1).
 *
 * Owner-attested controls vs computed observations; dual signatures;
 * production cutover gate. AR-MIGRATION tolerances pending — exact match
 * when control present; missing required control = fail closed.
 *
 * source=migration remains audit metadata only — never an authz unlock.
 */

import { createHash, randomUUID } from "node:crypto";

import { isWaiverExpired } from "@divan/audit-envelope";
import type { Pool, PoolClient } from "@divan/db";

import { getLatestBatchEvidence } from "./batch-evidence";
import { MigrationError, type MigrationErrorCode } from "./errors";
import {
  PROJECTOR_GAP_DOMAINS,
  RECONCILIATION_DOMAIN_KEYS,
  RECONCILIATION_DOMAIN_LABELS_FA,
  REQUIRED_PRODUCTION_DOMAINS,
  domainIntegrityClass,
  isReconciliationDomainKey,
  type ReconciliationDomainKey,
} from "./reconciliation-domains";
import {
  clearSignaturesForRun,
  getReconciliationRun,
  insertReconciliationRun,
  insertSignature,
  listReconciliationRunsForBatch,
  replaceDiscrepancies,
  updateDiscrepancyDisposition,
  updateRunStatus,
  upsertControl,
  upsertObservation,
  type DiscrepancyStatus,
  type JsonValue,
  type ReconciliationDiscrepancy,
  type ReconciliationRun,
  type ReconciliationTier,
  type SignatureRoleCode,
} from "./reconciliation-repo";
import {
  assertMigrationReconcilePermission,
  assertMigrationSignPermission,
  assertReconcileSignSegregation,
  type SodPermissionHolder,
} from "./sod";
import { getStagingBatch } from "./staging-repo";

type PgQueryable = Pool | PoolClient;

const UNAVAILABLE = "unavailable" as const;

function isUnavailableObservation(value: JsonValue): boolean {
  if (value == null) return false;
  if (typeof value === "object" && !Array.isArray(value)) {
    return (value as { status?: string }).status === UNAVAILABLE;
  }
  return false;
}

function assertRunMutable(run: ReconciliationRun): void {
  if (run.status === "rejected" || run.status === "superseded") {
    throw new MigrationError(
      "RECONCILIATION_STALE",
      "این اجرای تطبیق رد یا جایگزین شده و قابل تغییر نیست.",
    );
  }
}

function findDomainDisc(
  run: ReconciliationRun,
  domainKey: ReconciliationDomainKey,
): ReconciliationDiscrepancy | undefined {
  return run.discrepancies.find((d) => d.domainKey === domainKey);
}

/**
 * Required domain is production-ready when observation is available and either
 * matches attested control, or has a non-expired FR-55 waiver for the mismatch.
 * Unavailable always fails production (hard-block — waiver does not unlock).
 */
function assertRequiredDomainGate(
  run: ReconciliationRun,
  domainKey: ReconciliationDomainKey,
  mode: "production" | "sign-trial",
): { ok: false; code: string; messageFa: string } | null {
  const control = run.controls.find((c) => c.domainKey === domainKey);
  if (!control) {
    return {
      ok: false,
      code: "CONTROL_MISSING",
      messageFa: `کنترل تأییدشده برای دامنه «${RECONCILIATION_DOMAIN_LABELS_FA[domainKey]}» موجود نیست.`,
    };
  }
  const obs = run.observations.find((o) => o.domainKey === domainKey);
  if (!obs) {
    return {
      ok: false,
      code: "RECONCILIATION_INCOMPLETE",
      messageFa: `مشاهده دامنه «${RECONCILIATION_DOMAIN_LABELS_FA[domainKey]}» محاسبه نشده؛ ابتدا مقایسه را اجرا کنید.`,
    };
  }
  if (isUnavailableObservation(obs.observedValue)) {
    if (mode === "production") {
      return {
        ok: false,
        code: "RECONCILIATION_INCOMPLETE",
        messageFa: `مشاهده دامنه «${RECONCILIATION_DOMAIN_LABELS_FA[domainKey]}» در دسترس نیست؛ قطعه‌سازی تولید تا محاسبه واقعی یا اوراکل AR مسدود است.`,
      };
    }
    // Trial/final sign: FR-55 waiver may close unavailable for rehearsal only
    const disc = findDomainDisc(run, domainKey);
    if (
      !disc ||
      disc.status !== "waived" ||
      isWaiverExpired(disc.waiverExpiry)
    ) {
      return {
        ok: false,
        code: "RECONCILIATION_INCOMPLETE",
        messageFa: `مشاهده دامنه «${RECONCILIATION_DOMAIN_LABELS_FA[domainKey]}» در دسترس نیست و معافیت FR-۵۵ معتبر ندارد.`,
      };
    }
    return null;
  }
  if (valuesEqual(control.controlValue, obs.observedValue)) {
    return null;
  }
  const disc = findDomainDisc(run, domainKey);
  if (disc?.status === "open" || !disc) {
    return {
      ok: false,
      code: "CRITICAL_DEFECT_OPEN",
      messageFa: `مغایرت دامنه «${RECONCILIATION_DOMAIN_LABELS_FA[domainKey]}» باز است.`,
    };
  }
  if (disc.status !== "waived") {
    return {
      ok: false,
      code: "DISPOSITION_REQUIRED",
      messageFa: `مغایرت دامنه «${RECONCILIATION_DOMAIN_LABELS_FA[domainKey]}» بدون معافیت FR-۵۵ بسته نشده است.`,
    };
  }
  if (isWaiverExpired(disc.waiverExpiry)) {
    return {
      ok: false,
      code: "RECONCILIATION_STALE",
      messageFa: `معافیت دامنه «${RECONCILIATION_DOMAIN_LABELS_FA[domainKey]}» منقضی شده است.`,
    };
  }
  return null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

/**
 * Content-addressed hash over frozen controls + observations + dispositions.
 * Signatures bind to this hash; control edits invalidate via clearSignatures.
 */
export function computeReconciliationEvidenceHash(
  run: ReconciliationRun,
): string {
  const payload = {
    runId: run.id,
    batchId: run.batchId,
    controls: run.controls
      .map((c) => ({
        domainKey: c.domainKey,
        controlValue: c.controlValue,
        attestedBy: c.attestedBy,
      }))
      .sort((a, b) => a.domainKey.localeCompare(b.domainKey)),
    observations: run.observations
      .map((o) => ({
        domainKey: o.domainKey,
        observedValue: o.observedValue,
      }))
      .sort((a, b) => a.domainKey.localeCompare(b.domainKey)),
    discrepancies: run.discrepancies
      .map((d) => ({
        domainKey: d.domainKey,
        severity: d.severity,
        status: d.status,
        dispositionCode: d.dispositionCode,
        dispositionRationaleFa: d.dispositionRationaleFa,
        ownerAccountId: d.ownerAccountId,
        waiverIndependentApprover: d.waiverIndependentApprover,
      }))
      .sort((a, b) => a.domainKey.localeCompare(b.domainKey)),
  };
  return createHash("sha256")
    .update(canonicalJson(payload), "utf8")
    .digest("hex");
}

function valuesEqual(a: JsonValue, b: JsonValue): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/**
 * Compute honest observations from batch evidence + staging.
 * Employment/Assignment/current_state may be unavailable (projector gap).
 */
export async function computeObservationsForBatch(
  db: PgQueryable,
  batchId: string,
): Promise<
  Array<{
    domainKey: ReconciliationDomainKey;
    observedValue: JsonValue;
    computationNotes: string | null;
  }>
> {
  const batch = await getStagingBatch(db, batchId);
  if (!batch) {
    throw new MigrationError(
      "STAGING_NOT_FOUND",
      "دسته واردسازی برای محاسبه مشاهدات یافت نشد.",
    );
  }
  const evidence = await getLatestBatchEvidence(db, batchId);
  const stagingRowCount = batch.rows.length;
  const personCodes = batch.rows
    .map((r) => (r.values.personnelCode ?? "").trim())
    .filter(Boolean);
  const uniqueCodes = new Set(personCodes);
  const duplicateCount = personCodes.length - uniqueCodes.size;

  const personCount =
    evidence?.counts.createdPersonCount ?? uniqueCodes.size;
  const eventCount = evidence?.counts.createdEventCount ?? 0;

  const results: Array<{
    domainKey: ReconciliationDomainKey;
    observedValue: JsonValue;
    computationNotes: string | null;
  }> = [];

  for (const domainKey of RECONCILIATION_DOMAIN_KEYS) {
    if (PROJECTOR_GAP_DOMAINS.includes(domainKey)) {
      results.push({
        domainKey,
        observedValue: {
          status: UNAVAILABLE,
          reason: "baseline_employment_assignment_projector_gap",
        },
        computationNotes:
          "Honesty: BaselineRecorded projector → Employment/Assignment not yet implemented; count not invented.",
      });
      continue;
    }

    switch (domainKey) {
      case "person":
        results.push({
          domainKey,
          observedValue: { count: personCount },
          computationNotes: evidence
            ? "From batch evidence createdPersonCount"
            : "From staging unique personnel codes (no cutover evidence yet)",
        });
        break;
      case "personnel_event":
        results.push({
          domainKey,
          observedValue: { count: eventCount },
          computationNotes: evidence
            ? "From batch evidence createdEventCount"
            : "No cutover evidence — observed 0",
        });
        break;
      case "duplicates":
        results.push({
          domainKey,
          observedValue: { count: duplicateCount },
          computationNotes: "Staging personnel-code duplicate count",
        });
        break;
      case "orphans":
        // AD-6: orphan detection not yet honest — do not invent zeros.
        results.push({
          domainKey,
          observedValue: {
            status: UNAVAILABLE,
            reason: "ad6_orphan_detection_pending",
          },
          computationNotes:
            "Honesty: AD-6 Person orphan hardening remains open — count not invented",
        });
        break;
      case "team_totals":
        results.push({
          domainKey,
          observedValue: { stagingRowCount },
          computationNotes: "Staging row count as team/membership proxy",
        });
        break;
      case "reference_mappings":
        results.push({
          domainKey,
          observedValue: {
            status: "computed",
            stagingRowCount,
          },
          computationNotes: "Reference mapping completeness deferred to attested control",
        });
        break;
      case "headcount":
        results.push({
          domainKey,
          observedValue: {
            status: UNAVAILABLE,
            reason: "headcount_oracle_pending_AR_MIGRATION",
          },
          computationNotes:
            "AR-MIGRATION headcount approved/used/reserved oracle pending — honesty unavailable",
        });
        break;
      case "approved_control_totals":
        results.push({
          domainKey,
          observedValue: {
            personCount,
            eventCount,
            stagingRowCount,
            duplicateCount,
          },
          computationNotes: "Aggregate package totals from evidence/staging",
        });
        break;
      default:
        results.push({
          domainKey,
          observedValue: { status: UNAVAILABLE, reason: "unhandled_domain" },
          computationNotes: null,
        });
    }
  }

  return results;
}

export async function createReconciliationRun(
  pool: Pool,
  opts: {
    batchId: string;
    createdBy: string;
    permissionHolder: SodPermissionHolder;
    tier?: ReconciliationTier;
    sourceExtractVersion?: string | null;
    notes?: string | null;
  },
): Promise<ReconciliationRun> {
  await assertMigrationReconcilePermission(opts.permissionHolder);
  const batch = await getStagingBatch(pool, opts.batchId);
  if (!batch) {
    throw new MigrationError(
      "STAGING_NOT_FOUND",
      "دسته واردسازی برای ایجاد اجرای تطبیق یافت نشد.",
    );
  }
  if (
    batch.status !== "approved" &&
    batch.status !== "cutover-complete" &&
    batch.status !== "executing"
  ) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق فقط برای دسته تأییدشده یا پس از اجرای آزمایشی مجاز است.",
    );
  }

  const run = await insertReconciliationRun(pool, {
    batchId: opts.batchId,
    tier: opts.tier ?? "trial",
    correlationId: batch.correlationId,
    createdBy: opts.createdBy,
    sourceExtractVersion: opts.sourceExtractVersion,
    notes: opts.notes,
  });
  return run;
}

export async function upsertReconciliationControls(
  pool: Pool,
  opts: {
    runId: string;
    attestedBy: string;
    permissionHolder: SodPermissionHolder;
    controls: Array<{
      domainKey: string;
      controlValue: JsonValue;
      labelFa?: string;
    }>;
  },
): Promise<ReconciliationRun> {
  await assertMigrationReconcilePermission(opts.permissionHolder);
  const existing = await getReconciliationRun(pool, opts.runId);
  if (!existing) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق یافت نشد.",
    );
  }
  assertRunMutable(existing);

  for (const c of opts.controls) {
    if (!isReconciliationDomainKey(c.domainKey)) {
      throw new MigrationError(
        "VALIDATION_FAILED",
        `دامنه تطبیق ناشناخته: ${c.domainKey}`,
      );
    }
    await upsertControl(pool, {
      runId: opts.runId,
      domainKey: c.domainKey,
      controlValue: c.controlValue,
      attestedBy: opts.attestedBy,
      labelFa: c.labelFa ?? RECONCILIATION_DOMAIN_LABELS_FA[c.domainKey],
    });
  }

  await updateRunStatus(pool, {
    runId: opts.runId,
    status: "in-progress",
  });

  const run = await getReconciliationRun(pool, opts.runId);
  if (!run) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق پس از ثبت کنترل یافت نشد.",
    );
  }
  return run;
}

export async function runReconciliationCompare(
  pool: Pool,
  opts: {
    runId: string;
    permissionHolder: SodPermissionHolder;
  },
): Promise<ReconciliationRun> {
  await assertMigrationReconcilePermission(opts.permissionHolder);
  const existing = await getReconciliationRun(pool, opts.runId);
  if (!existing) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق برای مقایسه یافت نشد.",
    );
  }
  assertRunMutable(existing);

  const observations = await computeObservationsForBatch(
    pool,
    existing.batchId,
  );
  for (const obs of observations) {
    await upsertObservation(pool, {
      runId: opts.runId,
      domainKey: obs.domainKey,
      observedValue: obs.observedValue,
      computationNotes: obs.computationNotes,
    });
  }

  const refreshed = await getReconciliationRun(pool, opts.runId);
  if (!refreshed) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق پس از مشاهده یافت نشد.",
    );
  }

  const controlByDomain = new Map(
    refreshed.controls.map((c) => [c.domainKey, c]),
  );
  const obsByDomain = new Map(
    refreshed.observations.map((o) => [o.domainKey, o]),
  );

  const discrepancyInputs: Array<{
    domainKey: ReconciliationDomainKey;
    severity: "critical" | "warning";
    integrityClass: ReturnType<typeof domainIntegrityClass>;
  }> = [];

  for (const domainKey of REQUIRED_PRODUCTION_DOMAINS) {
    const control = controlByDomain.get(domainKey);
    const obs = obsByDomain.get(domainKey);
    const integrity = domainIntegrityClass(domainKey);

    if (!control) {
      discrepancyInputs.push({
        domainKey,
        severity: "critical",
        integrityClass: integrity ?? "control_total",
      });
      continue;
    }

    if (!obs || isUnavailableObservation(obs.observedValue)) {
      discrepancyInputs.push({
        domainKey,
        severity: "critical",
        integrityClass: integrity ?? "temporal",
      });
      continue;
    }

    if (!valuesEqual(control.controlValue, obs.observedValue)) {
      discrepancyInputs.push({
        domainKey,
        severity: "critical",
        integrityClass: integrity ?? "control_total",
      });
    }
  }

  // Preserve closed dispositions when domain/severity unchanged
  const priorByDomain = new Map(
    refreshed.discrepancies.map((d) => [d.domainKey, d]),
  );
  await replaceDiscrepancies(
    pool,
    opts.runId,
    discrepancyInputs.map((d) => {
      const prior = priorByDomain.get(d.domainKey);
      const waiverComplete =
        prior?.status === "waived" &&
        Boolean(prior.waiverIndependentApprover?.trim()) &&
        Boolean(prior.waiverScope?.trim()) &&
        Boolean(prior.waiverRisk?.trim()) &&
        Boolean(prior.waiverCompensatingControl?.trim()) &&
        Boolean(prior.waiverExpiry?.trim()) &&
        !isWaiverExpired(prior.waiverExpiry);
      if (
        prior &&
        prior.severity === d.severity &&
        prior.status !== "open" &&
        (prior.status !== "waived" || waiverComplete)
      ) {
        return {
          ...d,
          status: prior.status,
          ownerAccountId: prior.ownerAccountId,
          ownerDisplay: prior.ownerDisplay,
        };
      }
      return d;
    }),
  );

  // Re-apply dispositions that were closed (replace wipes them)
  for (const d of discrepancyInputs) {
    const prior = priorByDomain.get(d.domainKey);
    const waiverComplete =
      prior?.status === "waived" &&
      Boolean(prior.waiverIndependentApprover?.trim()) &&
      Boolean(prior.waiverScope?.trim()) &&
      Boolean(prior.waiverRisk?.trim()) &&
      Boolean(prior.waiverCompensatingControl?.trim()) &&
      Boolean(prior.waiverExpiry?.trim()) &&
      !isWaiverExpired(prior.waiverExpiry);
    if (
      prior &&
      prior.severity === d.severity &&
      prior.status !== "open" &&
      prior.dispositionCode &&
      prior.dispositionRationaleFa &&
      prior.ownerAccountId &&
      prior.dispositionBy &&
      (prior.status !== "waived" || waiverComplete)
    ) {
      const afterReplace = await getReconciliationRun(pool, opts.runId);
      const fresh = afterReplace?.discrepancies.find(
        (x) => x.domainKey === d.domainKey,
      );
      if (fresh) {
        await updateDiscrepancyDisposition(pool, {
          discrepancyId: fresh.id,
          status: prior.status,
          ownerAccountId: prior.ownerAccountId,
          ownerDisplay: prior.ownerDisplay,
          dispositionCode: prior.dispositionCode,
          dispositionRationaleFa: prior.dispositionRationaleFa,
          dispositionBy: prior.dispositionBy,
          waiver: waiverComplete
            ? {
                independentApprover: prior.waiverIndependentApprover!,
                scope: prior.waiverScope!,
                risk: prior.waiverRisk!,
                compensatingControl: prior.waiverCompensatingControl!,
                expiry: prior.waiverExpiry!,
              }
            : null,
        });
      }
    }
  }

  await clearSignaturesForRun(pool, opts.runId);
  await updateRunStatus(pool, {
    runId: opts.runId,
    status: "in-progress",
  });

  const final = await getReconciliationRun(pool, opts.runId);
  if (!final) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق پس از مقایسه یافت نشد.",
    );
  }
  return final;
}

export async function setDiscrepancyDisposition(
  pool: Pool,
  opts: {
    discrepancyId: string;
    runId: string;
    permissionHolder: SodPermissionHolder;
    actorAccountId: string;
    actorDisplay?: string;
    status: Exclude<DiscrepancyStatus, "open">;
    dispositionCode: string;
    dispositionRationaleFa: string;
    ownerAccountId: string;
    ownerDisplay?: string;
    waiver?: {
      independentApprover: string;
      scope: string;
      risk: string;
      compensatingControl: string;
      expiry: string;
    } | null;
  },
): Promise<ReconciliationDiscrepancy> {
  await assertMigrationReconcilePermission(opts.permissionHolder);
  const run = await getReconciliationRun(pool, opts.runId);
  if (!run) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق یافت نشد.",
    );
  }
  assertRunMutable(run);
  const disc = run.discrepancies.find((d) => d.id === opts.discrepancyId);
  if (!disc) {
    throw new MigrationError(
      "DISPOSITION_REQUIRED",
      "مغایرت برای disposition یافت نشد.",
    );
  }
  if (!opts.ownerAccountId.trim()) {
    throw new MigrationError(
      "DISPOSITION_REQUIRED",
      "هر مغایرت باید مالک مشخص داشته باشد.",
    );
  }
  if (!opts.dispositionRationaleFa.trim()) {
    throw new MigrationError(
      "DISPOSITION_REQUIRED",
      "توجیه disposition الزامی است.",
    );
  }

  // Critical: only FR-55 waiver closes without re-compare match (no accepted/resolved shortcut)
  if (disc.severity === "critical" && opts.status !== "waived") {
    throw new MigrationError(
      "DISPOSITION_REQUIRED",
      "مغایرت بحرانی فقط با معافیت FR-۵۵ یا رفع مشاهده و مقایسهٔ مجدد بسته می‌شود؛ accepted/resolved مجاز نیست.",
    );
  }

  if (disc.severity === "critical" && opts.status === "waived") {
    const w = opts.waiver;
    if (
      !w?.independentApprover?.trim() ||
      !w.scope?.trim() ||
      !w.risk?.trim() ||
      !w.compensatingControl?.trim() ||
      !w.expiry?.trim()
    ) {
      throw new MigrationError(
        "DISPOSITION_REQUIRED",
        "معافیت مغایرت بحرانی نیازمند تأییدکننده مستقل، دامنه، ریسک، کنترل جبرانی و تاریخ انقضا است (FR-۵۵).",
      );
    }
    if (isWaiverExpired(w.expiry)) {
      throw new MigrationError(
        "DISPOSITION_REQUIRED",
        "تاریخ انقضای معافیت FR-۵۵ باید در آینده باشد.",
      );
    }
    if (w.independentApprover === opts.actorAccountId) {
      throw new MigrationError(
        "SOD_VIOLATION",
        "تأییدکننده مستقل معافیت نمی‌تواند همان بازیگر disposition باشد.",
      );
    }
    if (w.independentApprover === opts.ownerAccountId) {
      throw new MigrationError(
        "SOD_VIOLATION",
        "تأییدکننده مستقل معافیت نمی‌تواند مالک مغایرت باشد.",
      );
    }
  }

  const updated = await updateDiscrepancyDisposition(pool, {
    discrepancyId: opts.discrepancyId,
    status: opts.status,
    ownerAccountId: opts.ownerAccountId,
    ownerDisplay: opts.ownerDisplay ?? opts.actorDisplay ?? null,
    dispositionCode: opts.dispositionCode,
    dispositionRationaleFa: opts.dispositionRationaleFa,
    dispositionBy: opts.actorAccountId,
    waiver: opts.waiver ?? null,
  });
  if (!updated) {
    throw new MigrationError(
      "DISPOSITION_REQUIRED",
      "به‌روزرسانی disposition ناموفق بود.",
    );
  }
  return updated;
}

export async function signReconciliation(
  pool: Pool,
  opts: {
    runId: string;
    roleCode: SignatureRoleCode;
    signerAccountId: string;
    permissionHolder: SodPermissionHolder;
    segregationOn?: boolean;
  },
): Promise<ReconciliationRun> {
  await assertMigrationSignPermission(opts.permissionHolder);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT id FROM migration_staging.reconciliation_run WHERE id = $1::uuid FOR UPDATE`,
      [opts.runId],
    );

    const run = await getReconciliationRun(client, opts.runId);
    if (!run) {
      throw new MigrationError(
        "RECONCILIATION_REQUIRED",
        "اجرای تطبیق برای امضا یافت نشد.",
      );
    }
    assertRunMutable(run);

    const gateMode =
      run.tier === "production-candidate" ? "production" : "sign-trial";
    for (const domainKey of REQUIRED_PRODUCTION_DOMAINS) {
      const gate = assertRequiredDomainGate(run, domainKey, gateMode);
      if (gate) {
        throw new MigrationError(
          gate.code as MigrationErrorCode,
          gate.messageFa,
          { domainKey },
        );
      }
    }

    const openCritical = run.discrepancies.filter(
      (d) => d.severity === "critical" && d.status === "open",
    );
    if (openCritical.length > 0) {
      throw new MigrationError(
        "CRITICAL_DEFECT_OPEN",
        "امضا تا رفع یا معافیت همه مغایرت‌های بحرانی باز مجاز نیست.",
      );
    }

    const hash = computeReconciliationEvidenceHash(run);

    const other = run.signatures.find((s) => s.roleCode !== opts.roleCode);
    if (other) {
      assertReconcileSignSegregation({
        firstSignerAccountId: other.signerAccountId,
        secondSignerAccountId: opts.signerAccountId,
        segregationOn: opts.segregationOn,
      });
    }

    await insertSignature(client, {
      runId: opts.runId,
      roleCode: opts.roleCode,
      signerAccountId: opts.signerAccountId,
      evidenceHash: hash,
    });

    const after = await getReconciliationRun(client, opts.runId);
    if (!after) {
      throw new MigrationError(
        "RECONCILIATION_REQUIRED",
        "اجرای تطبیق پس از امضا یافت نشد.",
      );
    }

    const hasLead = after.signatures.some(
      (s) => s.roleCode === "migration_lead",
    );
    const hasHr = after.signatures.some((s) => s.roleCode === "hr_data_owner");
    const allHashesCurrent = after.signatures.every(
      (s) => s.evidenceHash === hash,
    );
    if (hasLead && hasHr && allHashesCurrent) {
      const now = new Date().toISOString();
      await updateRunStatus(client, {
        runId: opts.runId,
        status: "signed",
        frozenAt: now,
        evidenceHash: hash,
      });
    } else {
      await updateRunStatus(client, {
        runId: opts.runId,
        status: "in-progress",
        evidenceHash: hash,
      });
    }

    await client.query("COMMIT");

    const final = await getReconciliationRun(pool, opts.runId);
    if (!final) {
      throw new MigrationError(
        "RECONCILIATION_REQUIRED",
        "اجرای تطبیق پس از ثبت امضا یافت نشد.",
      );
    }
    return final;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export type ProductionGateResult =
  | { ok: true; run: ReconciliationRun; evidenceHash: string }
  | { ok: false; code: string; messageFa: string };

/**
 * Pure verification of a loaded run against production gate rules.
 * Used by assertProductionReconciliationGate and selfchecks.
 */
export function verifyProductionGateOnRun(
  run: ReconciliationRun,
  expectedBatchId: string,
): ProductionGateResult {
  if (run.batchId !== expectedBatchId) {
    return {
      ok: false,
      code: "RECONCILIATION_REQUIRED",
      messageFa: "اجرای تطبیق به این دسته پیوند ندارد.",
    };
  }
  if (run.tier !== "production-candidate") {
    return {
      ok: false,
      code: "RECONCILIATION_REQUIRED",
      messageFa:
        "فقط اجرای سطح production-candidate می‌تواند قطعه‌سازی تولید را باز کند.",
    };
  }
  if (run.status !== "signed") {
    return {
      ok: false,
      code: "RECONCILIATION_UNSIGNED",
      messageFa: "اجرای تطبیق امضا نشده است؛ قطعه‌سازی تولید مسدود است.",
    };
  }

  const hash = computeReconciliationEvidenceHash(run);
  if (!run.evidenceHash || run.evidenceHash !== hash) {
    return {
      ok: false,
      code: "RECONCILIATION_STALE",
      messageFa:
        "هش شواهد تطبیق با تصویر منجمد مطابقت ندارد؛ امضای مجدد لازم است.",
    };
  }

  for (const sig of run.signatures) {
    if (sig.evidenceHash !== hash) {
      return {
        ok: false,
        code: "SIGNATURE_INVALID",
        messageFa: "امضا به هش منجمد فعلی وابسته نیست.",
      };
    }
  }

  const hasLead = run.signatures.some((s) => s.roleCode === "migration_lead");
  const hasHr = run.signatures.some((s) => s.roleCode === "hr_data_owner");
  if (!hasLead || !hasHr) {
    return {
      ok: false,
      code: "RECONCILIATION_UNSIGNED",
      messageFa:
        "امضای Migration Lead و HR Data Owner هر دو برای تولید الزامی است.",
    };
  }

  const openCritical = run.discrepancies.some(
    (d) => d.severity === "critical" && d.status === "open",
  );
  if (openCritical) {
    return {
      ok: false,
      code: "CRITICAL_DEFECT_OPEN",
      messageFa: "مغایرت بحرانی باز مانع قطعه‌سازی تولید است.",
    };
  }

  for (const domainKey of REQUIRED_PRODUCTION_DOMAINS) {
    const gate = assertRequiredDomainGate(run, domainKey, "production");
    if (gate) return gate;
  }

  return { ok: true, run, evidenceHash: hash };
}

/**
 * Server-side production gate: load run by id, verify against batch.
 * Rejects arbitrary client strings that are not verified run UUIDs.
 */
export async function assertProductionReconciliationGate(
  db: PgQueryable,
  opts: {
    batchId: string;
    reconciliationRunId: string | null | undefined;
  },
): Promise<ReconciliationRun> {
  const runId = (opts.reconciliationRunId ?? "").trim();
  if (!runId) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "قطعه‌سازی سطح تولید بدون شناسه اجرای تطبیق امضاشده مجاز نیست.",
    );
  }

  // UUID shape check — reject free-string tokens
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(runId)) {
    throw new MigrationError(
      "RECONCILIATION_UNSIGNED",
      "شناسه اجرای تطبیق نامعتبر است؛ توکن دلخواه پذیرفته نمی‌شود.",
    );
  }

  const run = await getReconciliationRun(db, runId);
  if (!run) {
    throw new MigrationError(
      "RECONCILIATION_REQUIRED",
      "اجرای تطبیق برای گیت تولید یافت نشد.",
    );
  }

  const result = verifyProductionGateOnRun(run, opts.batchId);
  if (!result.ok) {
    throw new MigrationError(
      result.code as MigrationErrorCode,
      result.messageFa,
    );
  }
  return result.run;
}

export async function getReconciliation(
  pool: Pool,
  runId: string,
): Promise<ReconciliationRun | null> {
  return getReconciliationRun(pool, runId);
}

export async function listReconciliationRuns(
  pool: Pool,
  batchId: string,
): Promise<
  Array<
    Omit<
      ReconciliationRun,
      "controls" | "observations" | "discrepancies" | "signatures"
    >
  >
> {
  return listReconciliationRunsForBatch(pool, batchId);
}

/** Domain comparison rows for UI (control vs observed vs status). */
export type DomainComparisonRow = {
  domainKey: ReconciliationDomainKey;
  labelFa: string;
  controlValue: JsonValue | null;
  observedValue: JsonValue | null;
  status: "match" | "mismatch" | "missing_control" | "unavailable" | "open" | "closed";
  discrepancy: ReconciliationDiscrepancy | null;
};

export function buildDomainComparisonRows(
  run: ReconciliationRun,
): DomainComparisonRow[] {
  const controlBy = new Map(run.controls.map((c) => [c.domainKey, c]));
  const obsBy = new Map(run.observations.map((o) => [o.domainKey, o]));
  const discBy = new Map(run.discrepancies.map((d) => [d.domainKey, d]));

  return RECONCILIATION_DOMAIN_KEYS.map((domainKey) => {
    const control = controlBy.get(domainKey) ?? null;
    const obs = obsBy.get(domainKey) ?? null;
    const disc = discBy.get(domainKey) ?? null;
    let status: DomainComparisonRow["status"] = "match";
    if (!control) status = "missing_control";
    else if (obs && isUnavailableObservation(obs.observedValue))
      status = "unavailable";
    else if (disc && disc.status === "open") status = "open";
    else if (disc && disc.status !== "open") status = "closed";
    else if (
      control &&
      obs &&
      !valuesEqual(control.controlValue, obs.observedValue)
    )
      status = "mismatch";

    return {
      domainKey,
      labelFa: RECONCILIATION_DOMAIN_LABELS_FA[domainKey],
      controlValue: control?.controlValue ?? null,
      observedValue: obs?.observedValue ?? null,
      status,
      discrepancy: disc,
    };
  });
}

/** Helper for selfchecks: fabricate a signed happy-path in-memory run. */
export function buildSyntheticSignedRun(opts: {
  batchId: string;
  runId?: string;
  openCritical?: boolean;
  missingControl?: boolean;
  staleHash?: boolean;
  missingSignature?: boolean;
  unavailableOpen?: boolean;
  /** Waived unavailable still hard-blocks production */
  waivedUnavailable?: boolean;
  expiredWaiver?: boolean;
  tier?: ReconciliationTier;
}): ReconciliationRun {
  const runId = opts.runId ?? randomUUID();
  const controls = REQUIRED_PRODUCTION_DOMAINS.filter((d) =>
    opts.missingControl ? d !== "person" : true,
  ).map((domainKey) => ({
    id: randomUUID(),
    runId,
    domainKey,
    controlValue: { count: 1 } as JsonValue,
    attestedBy: "attestor",
    attestedAt: new Date().toISOString(),
    labelFa: RECONCILIATION_DOMAIN_LABELS_FA[domainKey],
  }));

  const observations = REQUIRED_PRODUCTION_DOMAINS.map((domainKey) => {
    if (
      opts.unavailableOpen &&
      PROJECTOR_GAP_DOMAINS.includes(domainKey)
    ) {
      return {
        id: randomUUID(),
        runId,
        domainKey,
        observedValue: {
          status: UNAVAILABLE,
          reason: "gap",
        } as JsonValue,
        computedAt: new Date().toISOString(),
        computationNotes: null,
      };
    }
    // Happy path / production gate: all domains honestly available + matching
    return {
      id: randomUUID(),
      runId,
      domainKey,
      observedValue: { count: 1 } as JsonValue,
      computedAt: new Date().toISOString(),
      computationNotes: null,
    };
  });

  const discrepancies: ReconciliationDiscrepancy[] = [];
  if (opts.openCritical) {
    discrepancies.push({
      id: randomUUID(),
      runId,
      domainKey: "duplicates",
      severity: "critical",
      status: "open",
      ownerAccountId: null,
      ownerDisplay: null,
      dispositionCode: null,
      dispositionRationaleFa: null,
      dispositionBy: null,
      dispositionAt: null,
      waiverIndependentApprover: null,
      waiverScope: null,
      waiverRisk: null,
      waiverCompensatingControl: null,
      waiverExpiry: null,
      integrityClass: "duplicate",
    });
  }
  if (opts.unavailableOpen) {
    for (const domainKey of PROJECTOR_GAP_DOMAINS) {
      discrepancies.push({
        id: randomUUID(),
        runId,
        domainKey,
        severity: "critical",
        status: "open",
        ownerAccountId: null,
        ownerDisplay: null,
        dispositionCode: null,
        dispositionRationaleFa: null,
        dispositionBy: null,
        dispositionAt: null,
        waiverIndependentApprover: null,
        waiverScope: null,
        waiverRisk: null,
        waiverCompensatingControl: null,
        waiverExpiry: null,
        integrityClass: domainIntegrityClass(domainKey),
      });
    }
  }
  if (opts.waivedUnavailable) {
    for (const domainKey of PROJECTOR_GAP_DOMAINS) {
      const obs = observations.find((o) => o.domainKey === domainKey);
      if (obs) {
        obs.observedValue = {
          status: UNAVAILABLE,
          reason: "gap",
        } as JsonValue;
      }
      discrepancies.push({
        id: randomUUID(),
        runId,
        domainKey,
        severity: "critical",
        status: "waived",
        ownerAccountId: "owner-1",
        ownerDisplay: "Owner",
        dispositionCode: "waive_projector_gap",
        dispositionRationaleFa: "معافیت موقت شکاف پروژکتور",
        dispositionBy: "actor-1",
        dispositionAt: new Date().toISOString(),
        waiverIndependentApprover: "approver-2",
        waiverScope: "trial-only",
        waiverRisk: "medium",
        waiverCompensatingControl: "manual review",
        waiverExpiry: new Date(Date.now() + 86400000).toISOString(),
        integrityClass: domainIntegrityClass(domainKey),
      });
      const ctrl = controls.find((c) => c.domainKey === domainKey);
      if (ctrl && obs) ctrl.controlValue = obs.observedValue;
    }
  }
  if (opts.expiredWaiver) {
    discrepancies.push({
      id: randomUUID(),
      runId,
      domainKey: "duplicates",
      severity: "critical",
      status: "waived",
      ownerAccountId: "owner-1",
      ownerDisplay: "Owner",
      dispositionCode: "waive_expired",
      dispositionRationaleFa: "معافیت منقضی",
      dispositionBy: "actor-1",
      dispositionAt: new Date().toISOString(),
      waiverIndependentApprover: "approver-2",
      waiverScope: "scope",
      waiverRisk: "risk",
      waiverCompensatingControl: "control",
      waiverExpiry: new Date(Date.now() - 86400000).toISOString(),
      integrityClass: "duplicate",
    });
    const ctrl = controls.find((c) => c.domainKey === "duplicates");
    const obs = observations.find((o) => o.domainKey === "duplicates");
    if (ctrl) ctrl.controlValue = { count: 99 };
    if (obs) obs.observedValue = { count: 1 };
  }

  const run: ReconciliationRun = {
    id: runId,
    batchId: opts.batchId,
    tier: opts.tier ?? "production-candidate",
    status: "signed",
    correlationId: randomUUID(),
    sourceExtractVersion: "synthetic",
    notes: null,
    createdBy: "creator",
    createdAt: new Date().toISOString(),
    frozenAt: new Date().toISOString(),
    evidenceHash: null,
    controls,
    observations,
    discrepancies,
    signatures: [],
  };

  const hash = computeReconciliationEvidenceHash(run);
  run.evidenceHash = opts.staleHash ? "stale-hash" : hash;
  if (!opts.missingSignature) {
    run.signatures = [
      {
        id: randomUUID(),
        runId,
        roleCode: "migration_lead",
        signerAccountId: "lead-1",
        signedAt: new Date().toISOString(),
        evidenceHash: hash,
      },
      {
        id: randomUUID(),
        runId,
        roleCode: "hr_data_owner",
        signerAccountId: "hr-1",
        signedAt: new Date().toISOString(),
        evidenceHash: hash,
      },
    ];
  } else {
    run.signatures = [
      {
        id: randomUUID(),
        runId,
        roleCode: "migration_lead",
        signerAccountId: "lead-1",
        signedAt: new Date().toISOString(),
        evidenceHash: hash,
      },
    ];
  }
  return run;
}
