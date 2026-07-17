-- Story 3.5: Organizational Unit hierarchy (FR-9 / AD-3).
-- Single adjacency table + unitType. OrganizationalScope (authz) is unchanged.
-- Half-open [startDate, endDateExclusive); null end → unbounded open.
-- Deactivate MUST NOT delete rows. Parent delete → Restrict (no cascade-erase).

CREATE TABLE "OrganizationalUnit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "parentId" TEXT,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationalUnit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrganizationalUnit_unitType_check"
      CHECK ("unitType" IN ('LEGAL_ENTITY', 'BUSINESS_UNIT', 'DEPARTMENT', 'TEAM')),
    CONSTRAINT "OrganizationalUnit_parent_presence_check"
      CHECK (
        ("unitType" = 'LEGAL_ENTITY' AND "parentId" IS NULL)
        OR ("unitType" <> 'LEGAL_ENTITY' AND "parentId" IS NOT NULL)
      )
);

CREATE UNIQUE INDEX "OrganizationalUnit_code_key" ON "OrganizationalUnit"("code");

CREATE INDEX "OrganizationalUnit_parentId_idx" ON "OrganizationalUnit"("parentId");

CREATE INDEX "OrganizationalUnit_unitType_idx" ON "OrganizationalUnit"("unitType");

ALTER TABLE "OrganizationalUnit"
  ADD CONSTRAINT "OrganizationalUnit_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "OrganizationalUnit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
