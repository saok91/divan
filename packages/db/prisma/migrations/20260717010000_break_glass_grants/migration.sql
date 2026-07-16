-- AlterEnum
ALTER TYPE "EntitlementGrantKind" ADD VALUE 'break_glass';

-- CreateEnum
CREATE TYPE "PostUseReviewStatus" AS ENUM ('pending', 'completed', 'not_required');

-- AlterTable
ALTER TABLE "EntitlementGrant" ADD COLUMN "incidentId" TEXT,
ADD COLUMN "purpose" TEXT,
ADD COLUMN "postUseReviewStatus" "PostUseReviewStatus" NOT NULL DEFAULT 'not_required',
ADD COLUMN "postUseReviewedAt" TIMESTAMP(3),
ADD COLUMN "postUseReviewerAccountId" TEXT,
ADD COLUMN "exceptionalExportApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exceptionalPermissionAdminApproved" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "EntitlementGrant_kind_status_idx" ON "EntitlementGrant"("kind", "status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_incidentId_idx" ON "EntitlementGrant"("incidentId");

-- CreateIndex
CREATE INDEX "EntitlementGrant_postUseReviewStatus_status_idx" ON "EntitlementGrant"("postUseReviewStatus", "status");

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_postUseReviewerAccountId_fkey" FOREIGN KEY ("postUseReviewerAccountId") REFERENCES "InternalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
