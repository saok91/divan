-- Story 3.7: Primary Assignment projection + concurrency-safe non-overlap (FR-11 / NFR-4).
-- Half-open daterange [startDate, endDateExclusive); null end → unbounded open.
-- Prisma cannot express EXCLUDE — raw SQL after CREATE TABLE.
-- Product mutations (Start/Transfer/job-change) = Epic 4. Secondary = Story 3.8.
-- headcountApprovalId deferred — not required here.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "PrimaryAssignment" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "organizationalRoleId" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "ladderId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "seniorityId" TEXT,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrimaryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrimaryAssignment_employmentId_idx" ON "PrimaryAssignment"("employmentId");
CREATE INDEX "PrimaryAssignment_teamId_idx" ON "PrimaryAssignment"("teamId");

ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_employmentId_fkey"
  FOREIGN KEY ("employmentId") REFERENCES "Employment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "OrganizationalUnit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_organizationalRoleId_fkey"
  FOREIGN KEY ("organizationalRoleId") REFERENCES "OrganizationalRole"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_jobTitleId_fkey"
  FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_ladderId_fkey"
  FOREIGN KEY ("ladderId") REFERENCES "Ladder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_gradeId_fkey"
  FOREIGN KEY ("gradeId") REFERENCES "Grade"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_seniorityId_fkey"
  FOREIGN KEY ("seniorityId") REFERENCES "Seniority"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Non-overlap per Employment: adjacent half-open intervals (A.end = B.start) do not &&.
ALTER TABLE "PrimaryAssignment"
  ADD CONSTRAINT "PrimaryAssignment_employment_effective_excl"
  EXCLUDE USING gist (
    "employmentId" WITH =,
    daterange("startDate", "endDateExclusive", '[)') WITH &&
  );
