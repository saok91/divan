/**
 * Self-check for correction-case domain helpers (Story 7.5 / FR-53).
 * Run: pnpm --filter @divan/audit-envelope selfcheck:correction-case
 */
import assert from "node:assert/strict";

import {
  CORRECTION_CASE_ACTIVE_STATUSES,
  CORRECTION_CASE_CLOSE_PERMISSION,
  CORRECTION_CASE_DATA_CATEGORY,
  CORRECTION_CASE_DECIDE_PERMISSION,
  CORRECTION_CASE_READ_PERMISSION,
  CORRECTION_CASE_WRITE_PERMISSION,
  CorrectionCaseError,
  DEV_DEMO_CATEGORIES,
  DEV_DEMO_POLICY,
  MSG_CORRECTION_CASE_ALLOWLIST_UNSET_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
  MSG_CORRECTION_CASE_DENIED_FA,
  MSG_CORRECTION_CASE_SELF_REVIEW_BLOCKED_FA,
  assertCorrectionCaseSelfReviewAllowed,
  assertCorrectionCaseTransition,
  canTransitionCorrectionCase,
  evaluateAuthorization,
  hasActiveContentPrefix,
  inspectCorrectionCaseAttachment,
  isBreachedPresentation,
  isCategoryGrantable,
  isDeadlineBreached,
  loadCorrectionCaseAttachmentPolicy,
  minimizeAttachmentFilename,
} from "./index";

function main() {
  assert.equal(MSG_CORRECTION_CASE_DENIED_FA, "دسترسی ندارید.");
  assert.equal(CORRECTION_CASE_READ_PERMISSION, "correction.case.read");
  assert.equal(CORRECTION_CASE_WRITE_PERMISSION, "correction.case.write");
  assert.equal(CORRECTION_CASE_DECIDE_PERMISSION, "correction.case.decide");
  assert.equal(CORRECTION_CASE_CLOSE_PERMISSION, "correction.case.close");
  assert.equal(CORRECTION_CASE_DATA_CATEGORY, "correction.case");

  assert.equal(isCategoryGrantable(DEV_DEMO_CATEGORIES, "health"), false);
  assert.equal(
    isCategoryGrantable(DEV_DEMO_CATEGORIES, CORRECTION_CASE_DATA_CATEGORY),
    true,
  );

  for (const [perm, action] of [
    [CORRECTION_CASE_READ_PERMISSION, "read"],
    [CORRECTION_CASE_WRITE_PERMISSION, "write"],
    [CORRECTION_CASE_DECIDE_PERMISSION, "write"],
    [CORRECTION_CASE_CLOSE_PERMISSION, "write"],
  ] as const) {
    const allow = evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
      permission: perm,
      dataCategory: CORRECTION_CASE_DATA_CATEGORY,
      action,
      organizationalScope: "org:selfcheck",
    });
    assert.equal(allow, "allow", `${perm}×${action}`);
  }

  // SoD: audit/ops/trust must not grant correction.case
  for (const perm of [
    "audit.investigate",
    "ops.health.read",
    "audit.trust.review",
  ]) {
    assert.equal(
      evaluateAuthorization(DEV_DEMO_POLICY, DEV_DEMO_CATEGORIES, {
        permission: perm,
        dataCategory: CORRECTION_CASE_DATA_CATEGORY,
        action: "read",
        organizationalScope: "org:selfcheck",
      }),
      "deny",
      perm,
    );
  }

  assert.equal(canTransitionCorrectionCase("open", "in_progress"), true);
  assert.equal(canTransitionCorrectionCase("pending_decision", "approved"), true);
  assert.equal(canTransitionCorrectionCase("open", "closed"), false);
  assert.equal(canTransitionCorrectionCase("breached", "approved"), true);
  assert.equal(canTransitionCorrectionCase("closed", "open"), false);

  let threw = false;
  try {
    assertCorrectionCaseTransition("closed", "open");
  } catch (e) {
    threw = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_INVALID_TRANSITION");
  }
  assert.equal(threw, true);

  assert.ok(CORRECTION_CASE_ACTIVE_STATUSES.includes("open"));
  assert.equal(CORRECTION_CASE_ACTIVE_STATUSES.includes("breached"), false);

  const past = {
    deadlineAt: "2020-01-01T00:00:00.000Z",
    status: "open" as const,
  };
  assert.equal(isDeadlineBreached(past, new Date("2026-07-29T00:00:00Z")), true);
  assert.equal(isBreachedPresentation(past, new Date("2026-07-29T00:00:00Z")), true);
  assert.equal(
    isBreachedPresentation(
      { ...past, status: "breached" },
      new Date("2026-07-29T00:00:00Z"),
    ),
    true,
  );
  assert.equal(
    isBreachedPresentation(
      { deadlineAt: "2099-01-01T00:00:00.000Z", status: "open" },
      new Date("2026-07-29T00:00:00Z"),
    ),
    false,
  );

  threw = false;
  try {
    assertCorrectionCaseSelfReviewAllowed("acct-1", "acct-1");
  } catch (e) {
    threw = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_SELF_REVIEW_BLOCKED");
    assert.equal(e.messageFa, MSG_CORRECTION_CASE_SELF_REVIEW_BLOCKED_FA);
  }
  assert.equal(threw, true);
  assertCorrectionCaseSelfReviewAllowed("acct-1", "acct-2");

  assert.equal(hasActiveContentPrefix("=CMD"), true);
  assert.equal(hasActiveContentPrefix("hello"), false);
  assert.equal(minimizeAttachmentFilename("../../etc/passwd.exe"), "passwd.exe");

  // Attachment fixtures: allowed / rejected / quarantined
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const allowed = inspectCorrectionCaseAttachment({
    clientFilename: "letter.pdf",
    bytes: pdfBytes,
  });
  assert.equal(allowed.status, "allowed");
  assert.equal(allowed.contentTypeDetected, "application/pdf");
  assert.equal(allowed.previewAllowed, true);

  const exe = inspectCorrectionCaseAttachment({
    clientFilename: "malware.exe",
    bytes: pdfBytes,
  });
  assert.equal(exe.status, "rejected");
  assert.equal(exe.reasonFa, MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA);

  const zip = inspectCorrectionCaseAttachment({
    clientFilename: "docs.pdf",
    bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
  });
  assert.equal(zip.status, "rejected");
  assert.equal(zip.reasonCode, "unauthorized_archive");

  const formulaCsv = inspectCorrectionCaseAttachment({
    clientFilename: "sheet.csv",
    bytes: new TextEncoder().encode("=HYPERLINK(\"http://evil\")\n"),
  });
  assert.equal(formulaCsv.status, "rejected");
  assert.equal(formulaCsv.reasonCode, "active_content");

  const formulaLaterLine = inspectCorrectionCaseAttachment({
    clientFilename: "sheet.csv",
    bytes: new TextEncoder().encode("safe,header\n=CMD|'/c calc'\n"),
  });
  assert.equal(formulaLaterLine.status, "rejected");
  assert.equal(formulaLaterLine.reasonCode, "active_content");

  const quarantine = inspectCorrectionCaseAttachment({
    clientFilename: "letter.pdf",
    bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]),
  });
  assert.equal(quarantine.status, "quarantined");
  assert.equal(quarantine.reasonFa, MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA);

  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
  ]);
  const pngOk = inspectCorrectionCaseAttachment({
    clientFilename: "photo.png",
    bytes: png,
  });
  assert.equal(pngOk.status, "allowed");
  assert.equal(pngOk.previewAllowed, true);

  // Fail-closed when enforce + knobs missing
  threw = false;
  try {
    loadCorrectionCaseAttachmentPolicy({
      DIVAN_CORRECTION_CASE_ENFORCE: "1",
    } as NodeJS.ProcessEnv);
  } catch (e) {
    threw = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_ALLOWLIST_UNSET");
    assert.equal(e.messageFa, MSG_CORRECTION_CASE_ALLOWLIST_UNSET_FA);
  }
  assert.equal(threw, true);

  const policy = loadCorrectionCaseAttachmentPolicy({});
  assert.equal(policy.enforceConfigured, false);
  assert.ok(policy.maxBytes > 0);

  console.log("correction-case selfcheck: ok");
}

main();
