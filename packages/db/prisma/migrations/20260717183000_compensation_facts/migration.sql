-- Story 3.4: Compensation & contractual facts projection (FR-8 / AD-3 / NFR-4).
-- Isolated PostgreSQL schema `compensation` owned by @divan/compensation-facts.
-- Half-open daterange [startDate, endDateExclusive); null end → unbounded open.
-- Non-overlap per (personId, factKind). Prisma cannot express EXCLUDE — raw SQL.
-- Fallback: domain assertNoOverlapWithExisting remains mandatory.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS "compensation";

CREATE TABLE "compensation"."CompensationFact" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "employmentId" TEXT,
    "factKind" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "amount" TEXT,
    "components" JSONB,
    "currency" TEXT,
    "changeType" TEXT,
    "notes" TEXT,
    "collaborationType" TEXT,
    "contractType" TEXT,
    "contractingEntity" TEXT,
    "insuringEntity" TEXT,
    "contractReference" TEXT,
    "contractStartDate" DATE,
    "contractEndDateExclusive" DATE,
    "sourceEventId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationFact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompensationFact_factKind_check"
      CHECK ("factKind" IN ('compensation', 'contractual'))
);

CREATE INDEX "CompensationFact_personId_factKind_idx"
  ON "compensation"."CompensationFact"("personId", "factKind");

CREATE INDEX "CompensationFact_personId_idx"
  ON "compensation"."CompensationFact"("personId");

ALTER TABLE "compensation"."CompensationFact"
  ADD CONSTRAINT "CompensationFact_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compensation"."CompensationFact"
  ADD CONSTRAINT "CompensationFact_employmentId_fkey"
  FOREIGN KEY ("employmentId") REFERENCES "Employment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Non-overlap per person + factKind; adjacent half-open (A.end = B.start) do not &&.
ALTER TABLE "compensation"."CompensationFact"
  ADD CONSTRAINT "CompensationFact_person_kind_effective_excl"
  EXCLUDE USING gist (
    "personId" WITH =,
    "factKind" WITH =,
    daterange("startDate", "endDateExclusive", '[)') WITH &&
  );
