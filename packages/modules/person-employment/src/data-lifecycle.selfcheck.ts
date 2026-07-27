/**
 * Self-check for data lifecycle orchestration helpers (Story 7.3).
 * Pure checks always; optional DB path when DATABASE_URL + 016 applied.
 * Run: pnpm --filter @divan/person-employment selfcheck:data-lifecycle
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  DataLifecycleError,
  MSG_DISPOSAL_BLOCKED_BY_HOLD_FA,
  MSG_LIFECYCLE_METADATA_INCOMPLETE_FA,
  disposalActionForClass,
  parseLifecycleClass,
} from "@divan/audit-envelope";
import { getSharedPgPool } from "@divan/db";

import {
  MSG_DISPOSAL_LIMIT_DISCLOSURE_FA,
  assertNoActiveHoldForArtifact,
  placeHold,
  releaseHold,
} from "./data-lifecycle";
import { isRetentionLifecycleClassComplete } from "./data-dictionary";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

assert.equal(parseLifecycleClass("retain"), "retain");
assert.equal(
  parseLifecycleClass("workforce-master-data retention (AR-DATA)"),
  "retain",
);
assert.equal(parseLifecycleClass("garbage"), null);
assert.equal(isRetentionLifecycleClassComplete("delete_on_end"), true);
assert.equal(isRetentionLifecycleClassComplete("free text only"), false);
assert.equal(disposalActionForClass("anonymize_on_end"), "anonymize");

let incomplete = false;
try {
  disposalActionForClass("not-a-class");
} catch (e) {
  incomplete = true;
  assert.ok(e instanceof DataLifecycleError);
  assert.equal(e.code, "LIFECYCLE_METADATA_INCOMPLETE");
  assert.equal(e.messageFa, MSG_LIFECYCLE_METADATA_INCOMPLETE_FA);
}
assert.equal(incomplete, true);
assert.ok(MSG_DISPOSAL_LIMIT_DISCLOSURE_FA.includes("بازسازی"));

async function optionalDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("data-lifecycle selfcheck: ok (pure; no DATABASE_URL)");
    return;
  }
  const pool = getSharedPgPool(url);
  try {
    await pool.query("SELECT 1 FROM data_lifecycle.legal_hold LIMIT 0");
  } catch {
    console.log(
      "data-lifecycle selfcheck: ok (pure; 016 schema not applied yet)",
    );
    return;
  }

  const correlationId = randomUUID();
  const artifactId = randomUUID();
  const hold = await placeHold(pool, {
    scopeKind: "artifact",
    scopeRef: artifactId,
    reason: "selfcheck hold",
    actorAccountId: "selfcheck-actor",
    correlationId,
  });
  assert.equal(hold.status, "active");

  let blocked = false;
  try {
    await assertNoActiveHoldForArtifact(pool, { artifactId });
  } catch (e) {
    blocked = true;
    assert.ok(e instanceof DataLifecycleError);
    assert.equal(e.code, "DISPOSAL_BLOCKED_BY_HOLD");
    assert.equal(e.messageFa, MSG_DISPOSAL_BLOCKED_BY_HOLD_FA);
  }
  assert.equal(blocked, true);

  const released = await releaseHold(pool, {
    holdId: hold.id,
    actorAccountId: "selfcheck-actor",
    correlationId: randomUUID(),
  });
  assert.equal(released.status, "released");

  await assertNoActiveHoldForArtifact(pool, { artifactId });

  console.log("data-lifecycle selfcheck: ok (pure + db hold gate)");
}

optionalDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
