/**
 * Self-check for default-deny audit-envelope (Story 2.1).
 * Run: pnpm --filter @divan/audit-envelope selfcheck
 * Requires DATABASE_URL + kernel_events migration + (optional) seeded accounts for freshness cases.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool } from "@divan/db";
import { config as loadEnv } from "dotenv";

import {
  AuthorizationError,
  DEMO_SENSITIVE_TUPLE,
  DEV_DEMO_POLICY,
  MSG_ACCESS_DENIED_FA,
  createAuditEnvelope,
  emptyPolicyRegistry,
  evaluatePolicy,
  loadPolicyRegistry,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  // --- Pure policy (no DB) ---
  assert.equal(
    evaluatePolicy(emptyPolicyRegistry(), {
      permission: "x",
      dataCategory: "y",
      action: "read",
      organizationalScope: "z",
    }),
    "deny",
  );

  assert.equal(
    evaluatePolicy(DEV_DEMO_POLICY, {
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    }),
    "allow",
  );

  assert.equal(
    evaluatePolicy(DEV_DEMO_POLICY, {
      permission: DEMO_SENSITIVE_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_TUPLE.dataCategory,
      action: DEMO_SENSITIVE_TUPLE.action,
      organizationalScope: DEMO_SENSITIVE_TUPLE.organizationalScope,
    }),
    "deny",
  );

  // Fail-closed policy load: missing path / bad JSON → empty (deny), not throw
  assert.equal(
    loadPolicyRegistry({
      AUDIT_ENVELOPE_POLICY_PATH: "/nonexistent/divan-policy.json",
    }).rules.length,
    0,
  );
  assert.equal(
    loadPolicyRegistry({
      NODE_ENV: "Production",
    }).rules.length,
    0,
  );
  assert.equal(
    loadPolicyRegistry({
      AUDIT_ENVELOPE_USE_DEV_FIXTURE: " false ",
    }).rules.length,
    0,
  );

  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required for envelope DB assertions");

  const pool = createPgPool(url);
  const envelope = createAuditEnvelope({
    pool,
    getPolicy: () => DEV_DEMO_POLICY,
  });

  try {
    // Controlled allow + access event
    const allowCorr = randomUUID();
    const allowed = await envelope.authorizeOrThrow({
      context: {
        accountId: randomUUID(), // synthetic — FK not enforced on kernel_events
        coarseRole: "system_admin",
        organizationalScopeIds: [],
      },
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
      operation: "demo.selfcheck.read",
      correlationId: allowCorr,
      sensitive: true,
    });
    assert.ok(allowed.decisionId);

    const allowRows = await pool.query(
      `SELECT result FROM kernel_events WHERE correlation_id = $1::uuid`,
      [allowCorr],
    );
    assert.equal(allowRows.rows[0]?.result, "allow");

    // Sensitive deny despite system_admin label + Persian message
    const denyCorr = randomUUID();
    await assert.rejects(
      () =>
        envelope.authorizeOrThrow({
          context: {
            accountId: randomUUID(),
            coarseRole: "system_admin",
            organizationalScopeIds: [],
          },
          ...DEMO_SENSITIVE_TUPLE,
          correlationId: denyCorr,
          sensitive: true,
        }),
      (err: unknown) => {
        assert.ok(err instanceof AuthorizationError);
        assert.equal(err.code, "FORBIDDEN");
        assert.equal(err.messageFa, MSG_ACCESS_DENIED_FA);
        assert.equal(err.messageFa, "دسترسی ندارید.");
        return true;
      },
    );

    const denyRows = await pool.query(
      `SELECT result FROM kernel_events WHERE correlation_id = $1::uuid`,
      [denyCorr],
    );
    assert.equal(denyRows.rows[0]?.result, "deny");

    // manager / hr_admin labels also deny without explicit rule
    for (const role of ["manager", "hr_admin", "hr_operator"] as const) {
      await assert.rejects(
        () =>
          envelope.authorizeOrThrow({
            context: {
              accountId: randomUUID(),
              coarseRole: role,
              organizationalScopeIds: [],
            },
            ...DEMO_SENSITIVE_TUPLE,
            correlationId: randomUUID(),
            sensitive: true,
          }),
        AuthorizationError,
      );
    }

    // Append failure on sensitive path → fail closed (no silent allow)
    const broken = createAuditEnvelope({
      pool: createPgPool("postgresql://invalid:invalid@127.0.0.1:1/none"),
      getPolicy: () => DEV_DEMO_POLICY,
    });
    await assert.rejects(
      () =>
        broken.authorizeOrThrow({
          context: {
            accountId: randomUUID(),
            coarseRole: "system_admin",
            organizationalScopeIds: [],
          },
          permission: "demo.selfcheck.read",
          dataCategory: "demo.non_hr",
          action: "read",
          organizationalScope: "org:selfcheck",
          operation: "demo.selfcheck.read",
          correlationId: randomUUID(),
          sensitive: true,
        }),
      (err: unknown) => {
        assert.ok(err instanceof AuthorizationError);
        assert.equal(err.code, "AUDIT_APPEND_FAILED");
        return true;
      },
    );

    console.log("audit-envelope.selfcheck: ok");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
