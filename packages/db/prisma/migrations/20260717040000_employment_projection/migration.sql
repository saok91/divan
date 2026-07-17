-- Story 3.2: Employment projection + concurrency-safe non-overlap (FR-6 / NFR-4).
-- Half-open daterange [startDate, endDateExclusive); null end → unbounded open.
-- Prisma cannot express EXCLUDE — raw SQL after CREATE TABLE.
-- Fallback: if btree_gist unavailable, domain assertNoOverlapWithExisting remains mandatory.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "Employment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "collaborationType" TEXT,
    "terminationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Employment_personId_idx" ON "Employment"("personId");

ALTER TABLE "Employment"
  ADD CONSTRAINT "Employment_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Non-overlap per person: adjacent half-open intervals (A.end = B.start) do not &&.
ALTER TABLE "Employment"
  ADD CONSTRAINT "Employment_person_effective_excl"
  EXCLUDE USING gist (
    "personId" WITH =,
    daterange("startDate", "endDateExclusive", '[)') WITH &&
  );
