-- Story 4.2: Mutable Draft working store (FR-15).
-- Non-authoritative — NOT kernel_events. Soft-delete via status=deleted.

CREATE TABLE "PersonnelEventDraft" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "employmentId" TEXT,
    "eventType" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "finalizedEventId" TEXT,
    "idempotencyKey" TEXT,
    "warningAcks" JSONB,
    "overrideEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonnelEventDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PersonnelEventDraft_idempotencyKey_key" ON "PersonnelEventDraft"("idempotencyKey");

CREATE INDEX "PersonnelEventDraft_personId_status_idx" ON "PersonnelEventDraft"("personId", "status");

CREATE INDEX "PersonnelEventDraft_finalizedEventId_idx" ON "PersonnelEventDraft"("finalizedEventId");

CREATE INDEX "PersonnelEventDraft_status_updatedAt_idx" ON "PersonnelEventDraft"("status", "updatedAt");
