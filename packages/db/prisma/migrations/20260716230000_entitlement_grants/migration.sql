-- CreateEnum
CREATE TYPE "EntitlementGrantKind" AS ENUM (
  'sensitive',
  'global',
  'bulk',
  'mass_assignment',
  'standard',
  'role_create',
  'scope_create'
);

-- CreateEnum
CREATE TYPE "EntitlementGrantStatus" AS ENUM (
  'requested',
  'approved',
  'active',
  'expired',
  'revoked',
  'suspended',
  'rejected'
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "subjectAccountId" TEXT NOT NULL,
    "requesterAccountId" TEXT NOT NULL,
    "approverAccountId" TEXT,
    "kind" "EntitlementGrantKind" NOT NULL,
    "status" "EntitlementGrantStatus" NOT NULL DEFAULT 'requested',
    "accessRoleId" TEXT,
    "organizationalScopeId" TEXT,
    "createPayload" JSONB,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "recertifyBy" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntitlementGrant_subjectAccountId_status_idx" ON "EntitlementGrant"("subjectAccountId", "status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_expiresAt_idx" ON "EntitlementGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "EntitlementGrant_recertifyBy_idx" ON "EntitlementGrant"("recertifyBy");

-- CreateIndex
CREATE INDEX "EntitlementGrant_approverAccountId_idx" ON "EntitlementGrant"("approverAccountId");

-- CreateIndex
CREATE INDEX "EntitlementGrant_status_idx" ON "EntitlementGrant"("status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_requesterAccountId_idx" ON "EntitlementGrant"("requesterAccountId");

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_subjectAccountId_fkey" FOREIGN KEY ("subjectAccountId") REFERENCES "InternalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_requesterAccountId_fkey" FOREIGN KEY ("requesterAccountId") REFERENCES "InternalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_approverAccountId_fkey" FOREIGN KEY ("approverAccountId") REFERENCES "InternalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_organizationalScopeId_fkey" FOREIGN KEY ("organizationalScopeId") REFERENCES "OrganizationalScope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
