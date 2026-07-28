/**
 * Self-check for correction-case orchestration (Story 7.5).
 * Pure checks always; optional DB path when DATABASE_URL + 018 applied.
 * Run: pnpm --filter @divan/person-employment selfcheck:correction-case
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  CorrectionCaseError,
  MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA,
  MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA,
  MSG_CORRECTION_CASE_NOT_FOUND_FA,
  isDeadlineBreached,
} from "@divan/audit-envelope";
import { getSharedPgPool } from "@divan/db";

import {
  closeCorrectionCase,
  decideCorrectionCase,
  escalateOverdueCases,
  getCorrectionCaseAttachmentDownload,
  getCorrectionCaseDetail,
  linkCorrectionCaseOutcome,
  listCorrectionCaseSummaries,
  openCorrectionCase,
  updateCorrectionCaseProgress,
  uploadCorrectionCaseAttachment,
} from "./correction-case";

const rootEnv = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../.env",
);
loadEnv({ path: rootEnv });

assert.equal(
  isDeadlineBreached({
    deadlineAt: "2020-01-01T00:00:00.000Z",
    status: "open",
  }),
  true,
);

async function ensurePerson(
  pool: ReturnType<typeof getSharedPgPool>,
  personId: string,
): Promise<void> {
  const code = `cc${personId.replace(/-/g, "").slice(0, 12)}`;
  await pool.query(
    `INSERT INTO public."Person" (
       id, "personnelCode", "givenName", "familyName", "mobilePhone",
       "createdAt", "updatedAt"
     ) VALUES ($1, $2, 'CC', 'Selfcheck', '09120000000', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [personId, code],
  );
  const check = await pool.query(
    `SELECT 1 FROM public."Person" WHERE id = $1 LIMIT 1`,
    [personId],
  );
  if (!check.rows[0]) {
    throw new Error(`ensurePerson failed for ${personId}`);
  }
}

async function optionalDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("correction-case selfcheck: ok (pure; no DATABASE_URL)");
    return;
  }
  const pool = getSharedPgPool(url);
  try {
    await pool.query("SELECT 1 FROM correction_case.case LIMIT 0");
  } catch {
    console.log(
      "correction-case selfcheck: ok (pure; 018 schema not applied yet)",
    );
    return;
  }

  const owner = `owner-${randomUUID()}`;
  const actor = `actor-${randomUUID()}`;
  const personId = randomUUID();
  await ensurePerson(pool, personId);
  const deadlinePast = new Date(Date.now() - 86_400_000);

  const opened = await openCorrectionCase(pool, {
    requestReference: `REQ-${randomUUID().slice(0, 8)}`,
    authorityVerifiedBy: actor,
    personId,
    ownerAccountId: owner,
    deadlineAt: deadlinePast,
    actorAccountId: actor,
  });
  assert.equal(opened.status, "open");
  assert.ok(opened.requestReference);
  assert.ok(opened.deadlineAt);

  const escalated = await escalateOverdueCases(pool, {
    actorAccountId: actor,
  });
  assert.ok(escalated.some((c) => c.id === opened.id));

  const detail = await getCorrectionCaseDetail(pool, opened.id, {
    actorAccountId: actor,
    escalate: false,
  });
  assert.equal(detail.case.status, "breached");
  assert.equal(detail.breachedPresentation, true);

  await updateCorrectionCaseProgress(pool, {
    caseId: opened.id,
    toStatus: "pending_decision",
    actorAccountId: actor,
  });

  // Self-review: owner cannot decide
  let selfBlocked = false;
  try {
    await decideCorrectionCase(pool, {
      caseId: opened.id,
      decision: "approved",
      decisionReason: "should fail",
      actorAccountId: owner,
    });
  } catch (e) {
    selfBlocked = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_SELF_REVIEW_BLOCKED");
  }
  assert.equal(selfBlocked, true);

  const decided = await decideCorrectionCase(pool, {
    caseId: opened.id,
    decision: "rejected",
    decisionReason: "درخواست خارج از محدوده بود",
    actorAccountId: actor,
  });
  assert.equal(decided.status, "rejected");
  assert.equal(decided.decision, "rejected");

  // Self-review: owner cannot close
  let closeSelfBlocked = false;
  try {
    await closeCorrectionCase(pool, {
      caseId: opened.id,
      closureEvidence: { responseRef: "OWN" },
      actorAccountId: owner,
    });
  } catch (e) {
    closeSelfBlocked = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_SELF_REVIEW_BLOCKED");
  }
  assert.equal(closeSelfBlocked, true);

  const closed = await closeCorrectionCase(pool, {
    caseId: opened.id,
    closureEvidence: { responseRef: "RESP-1" },
    actorAccountId: actor,
  });
  assert.equal(closed.status, "closed");
  assert.ok(closed.closureEvidence);

  // Rejected/constrained remain queryable (no silent delete)
  const listed = await listCorrectionCaseSummaries(pool, {
    actorAccountId: actor,
    personId,
  });
  assert.ok(listed.some((c) => c.id === opened.id && c.status === "closed"));

  // Attachment allow / reject / quarantine / preview / download
  const person2 = randomUUID();
  await ensurePerson(pool, person2);
  const open2 = await openCorrectionCase(pool, {
    requestReference: `REQ-${randomUUID().slice(0, 8)}`,
    authorityVerifiedBy: actor,
    personId: person2,
    ownerAccountId: owner,
    deadlineAt: new Date(Date.now() + 86_400_000),
    actorAccountId: actor,
  });

  const pdfBytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
  ]);
  const { attachment } = await uploadCorrectionCaseAttachment(pool, {
    caseId: open2.id,
    clientFilename: "proof.pdf",
    bytes: pdfBytes,
    actorAccountId: actor,
  });
  assert.equal(attachment.inspectionStatus, "allowed");

  const dl = await getCorrectionCaseAttachmentDownload(pool, {
    attachmentId: attachment.id,
    mode: "download",
    actorAccountId: actor,
  });
  assert.equal(dl.headers["X-Content-Type-Options"], "nosniff");
  assert.match(dl.headers["Content-Disposition"] ?? "", /attachment/);

  const preview = await getCorrectionCaseAttachmentDownload(pool, {
    attachmentId: attachment.id,
    mode: "preview",
    actorAccountId: actor,
  });
  assert.match(preview.headers["Content-Disposition"] ?? "", /inline/);

  let rejected = false;
  try {
    await uploadCorrectionCaseAttachment(pool, {
      caseId: open2.id,
      clientFilename: "bad.exe",
      bytes: pdfBytes,
      actorAccountId: actor,
    });
  } catch (e) {
    rejected = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_ATTACHMENT_REJECTED");
    assert.equal(e.messageFa, MSG_CORRECTION_CASE_ATTACHMENT_REJECTED_FA);
  }
  assert.equal(rejected, true);

  let quarantined = false;
  try {
    await uploadCorrectionCaseAttachment(pool, {
      caseId: open2.id,
      clientFilename: "letter.pdf",
      bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]),
      actorAccountId: actor,
    });
  } catch (e) {
    quarantined = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_ATTACHMENT_QUARANTINED");
    assert.equal(e.messageFa, MSG_CORRECTION_CASE_ATTACHMENT_QUARANTINED_FA);
  }
  assert.equal(quarantined, true);

  // pending_publication_hook honesty — only after decide
  await updateCorrectionCaseProgress(pool, {
    caseId: open2.id,
    toStatus: "in_progress",
    actorAccountId: actor,
  });
  await updateCorrectionCaseProgress(pool, {
    caseId: open2.id,
    toStatus: "pending_decision",
    actorAccountId: actor,
  });
  await decideCorrectionCase(pool, {
    caseId: open2.id,
    decision: "approved",
    decisionReason: "تأیید برای پیوند نتیجه",
    actorAccountId: actor,
  });

  const hook = await linkCorrectionCaseOutcome(pool, {
    caseId: open2.id,
    linkType: "pending_publication_hook",
    targetId: "future-publication",
    actorAccountId: actor,
  });
  assert.equal(hook.linkType, "pending_publication_hook");
  assert.ok(hook.note?.includes("۷٫۶") || hook.note?.includes("انتشار"));

  let missing = false;
  try {
    await getCorrectionCaseDetail(pool, randomUUID(), {
      actorAccountId: actor,
      escalate: false,
    });
  } catch (e) {
    missing = true;
    assert.ok(e instanceof CorrectionCaseError);
    assert.equal(e.code, "CORRECTION_CASE_NOT_FOUND");
    assert.equal(e.messageFa, MSG_CORRECTION_CASE_NOT_FOUND_FA);
  }
  assert.equal(missing, true);

  console.log("correction-case selfcheck: ok (with DB)");
}

optionalDb().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
