/**
 * Web selfcheck for audit trust router wiring / mapping (Story 7.4).
 * Run: pnpm --filter @divan/web selfcheck:audit-trust
 */

import assert from "node:assert/strict";

import {
  MSG_AUDIT_APPEND_FAILED_FA,
  MSG_AUDIT_TRUST_SUSPENDED_FA,
  isAuditTrustApiDistinctCode,
} from "@divan/audit-envelope";

import { operationalCopy } from "../../lib/operational-copy";
import { appRouter } from "./root";

function main() {
  assert.ok(appRouter._def.procedures);
  // tRPC v11 nested routers appear on router._def.record
  const record = (appRouter as unknown as { _def: { record: Record<string, unknown> } })
    ._def.record;
  assert.ok(record.auditTrust, "auditTrust router must be registered");
  assert.ok(record.operations, "operations router present");

  assert.equal(isAuditTrustApiDistinctCode("AUDIT_APPEND_FAILED"), true);
  assert.equal(isAuditTrustApiDistinctCode("AUDIT_TRUST_SUSPENDED"), true);
  assert.ok(
    String(MSG_AUDIT_APPEND_FAILED_FA) !==
      String(operationalCopy.accessDeniedTitle),
  );
  assert.ok(
    String(MSG_AUDIT_TRUST_SUSPENDED_FA) !==
      String(operationalCopy.accessDeniedTitle),
  );
  assert.ok(operationalCopy.opsSectionAuditTrust.length > 0);
  assert.ok(operationalCopy.auditTrustSuspendedBanner.length > 0);
  assert.ok(operationalCopy.auditTrustHashChainHonesty.includes("Deferred"));

  console.log("web audit-trust.selfcheck: ok");
}

main();
