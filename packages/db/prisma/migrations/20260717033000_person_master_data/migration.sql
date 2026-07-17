-- Story 3.1: Person master-data projection (FR-5).
-- Distinct from HumanIdentity; no Employment/Assignment tables in this migration.
-- national_id UNIQUE allows multiple NULLs in PostgreSQL (partial uniqueness when present).

CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "personnelCode" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "mobilePhone" TEXT NOT NULL,
    "fatherName" TEXT,
    "birthDate" DATE,
    "gender" TEXT,
    "nationality" TEXT,
    "nationalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Person_personnelCode_key" ON "Person"("personnelCode");

CREATE UNIQUE INDEX "Person_nationalId_key" ON "Person"("nationalId");
