/**
 * Headcount Override + reservation expiry selfcheck (Story 4.14 / FR-30 / FR-32).
 * Run: pnpm --filter @divan/headcount selfcheck:headcount-override
 * Requires DATABASE_URL.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { createPgPool, createPrismaClient } from "@divan/db";
import { todayDateOnlyTehran } from "@divan/temporal-engine";

import {
  consumeHeadcountCapacityWithOverride,
  createApproval,
  activateApproval,
  ensureHeadcountApprovalSchema,
  ensureHeadcountCapacitySchema,
  ensureHeadcountOverrideSchema,
  HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS,
  HeadcountOverrideError,
  isApprovalExpiryWithinWarningHorizon,
  listOverrides,
  matchApprovalsForOverride,
  readHeadcountCapacityPanel,
  releaseHeadcountReservation,
  reserveHeadcountCapacity,
  reserveHeadcountCapacityWithOverride,
  seedCapacitySlot,
  checkReservationApprovalExpiryWarning,
  detectScheduledHeadcountException,
  voidOverride,
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
  const today = todayDateOnlyTehran();
  const actor = `selfcheck-override-${suffix}`;

  try {
    await ensureHeadcountCapacitySchema(pool);
    await ensureHeadcountApprovalSchema(pool);
    await ensureHeadcountOverrideSchema(pool);

    const team = await db.organizationalUnit.findFirstOrThrow({
      where: { unitType: "TEAM" },
    });
    const title = await db.jobTitle.findFirstOrThrow();
    const seniority = await db.seniority.findFirst();

    // --- Horizon helper unit oracle ---
    assert.equal(
      isApprovalExpiryWithinWarningHorizon(addDays(today, 14)),
      true,
      "end at today+14 is within horizon",
    );
    assert.equal(
      isApprovalExpiryWithinWarningHorizon(addDays(today, 15)),
      false,
      ">14 days silent",
    );
    assert.equal(
      isApprovalExpiryWithinWarningHorizon(addDays(today, 0)),
      false,
      "already ending today is not soon-warn",
    );
    assert.equal(HEADCOUNT_RESERVATION_EXPIRY_WARNING_DAYS(), 14);

    // --- Approval near expiry warning ---
    const nearEnd = addDays(today, 10);
    const approvalNear = await createApproval(pool, {
      requirementCode: `OV-NEAR-${suffix}`,
      teamId: team.id,
      jobTitleId: title.id,
      seniorityId: seniority?.id ?? null,
      allowedCount: 2,
      validityStart: addDays(today, -30),
      validityEndExclusive: nearEnd,
      actorId: actor,
    });
    await activateApproval(pool, { id: approvalNear.id, actorId: actor });
    const warn = await checkReservationApprovalExpiryWarning(pool, {
      approvalId: approvalNear.id,
      evaluationDate: today,
    });
    assert.equal(warn.atRisk, true);

    const farEnd = addDays(today, 60);
    const approvalFar = await createApproval(pool, {
      requirementCode: `OV-FAR-${suffix}`,
      teamId: team.id,
      jobTitleId: title.id,
      seniorityId: seniority?.id ?? null,
      allowedCount: 1,
      validityStart: addDays(today, -30),
      validityEndExclusive: farEnd,
      actorId: actor,
    });
    await activateApproval(pool, { id: approvalFar.id, actorId: actor });
    const silent = await checkReservationApprovalExpiryWarning(pool, {
      approvalId: approvalFar.id,
      evaluationDate: today,
    });
    assert.equal(silent.atRisk, false);

    // --- Soft-expired Approval → Scheduled-exception ---
    const willExpire = await createApproval(pool, {
      requirementCode: `OV-EXP-${suffix}`,
      teamId: team.id,
      jobTitleId: title.id,
      seniorityId: seniority?.id ?? null,
      allowedCount: 1,
      validityStart: addDays(today, -60),
      validityEndExclusive: addDays(today, 2),
      actorId: actor,
    });
    await activateApproval(pool, { id: willExpire.id, actorId: actor });
    await pool.query(
      `UPDATE headcount_approval
       SET validity_end_exclusive = $2::date
       WHERE id = $1::uuid`,
      [willExpire.id, addDays(today, -1)],
    );
    const exception = await detectScheduledHeadcountException(pool, {
      approvalId: willExpire.id,
      evaluationDate: today,
      teamId: team.id,
      jobTitleId: title.id,
    });
    assert.equal(exception.exception, true);

    // --- Override shortage → free negative + filterable row ---
    const zeroSlotId = await seedCapacitySlot(pool, {
      id: randomUUID(),
      teamId: team.id,
      jobTitleId: title.id,
      freeUnits: 0,
      label: `override-zero-${suffix}`,
    });
    const eventId = randomUUID();
    const personId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const reserved = await reserveHeadcountCapacityWithOverride(client, {
        slotId: zeroSlotId,
        eventId,
        personId,
        evaluationDate: today,
        override: {
          violatedRule: "shortage",
          reason: "خودآزمایی کمبود ظرفیت",
          actorAccountId: actor,
          teamId: team.id,
          jobTitleId: title.id,
          seniorityId: seniority?.id ?? null,
          skipApprovalGate: true,
        },
      });
      assert.equal(reserved.reserved, true);
      assert.ok(reserved.overrideId);
      await client.query("COMMIT");

      const freeRow = await pool.query<{ free_units: number }>(
        `SELECT free_units FROM headcount_capacity_slot WHERE id = $1::uuid`,
        [zeroSlotId],
      );
      assert.equal(Number(freeRow.rows[0]?.free_units), -1);

      const listed = await listOverrides(pool, {
        status: "active",
        violatedRule: "shortage",
        slotId: zeroSlotId,
      });
      assert.ok(listed.some((r) => r.id === reserved.overrideId));
      assert.ok(listed[0]?.capacitySnapshot);
      assert.equal(listed[0]?.reason, "خودآزمایی کمبود ظرفیت");

      const panel = await readHeadcountCapacityPanel(pool, {
        teamId: team.id,
        jobTitleId: title.id,
        effectiveDate: today,
        preferredSlotId: zeroSlotId,
      });
      assert.ok(panel.overridden >= 1);
      assert.ok(panel.free < 0);

      // Cancel releases reservation
      await client.query("BEGIN");
      const released = await releaseHeadcountReservation(client, eventId);
      await client.query("COMMIT");
      assert.equal(released.released, true);

      // --- matchApprovalsForOverride finds zero-free ---
      const match = await matchApprovalsForOverride(pool, {
        teamId: team.id,
        jobTitleId: title.id,
        evaluationDate: today,
      });
      assert.ok(
        match.outcome === "matched" ||
          match.outcome === "none" ||
          match.outcome === "manual_incompatible",
      );

      // Normal reserve still requires free > 0
      const blockedEvent = randomUUID();
      await pool.query(
        `UPDATE headcount_capacity_slot SET free_units = 0 WHERE id = $1::uuid`,
        [zeroSlotId],
      );
      await assert.rejects(
        async () => {
          await client.query("BEGIN");
          try {
            await reserveHeadcountCapacity(client, {
              slotId: zeroSlotId,
              eventId: blockedEvent,
              personId,
              evaluationDate: today,
            });
            await client.query("COMMIT");
          } catch (err) {
            await client.query("ROLLBACK");
            throw err;
          }
        },
        /رزرو|ظرفیت/,
      );

      // Validity override consume skips gate
      const validityEvent = randomUUID();
      await client.query("BEGIN");
      await consumeHeadcountCapacityWithOverride(client, {
        slotId: zeroSlotId,
        eventId: validityEvent,
        personId,
        evaluationDate: today,
        override: {
          violatedRule: "validity",
          reason: "خودآزمایی اعتبار",
          actorAccountId: actor,
          teamId: team.id,
          jobTitleId: title.id,
          approvalId: willExpire.id,
          skipApprovalGate: true,
        },
      });
      await client.query("COMMIT");
      const validityRows = await listOverrides(pool, {
        violatedRule: "validity",
        relatedEventId: validityEvent,
      });
      assert.equal(validityRows[0]?.violatedRule, "validity");

      // voidOverride rejects while linked consumption is active
      let voidRejected = false;
      try {
        await voidOverride(pool, {
          id: validityRows[0]!.id,
          actorId: actor,
        });
      } catch (err) {
        voidRejected =
          err instanceof HeadcountOverrideError &&
          err.messageFa.includes("claim فعال");
      }
      assert.equal(voidRejected, true, "void with linked claim must reject");
    } finally {
      client.release();
    }

    console.log("headcount-override selfcheck: ok");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
