/**
 * Self-check for audit-envelope: default-deny + sensitive categories +
 * read≠export + omit (Stories 2.1 / 2.2).
 * Run: pnpm --filter @divan/audit-envelope selfcheck
 * Requires DATABASE_URL + kernel_events migration.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createPgPool } from "@divan/db";
import { config as loadEnv } from "dotenv";

import {
  AuthorizationError,
  DEMO_OMIT_FIELD_CATEGORIES,
  DEMO_OMIT_FIXTURE_PAYLOAD,
  DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE,
  DEMO_SENSITIVE_EXPORT_DENY_TUPLE,
  DEMO_SENSITIVE_HR_READ_TUPLE,
  DEMO_SENSITIVE_TUPLE,
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  MSG_ACCESS_DENIED_FA,
  PRODUCTION_SENSITIVE_CATEGORY_HOOKS,
  createAuditEnvelope,
  emptyCategoryRegistry,
  emptyPolicyRegistry,
  evaluateAuthorization,
  isCategoryGrantable,
  loadCategoryRegistry,
  loadPolicyRegistry,
  omitUnauthorizedCategories,
} from "./index";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

async function main() {
  // --- Pure authz (no DB): category gate + policy via evaluateAuthorization ---
  assert.equal(
    evaluateAuthorization(emptyPolicyRegistry(), DEV_DEMO_CATEGORIES, {
      permission: "x",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "z",
    }),
    "deny",
  );

  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: "demo.selfcheck.read",
      dataCategory: "demo.non_hr",
      action: "read",
      organizationalScope: "org:selfcheck",
    }),
    "allow",
  );

  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
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
  assert.equal(
    loadPolicyRegistry({
      AUDIT_ENVELOPE_USE_DEV_FIXTURE: "FALSE",
    }).rules.length,
    0,
  );

  // --- Category registry (Story 2.2) ---
  for (const hook of PRODUCTION_SENSITIVE_CATEGORY_HOOKS) {
    assert.equal(hook.enabled, false, `${hook.id} must default disabled`);
    assert.equal(
      isCategoryGrantable(DEV_DEMO_CATEGORIES, hook.id),
      false,
      `${hook.id} non-grantable in demo registry`,
    );
  }

  assert.equal(
    isCategoryGrantable(DEV_DEMO_CATEGORIES, "demo.sensitive_hr"),
    true,
  );
  assert.equal(isCategoryGrantable(DEV_DEMO_CATEGORIES, "demo.non_hr"), true);
  assert.equal(
    isCategoryGrantable(DEV_DEMO_CATEGORIES, "unknown.category"),
    false,
  );
  assert.equal(
    isCategoryGrantable(emptyCategoryRegistry(), "demo.non_hr"),
    false,
  );

  // Disabled category remains non-grantable even with a rogue policy rule
  const roguePolicy = {
    rules: [
      {
        permission: "rogue.compensation.read",
        dataCategory: "compensation",
        action: "read",
        organizationalScope: "org:any",
      },
    ],
  };
  assert.equal(
    evaluateAuthorization(roguePolicy, DEV_DEMO_CATEGORIES, {
      permission: "rogue.compensation.read",
      dataCategory: "compensation",
      action: "read",
      organizationalScope: "org:any",
    }),
    "deny",
  );

  // Unknown category fail-closed
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: "demo.selfcheck.read",
      dataCategory: "totally.unknown",
      action: "read",
      organizationalScope: "org:selfcheck",
    }),
    "deny",
  );

  // Fail-closed category load
  assert.equal(
    loadCategoryRegistry({
      AUDIT_ENVELOPE_CATEGORY_PATH: "/nonexistent/divan-categories.json",
    }).categories.length,
    0,
  );
  const prodCategories = loadCategoryRegistry({
    NODE_ENV: "production",
  });
  assert.ok(
    prodCategories.categories.length > 0,
    "production must load sensitive hooks (not empty)",
  );
  assert.equal(
    prodCategories.categories.length,
    PRODUCTION_SENSITIVE_CATEGORY_HOOKS.length,
  );
  assert.equal(
    prodCategories.categories.every((c) => c.enabled === false),
    true,
  );
  assert.equal(
    loadCategoryRegistry({
      AUDIT_ENVELOPE_USE_DEV_FIXTURE: "FALSE",
    }).categories.length,
    0,
  );

  // Invalid / duplicate category JSON → empty (fail-closed)
  const catDir = mkdtempSync(join(tmpdir(), "divan-cat-"));
  try {
    const badPath = join(catDir, "bad.json");
    writeFileSync(
      badPath,
      JSON.stringify({ categories: [{ id: "x", enabled: "yes" }] }),
    );
    assert.equal(
      loadCategoryRegistry({ AUDIT_ENVELOPE_CATEGORY_PATH: badPath })
        .categories.length,
      0,
    );
    const dupPath = join(catDir, "dup.json");
    writeFileSync(
      dupPath,
      JSON.stringify({
        categories: [
          { id: "a", enabled: true },
          { id: "a", enabled: false },
        ],
      }),
    );
    assert.equal(
      loadCategoryRegistry({ AUDIT_ENVELOPE_CATEGORY_PATH: dupPath })
        .categories.length,
      0,
    );
  } finally {
    rmSync(catDir, { recursive: true, force: true });
  }

  // read ≠ export: read allow does not imply export
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: DEMO_SENSITIVE_HR_READ_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_HR_READ_TUPLE.dataCategory,
      action: "read",
      organizationalScope: DEMO_SENSITIVE_HR_READ_TUPLE.organizationalScope,
    }),
    "allow",
  );
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.dataCategory,
      action: "export",
      organizationalScope: DEMO_SENSITIVE_EXPORT_DENY_TUPLE.organizationalScope,
    }),
    "deny",
  );
  assert.equal(
    evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.permission,
      dataCategory: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.dataCategory,
      action: "export",
      organizationalScope: DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE.organizationalScope,
    }),
    "allow",
  );

  // Omit helper — unauthorized key absent (not masked)
  const omitted = omitUnauthorizedCategories(
    { ...DEMO_OMIT_FIXTURE_PAYLOAD },
    DEMO_OMIT_FIELD_CATEGORIES,
    new Set(["demo.non_hr"]),
    DEV_DEMO_CATEGORIES,
  );
  assert.equal(omitted.displayName, "نمونه");
  assert.equal(omitted.teamLabel, "تیم الف");
  assert.equal(
    Object.prototype.hasOwnProperty.call(omitted, "compensationHint"),
    false,
  );
  assert.equal(omitted.compensationHint, undefined);

  const full = omitUnauthorizedCategories(
    { ...DEMO_OMIT_FIXTURE_PAYLOAD },
    DEMO_OMIT_FIELD_CATEGORIES,
    new Set(["demo.non_hr", "demo.sensitive_hr"]),
    DEV_DEMO_CATEGORIES,
  );
  assert.equal(full.compensationHint, "SHOULD_OMIT_WHEN_UNAUTHORIZED");

  // Disabled category in allow set must still be omitted
  const disabledInAllow = omitUnauthorizedCategories(
    { ...DEMO_OMIT_FIXTURE_PAYLOAD, salary: 1 },
    { ...DEMO_OMIT_FIELD_CATEGORIES, salary: "compensation" },
    new Set(["demo.non_hr", "compensation"]),
    DEV_DEMO_CATEGORIES,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(disabledInAllow, "salary"),
    false,
  );

  // Unmapped keys pass through (map-completeness is caller's contract)
  const unmapped = omitUnauthorizedCategories(
    { displayName: "x", orphan: "kept" },
    { displayName: "demo.non_hr" },
    new Set(["demo.non_hr"]),
    DEV_DEMO_CATEGORIES,
  );
  assert.equal(unmapped.orphan, "kept");

  const url = process.env.DATABASE_URL?.trim();
  assert.ok(url, "DATABASE_URL required for envelope DB assertions");

  const pool = createPgPool(url);
  const envelope = createAuditEnvelope({
    pool,
    getPolicy: () => DEV_DEMO_POLICY,
    getCategories: () => DEV_DEMO_CATEGORIES,
  });

  try {
    // Controlled allow + access event
    const allowCorr = randomUUID();
    const allowed = await envelope.authorizeOrThrow({
      context: {
        accountId: randomUUID(), // synthetic — FK not enforced on kernel_events
        coarseRole: "system_admin",
        organizationalScopeIds: ["scope:demo"],
        organizationalScopeCodes: ["org:selfcheck"],
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

    // system_admin cannot export without explicit export rule (read≠export)
    const exportDenyCorr = randomUUID();
    await assert.rejects(
      () =>
        envelope.authorizeOrThrow({
          context: {
            accountId: randomUUID(),
            coarseRole: "system_admin",
            organizationalScopeIds: [],
          },
          ...DEMO_SENSITIVE_EXPORT_DENY_TUPLE,
          correlationId: exportDenyCorr,
          sensitive: true,
        }),
      AuthorizationError,
    );
    const exportDenyRows = await pool.query(
      `SELECT result FROM kernel_events WHERE correlation_id = $1::uuid`,
      [exportDenyCorr],
    );
    assert.equal(exportDenyRows.rows[0]?.result, "deny");

    // Explicit export allow + access event (membership required — Story 2.6)
    const exportAllowCorr = randomUUID();
    const exportAllowed = await envelope.authorizeOrThrow({
      context: {
        accountId: randomUUID(),
        coarseRole: "hr_operator",
        organizationalScopeIds: ["scope:demo"],
        organizationalScopeCodes: ["org:selfcheck"],
      },
      ...DEMO_SENSITIVE_EXPORT_ALLOW_TUPLE,
      correlationId: exportAllowCorr,
      sensitive: true,
    });
    assert.ok(exportAllowed.decisionId);
    const exportAllowRows = await pool.query(
      `SELECT result FROM kernel_events WHERE correlation_id = $1::uuid`,
      [exportAllowCorr],
    );
    assert.equal(exportAllowRows.rows[0]?.result, "allow");

    // Policy allow but no membership → deny (Story 2.6)
    await assert.rejects(
      () =>
        envelope.authorizeOrThrow({
          context: {
            accountId: randomUUID(),
            coarseRole: "hr_operator",
            organizationalScopeIds: [],
            organizationalScopeCodes: [],
          },
          permission: "demo.selfcheck.read",
          dataCategory: "demo.non_hr",
          action: "read",
          organizationalScope: "org:selfcheck",
          operation: "demo.selfcheck.no_membership",
          correlationId: randomUUID(),
          sensitive: true,
        }),
      (err: unknown) => {
        assert.ok(err instanceof AuthorizationError);
        assert.equal(err.denyReason, "scope_membership_missing");
        return true;
      },
    );

    // Ambiguous as-of → fail closed
    await assert.rejects(
      () =>
        envelope.authorizeOrThrow({
          context: {
            accountId: randomUUID(),
            coarseRole: "hr_operator",
            organizationalScopeIds: ["scope:demo"],
            organizationalScopeCodes: ["org:selfcheck"],
          },
          permission: "demo.selfcheck.read",
          dataCategory: "demo.non_hr",
          action: "read",
          organizationalScope: "org:selfcheck",
          operation: "demo.selfcheck.ambiguous_asof",
          correlationId: randomUUID(),
          sensitive: true,
          evaluationMode: "as_of",
          asOfDate: "2024-01-01T12:00:00Z",
        }),
      (err: unknown) => {
        assert.ok(err instanceof AuthorizationError);
        assert.ok(err.denyReason?.includes("as_of"));
        return true;
      },
    );

    // Disabled compensation category deny via envelope even with rogue policy
    const disabledEnv = createAuditEnvelope({
      pool,
      getPolicy: () => roguePolicy,
      getCategories: () => DEV_DEMO_CATEGORIES,
    });
    await assert.rejects(
      () =>
        disabledEnv.authorizeOrThrow({
          context: {
            accountId: randomUUID(),
            coarseRole: "hr_admin",
            organizationalScopeIds: [],
          },
          permission: "rogue.compensation.read",
          dataCategory: "compensation",
          action: "read",
          organizationalScope: "org:any",
          operation: "rogue.compensation.read",
          correlationId: randomUUID(),
          sensitive: true,
        }),
      AuthorizationError,
    );

    // Append failure on sensitive path → fail closed (no silent allow)
    const broken = createAuditEnvelope({
      pool: createPgPool("postgresql://invalid:invalid@127.0.0.1:1/none"),
      getPolicy: () => DEV_DEMO_POLICY,
      getCategories: () => DEV_DEMO_CATEGORIES,
    });
    await assert.rejects(
      () =>
        broken.authorizeOrThrow({
          context: {
            accountId: randomUUID(),
            coarseRole: "system_admin",
            organizationalScopeIds: ["scope:demo"],
            organizationalScopeCodes: ["org:selfcheck"],
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
