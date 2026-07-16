-- Story 2.6: scope code alias + cross_time_scope grant kind

-- AlterEnum
ALTER TYPE "EntitlementGrantKind" ADD VALUE 'cross_time_scope';

-- AlterTable
ALTER TABLE "OrganizationalScope" ADD COLUMN "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationalScope_code_key" ON "OrganizationalScope"("code");
