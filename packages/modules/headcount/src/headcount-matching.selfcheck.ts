/**
 * Approval-first matching + exemptions selfcheck (Story 4.13 / FR-29).
 * Run: pnpm --filter @divan/headcount selfcheck:headcount-matching
 * Requires DATABASE_URL, migrated schema, seeded org/job fixtures.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool, createPrismaClient } from "@divan/db";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  HeadcountExemptionError,
  activateApproval,
  activateExemption,
  createApproval,
  createExemption,
  ensureHeadcountApprovalSchema,
  ensureHeadcountCapacitySchema,
  ensureHeadcountExemptionSchema,
  evaluateHeadcountCapacity,
  matchCompatibleApprovals,
  rebindCoveringExemptionToSuccessor,
  revokeExemption,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

function addDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");
  const pool = createPgPool(url);
  const db = createPrismaClient(url);
  const suffix = randomUUID().slice(0, 8);
  const actor = `selfcheck-match-${suffix}`;
  const today = todayDateOnlyTehran();
  const validityStart = addDays(today, -30);
  const validityEnd = addDays(today, 365);

  try {
    await ensureHeadcountCapacitySchema(pool);
    await ensureHeadcountApprovalSchema(pool);
    await ensureHeadcountExemptionSchema(pool);

    const dept = await db.organizationalUnit.findFirst({
      where: { unitType: "DEPARTMENT", active: true },
    });
    assert.ok(dept, "need DEPARTMENT fixture");
    const title = await db.jobTitle.findFirstOrThrow({
      where: { active: true },
    });
    const otherTitle = await db.jobTitle.findFirst({
      where: { active: true, id: { not: title.id } },
    });
    assert.ok(otherTitle, "need ≥2 JobTitles");
    const seniority = await db.seniority.findFirst({
      where: { active: true },
    });
    const otherSeniority = await db.seniority.findFirst({
      where: {
        active: true,
        ...(seniority ? { id: { not: seniority.id } } : {}),
      },
    });

    const team = await db.organizationalUnit.create({
      data: {
        code: `TEAM-M13-${suffix}`,
        nameFa: "تیم تطبیق ۴٫۱۳",
        unitType: "TEAM",
        parentId: dept.id,
        startDate: new Date("2020-01-01"),
        active: true,
      },
    });

    // --- Two Approvals same Team+Title → oldest validity_start then created_at ---
    const older = await createApproval(pool, {
      requirementCode: `REQ-OLD-${suffix}`,
      teamId: team.id,
      jobTitleId: title.id,
      allowedCount: 2,
      validityStart: addDays(today, -60),
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    const newer = await createApproval(pool, {
      requirementCode: `REQ-NEW-${suffix}`,
      teamId: team.id,
      jobTitleId: title.id,
      allowedCount: 2,
      validityStart: addDays(today, -10),
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    await activateApproval(pool, { id: older.id, actorId: actor });
    await activateApproval(pool, { id: newer.id, actorId: actor });

    const defaultMatch = await matchCompatibleApprovals(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      evaluationDate: today,
    });
    assert.equal(defaultMatch.outcome, "matched");
    if (defaultMatch.outcome === "matched") {
      assert.equal(defaultMatch.approvalId, older.id, "oldest wins");
      assert.equal(defaultMatch.matchedBy, "default");
    }

    // --- Grade ignored: same Title still matches (no grade on Approval) ---
    const evalIgnoreGrade = await evaluateHeadcountCapacity(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      gradeId: randomUUID(),
      ladderId: randomUUID(),
      effectiveDate: today,
    });
    assert.equal(evalIgnoreGrade.outcome, "compatible");
    if (evalIgnoreGrade.outcome === "compatible") {
      assert.equal(evalIgnoreGrade.approvalId, older.id);
      assert.equal(evalIgnoreGrade.matchedBy, "default");
    }

    // --- Seniority-specific vs unspecified: both match → oldest among both ---
    if (seniority) {
      const senSpecific = await createApproval(pool, {
        requirementCode: `REQ-SEN-${suffix}`,
        teamId: team.id,
        jobTitleId: title.id,
        seniorityId: seniority.id,
        allowedCount: 1,
        validityStart: addDays(today, -90),
        validityEndExclusive: validityEnd,
        actorId: actor,
      });
      await activateApproval(pool, { id: senSpecific.id, actorId: actor });

      const withSen = await matchCompatibleApprovals(pool, {
        teamId: team.id,
        jobTitleId: title.id,
        seniorityId: seniority.id,
        evaluationDate: today,
      });
      assert.equal(withSen.outcome, "matched");
      if (withSen.outcome === "matched") {
        assert.equal(
          withSen.approvalId,
          senSpecific.id,
          "oldest among seniority-compatible includes specific+unspecified",
        );
      }

      if (otherSeniority) {
        const wrongSen = await matchCompatibleApprovals(pool, {
          teamId: team.id,
          jobTitleId: title.id,
          seniorityId: otherSeniority.id,
          evaluationDate: today,
          preferredApprovalId: senSpecific.id,
        });
        assert.equal(wrongSen.outcome, "manual_incompatible");
      }
    }

    // --- Manual preferredApprovalId respected when compatible ---
    const manual = await matchCompatibleApprovals(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      evaluationDate: today,
      preferredApprovalId: newer.id,
    });
    assert.equal(manual.outcome, "matched");
    if (manual.outcome === "matched") {
      assert.equal(manual.approvalId, newer.id);
      assert.equal(manual.matchedBy, "manual");
    }

    // --- Manual preferred rejected when not compatible (wrong title team) ---
    const wrongTeam = await db.organizationalUnit.create({
      data: {
        code: `TEAM-M13B-${suffix}`,
        nameFa: "تیم تطبیق اشتباه",
        unitType: "TEAM",
        parentId: dept.id,
        startDate: new Date("2020-01-01"),
        active: true,
      },
    });
    const alien = await createApproval(pool, {
      requirementCode: `REQ-ALIEN-${suffix}`,
      teamId: wrongTeam.id,
      jobTitleId: otherTitle.id,
      allowedCount: 1,
      validityStart,
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    await activateApproval(pool, { id: alien.id, actorId: actor });
    const badManual = await matchCompatibleApprovals(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      evaluationDate: today,
      preferredApprovalId: alien.id,
    });
    assert.equal(badManual.outcome, "manual_incompatible");

    // --- Exemption: covering → evaluate exempt; revoke fail-closed ---
    // primary_assignment_id is TEXT (no FK) — synthetic id is enough for domain oracles.
    const account = await db.internalAccount.findFirstOrThrow({
      where: { username: "hr.admin" },
    });
    const primaryId = randomUUID();
    const personId = randomUUID();

    const exemption = await createExemption(pool, {
      policyCode: `intern-pool-${suffix}`,
      primaryAssignmentId: primaryId,
      personId,
      actorAccountId: account.id,
      approverAccountId: account.id,
      reason: "استخر کارآموز — خودآزمایی ۴٫۱۳",
      validityStart,
      validityEndExclusive: validityEnd,
      reportingTreatment: "exclude_from_used",
      actorId: actor,
    });
    assert.equal(exemption.status, "draft");
    assert.equal(exemption.reportingTreatment, "exclude_from_used");
    const activeEx = await activateExemption(pool, {
      id: exemption.id,
      actorId: actor,
    });
    assert.equal(activeEx.status, "active");

    const evalExempt = await evaluateHeadcountCapacity(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      effectiveDate: today,
      primaryAssignmentId: primaryId,
    });
    assert.equal(evalExempt.outcome, "exempt");
    if (evalExempt.outcome === "exempt") {
      assert.equal(evalExempt.exemptionId, exemption.id);
    }

    await assert.rejects(
      () =>
        revokeExemption(pool, {
          id: exemption.id,
          actorId: actor,
        }),
      (err: unknown) =>
        err instanceof HeadcountExemptionError && err.code === "UNCOVER",
    );

    const revoked = await revokeExemption(pool, {
      id: exemption.id,
      actorId: actor,
      hasApprovalRebind: true,
    });
    assert.equal(revoked.status, "revoked");

    // --- Rebind covering exemption to successor Primary id ---
    const sourcePrimaryId = randomUUID();
    const successorPrimaryId = randomUUID();
    const ex2 = await createExemption(pool, {
      policyCode: `rebind-${suffix}`,
      primaryAssignmentId: sourcePrimaryId,
      personId,
      actorAccountId: account.id,
      approverAccountId: account.id,
      reason: "rebind oracle",
      validityStart,
      validityEndExclusive: validityEnd,
      reportingTreatment: "exclude_from_used",
      actorId: actor,
    });
    await activateExemption(pool, { id: ex2.id, actorId: actor });
    const rebound = await rebindCoveringExemptionToSuccessor(pool, {
      fromPrimaryAssignmentId: sourcePrimaryId,
      toPrimaryAssignmentId: successorPrimaryId,
      evaluationDate: today,
      actorId: actor,
    });
    assert.ok(rebound);
    assert.equal(rebound!.primaryAssignmentId, successorPrimaryId);
    const coveredSuccessor = await evaluateHeadcountCapacity(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      effectiveDate: today,
      primaryAssignmentId: successorPrimaryId,
    });
    assert.equal(coveredSuccessor.outcome, "exempt");

    // Product evaluate fail-closed: jobTitle + no Approval → incompatible (not legacy_slot)
    const noMatchEval = await evaluateHeadcountCapacity(pool, {
      teamId: randomUUID(),
      jobTitleId: randomUUID(),
      effectiveDate: today,
    });
    assert.equal(noMatchEval.outcome, "incompatible");

    // Domain oracle: matched Approval id is the product link Primary would persist
    const linkMatch = await matchCompatibleApprovals(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      evaluationDate: today,
    });
    assert.equal(linkMatch.outcome, "matched");
    if (linkMatch.outcome === "matched") {
      assert.ok(linkMatch.approvalId);
      assert.ok(linkMatch.slotId);
    }

    console.log("headcount-matching selfcheck: OK");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
