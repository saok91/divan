-- Story 3.8: Secondary Assignment projection + equivalent-overlap reject (FR-12 / NFR-4).
-- Half-open daterange [startDate, endDateExclusive); null end → unbounded open.
-- Equivalence key = (personId, orgUnitId, reasonType, overlapping interval).
-- Prisma cannot express EXCLUDE — raw SQL after CREATE TABLE.
-- Does NOT consume headcount — no headcountApprovalId / consumption columns.
-- Product create/change/end = Epic 4; migration = Epic 6.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "SecondaryAssignment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "reasonType" TEXT NOT NULL,
    "organizationalRoleId" TEXT,
    "jobTitleId" TEXT,
    "ladderId" TEXT,
    "gradeId" TEXT,
    "seniorityId" TEXT,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecondaryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecondaryAssignment_personId_idx" ON "SecondaryAssignment"("personId");
CREATE INDEX "SecondaryAssignment_employmentId_idx" ON "SecondaryAssignment"("employmentId");
CREATE INDEX "SecondaryAssignment_orgUnitId_idx" ON "SecondaryAssignment"("orgUnitId");
CREATE INDEX "SecondaryAssignment_reasonType_idx" ON "SecondaryAssignment"("reasonType");

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_employmentId_fkey"
  FOREIGN KEY ("employmentId") REFERENCES "Employment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_orgUnitId_fkey"
  FOREIGN KEY ("orgUnitId") REFERENCES "OrganizationalUnit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_organizationalRoleId_fkey"
  FOREIGN KEY ("organizationalRoleId") REFERENCES "OrganizationalRole"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_jobTitleId_fkey"
  FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_ladderId_fkey"
  FOREIGN KEY ("ladderId") REFERENCES "Ladder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_gradeId_fkey"
  FOREIGN KEY ("gradeId") REFERENCES "Grade"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_seniorityId_fkey"
  FOREIGN KEY ("seniorityId") REFERENCES "Seniority"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Equivalent-overlap reject: same Person + org target + reason/type + overlapping interval.
-- Adjacent half-open intervals (A.end = B.start) do not &&.
ALTER TABLE "SecondaryAssignment"
  ADD CONSTRAINT "SecondaryAssignment_equivalent_effective_excl"
  EXCLUDE USING gist (
    "personId" WITH =,
    "orgUnitId" WITH =,
    "reasonType" WITH =,
    daterange("startDate", "endDateExclusive", '[)') WITH &&
  );
