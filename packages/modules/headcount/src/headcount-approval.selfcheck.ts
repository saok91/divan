/**
 * Headcount Approval lifecycle selfcheck (Story 4.12 / FR-28).
 * Run: pnpm --filter @divan/headcount selfcheck:headcount-approval
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
  HeadcountApprovalError,
  activateApproval,
  cancelApproval,
  consumeHeadcountCapacity,
  createApproval,
  ensureHeadcountApprovalSchema,
  ensureHeadcountCapacitySchema,
  evaluateHeadcountCapacity,
  expireApproval,
  reconstructHeadcountQuantitiesAsOf,
  reserveHeadcountCapacity,
  updateApproval,
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
  const actor = `selfcheck-approval-${suffix}`;
  const today = todayDateOnlyTehran();
  const validityStart = addDays(today, -30);
  const validityEnd = addDays(today, 365);

  try {
    await ensureHeadcountCapacitySchema(pool);
    await ensureHeadcountApprovalSchema(pool);

    const team = await db.organizationalUnit.findFirstOrThrow({
      where: { unitType: "TEAM", active: true },
    });
    const title = await db.jobTitle.findFirstOrThrow({
      where: { active: true },
    });

    // --- Draft cannot consume/reserve ---
    const draft = await createApproval(pool, {
      requirementCode: `REQ-DRAFT-${suffix}`,
      teamId: team.id,
      jobTitleId: title.id,
      allowedCount: 3,
      validityStart,
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    assert.equal(draft.status, "draft");
    assert.equal(draft.slotId, null);

    const evalDraft = await evaluateHeadcountCapacity(pool, {
      teamId: team.id,
      jobTitleId: title.id,
      effectiveDate: today,
      preferredSlotId: draft.slotId,
    });
    // No slot yet — preferred null; may find other slots. Create isolated team.
    const dept = await db.organizationalUnit.findFirst({
      where: { unitType: "DEPARTMENT", active: true },
    });
    assert.ok(dept, "need DEPARTMENT fixture");
    const isolatedTeam = await db.organizationalUnit.create({
      data: {
        code: `TEAM-APR-${suffix}`,
        nameFa: "تیم مجوز ظرفیت",
        unitType: "TEAM",
        parentId: dept.id,
        startDate: new Date("2020-01-01"),
        active: true,
      },
    });

    const draftIsolated = await createApproval(pool, {
      requirementCode: `REQ-ISO-DRAFT-${suffix}`,
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      allowedCount: 2,
      validityStart,
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    const evalNoSlot = await evaluateHeadcountCapacity(pool, {
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      effectiveDate: today,
    });
    assert.equal(
      evalNoSlot.outcome,
      "incompatible",
      "draft without slot → no capacity",
    );

    // --- Activate → evaluate compatible; consume/reserve OK ---
    const active = await activateApproval(pool, {
      id: draftIsolated.id,
      actorId: actor,
    });
    assert.equal(active.status, "active");
    assert.ok(active.slotId);
    assert.equal(active.allowedCount, 2);
    assert.equal(active.free, 2);
    assert.equal(active.used, 0);

    const evalActive = await evaluateHeadcountCapacity(pool, {
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      effectiveDate: today,
      preferredSlotId: active.slotId,
    });
    assert.equal(evalActive.outcome, "compatible");
    if (evalActive.outcome === "compatible") {
      assert.equal(evalActive.slotId, active.slotId);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const reserved = await reserveHeadcountCapacity(client, {
        slotId: active.slotId!,
        eventId: randomUUID(),
        personId: randomUUID(),
        evaluationDate: today,
      });
      assert.equal(reserved.reserved, true);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const afterReserve = await evaluateHeadcountCapacity(pool, {
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      effectiveDate: today,
      preferredSlotId: active.slotId,
    });
    assert.equal(afterReserve.outcome, "compatible");

    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      const consumed = await consumeHeadcountCapacity(client2, {
        slotId: active.slotId!,
        eventId: randomUUID(),
        personId: randomUUID(),
        evaluationDate: today,
      });
      assert.equal(consumed.consumed, true);
      await client2.query("COMMIT");
    } catch (e) {
      await client2.query("ROLLBACK");
      throw e;
    } finally {
      client2.release();
    }

    // --- Cancel/expire/reduce with active claim → rejected; claims unchanged ---
    await assert.rejects(
      () => cancelApproval(pool, { id: draftIsolated.id, actorId: actor }),
      (err: unknown) => {
        assert.ok(err instanceof HeadcountApprovalError);
        assert.equal(err.code, "ORPHAN_CLAIMS");
        assert.ok(err.messageFa.length > 0);
        return true;
      },
    );
    await assert.rejects(
      () => expireApproval(pool, { id: draftIsolated.id, actorId: actor }),
      (err: unknown) => {
        assert.ok(err instanceof HeadcountApprovalError);
        assert.equal(err.code, "ORPHAN_CLAIMS");
        return true;
      },
    );
    await assert.rejects(
      () =>
        updateApproval(pool, {
          id: draftIsolated.id,
          actorId: actor,
          allowedCount: 0,
        }),
      (err: unknown) => {
        assert.ok(err instanceof HeadcountApprovalError);
        assert.equal(err.code, "ORPHAN_CLAIMS");
        return true;
      },
    );

    const stillActive = await evaluateHeadcountCapacity(pool, {
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      effectiveDate: today,
      preferredSlotId: active.slotId,
    });
    // allowed=2 with 1 reserved + 1 consumed → free 0 → incompatible
    assert.equal(stillActive.outcome, "incompatible");

    // --- Cancel draft / cancel active with zero claims ---
    const draftCancel = await createApproval(pool, {
      requirementCode: `REQ-CANCEL-DRAFT-${suffix}`,
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      allowedCount: 1,
      validityStart,
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    const cancelledDraft = await cancelApproval(pool, {
      id: draftCancel.id,
      actorId: actor,
    });
    assert.equal(cancelledDraft.status, "cancelled");

    const zeroClaims = await createApproval(pool, {
      requirementCode: `REQ-ZERO-${suffix}`,
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      allowedCount: 4,
      validityStart,
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    const activatedZero = await activateApproval(pool, {
      id: zeroClaims.id,
      actorId: actor,
    });
    const cancelledActive = await cancelApproval(pool, {
      id: activatedZero.id,
      actorId: actor,
    });
    assert.equal(cancelledActive.status, "cancelled");

    const evalCancelled = await evaluateHeadcountCapacity(pool, {
      teamId: isolatedTeam.id,
      jobTitleId: title.id,
      effectiveDate: today,
      preferredSlotId: activatedZero.slotId,
    });
    assert.equal(
      evalCancelled.outcome,
      "incompatible",
      "cancelled approval slot must not accept new consume",
    );

    const client3 = await pool.connect();
    try {
      await client3.query("BEGIN");
      await assert.rejects(
        () =>
          consumeHeadcountCapacity(client3, {
            slotId: activatedZero.slotId!,
            eventId: randomUUID(),
            personId: randomUUID(),
            evaluationDate: today,
          }),
        (err: unknown) => {
          assert.ok(err instanceof HeadcountApprovalError);
          assert.equal(err.code, "NOT_CONSUMABLE");
          assert.ok(err.messageFa.length > 0);
          return true;
        },
      );
      await client3.query("ROLLBACK");
    } finally {
      client3.release();
    }

    // --- Unique requirement_code ---
    await assert.rejects(
      () =>
        createApproval(pool, {
          requirementCode: `REQ-ISO-DRAFT-${suffix}`,
          teamId: isolatedTeam.id,
          jobTitleId: title.id,
          allowedCount: 1,
          validityStart,
          validityEndExclusive: validityEnd,
          actorId: actor,
        }),
      (err: unknown) => {
        assert.ok(err instanceof HeadcountApprovalError);
        assert.equal(err.code, "DUPLICATE_CODE");
        return true;
      },
    );

    // --- Invalid / empty validity ---
    await assert.rejects(
      () =>
        createApproval(pool, {
          requirementCode: `REQ-BAD-VAL-${suffix}`,
          teamId: isolatedTeam.id,
          jobTitleId: title.id,
          allowedCount: 1,
          validityStart: today,
          validityEndExclusive: today,
          actorId: actor,
        }),
      (err: unknown) => {
        assert.ok(err instanceof HeadcountApprovalError);
        assert.equal(err.code, "VALIDATION");
        return true;
      },
    );

    // --- Historical approved uses Approval ceiling; conservation ---
    const histTeam = await db.organizationalUnit.create({
      data: {
        code: `TEAM-APR-HIST-${suffix}`,
        nameFa: "تیم سقف تاریخی",
        unitType: "TEAM",
        parentId: dept.id,
        startDate: new Date("2020-01-01"),
        active: true,
      },
    });
    const histApproval = await createApproval(pool, {
      requirementCode: `REQ-HIST-${suffix}`,
      teamId: histTeam.id,
      jobTitleId: title.id,
      allowedCount: 7,
      validityStart,
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    const histActive = await activateApproval(pool, {
      id: histApproval.id,
      actorId: actor,
    });
    const ledger = await reconstructHeadcountQuantitiesAsOf(pool, {
      asOf: today,
      slotId: histActive.slotId!,
    });
    assert.equal(ledger.slots.length, 1);
    const slot = ledger.slots[0]!;
    assert.equal(slot.approved, 7, "approved === Approval allowed_count");
    assert.equal(slot.approved, slot.used + slot.reserved + slot.free);
    assert.equal(slot.used, 0);
    assert.equal(slot.reserved, 0);
    assert.equal(slot.free, 7);

    // Cancelled Approval-backed → claims-only ceiling (no live stand-in)
    const cancelledHist = await cancelApproval(pool, {
      id: histApproval.id,
      actorId: actor,
    });
    assert.equal(cancelledHist.status, "cancelled");
    const ledgerCancelled = await reconstructHeadcountQuantitiesAsOf(pool, {
      asOf: today,
      slotId: histActive.slotId!,
    });
    const cancelledSlot = ledgerCancelled.slots[0]!;
    assert.equal(
      cancelledSlot.approved,
      cancelledSlot.used + cancelledSlot.reserved,
      "cancelled → approved = used+reserved",
    );
    assert.equal(cancelledSlot.free, 0);
    assert.notEqual(
      cancelledSlot.approved,
      7,
      "must not keep allowed_count after cancel",
    );

    // evaluationDate outside validity → NOT_CONSUMABLE even if today is inside
    const gateTeam = await db.organizationalUnit.create({
      data: {
        code: `TEAM-APR-GATE-${suffix}`,
        nameFa: "تیم گیت تاریخ",
        unitType: "TEAM",
        parentId: dept.id,
        startDate: new Date("2020-01-01"),
        active: true,
      },
    });
    const gateDraft = await createApproval(pool, {
      requirementCode: `REQ-GATE-${suffix}`,
      teamId: gateTeam.id,
      jobTitleId: title.id,
      allowedCount: 1,
      validityStart,
      validityEndExclusive: validityEnd,
      actorId: actor,
    });
    const gateActive = await activateApproval(pool, {
      id: gateDraft.id,
      actorId: actor,
    });
    const clientGate = await pool.connect();
    try {
      await clientGate.query("BEGIN");
      await assert.rejects(
        () =>
          consumeHeadcountCapacity(clientGate, {
            slotId: gateActive.slotId!,
            eventId: randomUUID(),
            personId: randomUUID(),
            evaluationDate: "2019-01-01",
          }),
        (err: unknown) => {
          assert.ok(err instanceof HeadcountApprovalError);
          assert.equal(err.code, "NOT_CONSUMABLE");
          return true;
        },
      );
      await clientGate.query("ROLLBACK");
    } finally {
      clientGate.release();
    }

    console.log("headcount-approval.selfcheck: OK");
  } finally {
    await pool.end();
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
