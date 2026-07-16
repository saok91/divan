/**
 * Governed-path freshness + envelope wiring selfcheck (Story 2.1).
 * Run: pnpm --filter @divan/web selfcheck:governed
 *
 * Manual remainder (Epic 1 pattern): navigation, ldap-auth, jalali, persian-digits, a11y-floor.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AuthorizationError,
  DEMO_SENSITIVE_TUPLE,
  DEV_DEMO_POLICY,
  MSG_ACCESS_DENIED_FA,
  createAuditEnvelope,
} from "@divan/audit-envelope";
import { createPgPool } from "@divan/db";
import {
  getSessionContext,
  setAccountStatus,
  toEnvelopeAuthzContext,
  getIdentityDb,
} from "@divan/identity-access";
import { config as loadEnv } from "dotenv";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  assert.equal(MSG_ACCESS_DENIED_FA, "دسترسی ندارید.");

  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required");

  const pool = createPgPool(url);
  const envelope = createAuditEnvelope({
    pool,
    getPolicy: () => DEV_DEMO_POLICY,
  });

  const db = getIdentityDb();

  try {
    // Prefer seeded sys.admin if present
    const admin = await db.internalAccount.findUnique({
      where: { username: "sys.admin" },
    });
    assert.ok(admin, "seeded sys.admin required — run pnpm db:seed");

    const fresh = await getSessionContext(admin.id);
    assert.ok(fresh);
    assert.equal(fresh.coarseRole, "system_admin");
    assert.deepEqual(fresh.organizationalScopeIds, []);

    // Stale JWT claim simulation: pretend JWT still says system_admin while DB demoted
    const originalRole = admin.coarseRole;
    await db.internalAccount.update({
      where: { id: admin.id },
      data: { coarseRole: "manager" },
    });

    const afterDemote = await getSessionContext(admin.id);
    assert.ok(afterDemote);
    assert.equal(afterDemote.coarseRole, "manager");
    // Authz must use DB role, not stale JWT "system_admin"
    const authz = toEnvelopeAuthzContext(afterDemote);
    assert.equal(authz.coarseRole, "manager");

    // Sensitive fixture still denied for demoted (and any) coarse label
    await assert.rejects(
      () =>
        envelope.authorizeOrThrow({
          context: authz,
          ...DEMO_SENSITIVE_TUPLE,
          correlationId: randomUUID(),
          sensitive: true,
        }),
      AuthorizationError,
    );

    // Restore role, then deactivate → fail closed
    await db.internalAccount.update({
      where: { id: admin.id },
      data: { coarseRole: originalRole },
    });
    await setAccountStatus("sys.admin", "inactive");
    const inactive = await getSessionContext(admin.id);
    assert.equal(inactive, null);

    await setAccountStatus("sys.admin", "active");
    const restored = await getSessionContext(admin.id);
    assert.ok(restored);
    assert.equal(restored.coarseRole, "system_admin");

    console.log("governed.selfcheck: ok");
  } finally {
    // Best-effort restore
    try {
      await setAccountStatus("sys.admin", "active");
      await db.internalAccount.update({
        where: { username: "sys.admin" },
        data: { coarseRole: "system_admin" },
      });
    } catch {
      // ignore
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
