-- AlterTable: nullable passwordHash for LDAP-linked accounts (never store directory passwords)
ALTER TABLE "InternalAccount" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: stable external directory identifier (unique, nullable for seeded-only rows)
ALTER TABLE "InternalAccount" ADD COLUMN "externalDirectoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InternalAccount_externalDirectoryId_key" ON "InternalAccount"("externalDirectoryId");
