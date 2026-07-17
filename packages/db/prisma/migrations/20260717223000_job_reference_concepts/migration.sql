-- Story 3.6: Independent job reference concepts (FR-10 / AD-3).
-- Five distinct tables — NOT OrgUnit, NOT OrganizationalScope, NOT CoarseRole.
-- Grade belongs to exactly one Ladder (ON DELETE RESTRICT). Seniority has no Grade/Ladder FK.
-- Half-open [startDate, endDateExclusive); deactivate MUST NOT delete rows.
-- Grade.rank is NUMERIC(4,1) for exact half-grades — never floating point.

CREATE TABLE "OrganizationalRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationalRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationalRole_code_key" ON "OrganizationalRole"("code");

CREATE TABLE "JobTitle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobTitle_code_key" ON "JobTitle"("code");

CREATE TABLE "Ladder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ladder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ladder_code_key" ON "Ladder"("code");

CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "ladderId" TEXT NOT NULL,
    "rank" DECIMAL(4,1) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Grade_ladderId_code_key" ON "Grade"("ladderId", "code");

CREATE UNIQUE INDEX "Grade_ladderId_rank_key" ON "Grade"("ladderId", "rank");

CREATE INDEX "Grade_ladderId_idx" ON "Grade"("ladderId");

ALTER TABLE "Grade"
  ADD CONSTRAINT "Grade_ladderId_fkey"
  FOREIGN KEY ("ladderId") REFERENCES "Ladder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Seniority" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seniority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Seniority_code_key" ON "Seniority"("code");
