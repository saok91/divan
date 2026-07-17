-- Story 3.3: Data Dictionary registry (FR-7).
-- Governance of field enablement — not EAV storage for Person MVP approve columns.

CREATE TABLE "DataElement" (
    "elementId" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT,
    "ownerSource" TEXT,
    "format" TEXT,
    "sensitivity" TEXT,
    "access" TEXT,
    "retention" TEXT,
    "export" TEXT,
    "audit" TEXT,
    "categoryId" TEXT,
    "freeTextPurpose" TEXT,
    "lineage" TEXT,
    "personFieldKey" TEXT,
    "labelFa" TEXT NOT NULL,
    "registryVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataElement_pkey" PRIMARY KEY ("elementId")
);

CREATE INDEX "DataElement_enabled_idx" ON "DataElement"("enabled");
CREATE INDEX "DataElement_disposition_idx" ON "DataElement"("disposition");
