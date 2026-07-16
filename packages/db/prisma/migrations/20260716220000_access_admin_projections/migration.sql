-- CreateTable
CREATE TABLE "OrganizationalScope" (
    "id" TEXT NOT NULL,
    "labelFa" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationalScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelFa" TEXT NOT NULL,
    "permissionSetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountOrganizationalScope" (
    "accountId" TEXT NOT NULL,
    "organizationalScopeId" TEXT NOT NULL,

    CONSTRAINT "AccountOrganizationalScope_pkey" PRIMARY KEY ("accountId","organizationalScopeId")
);

-- CreateTable
CREATE TABLE "AccountAccessRole" (
    "accountId" TEXT NOT NULL,
    "accessRoleId" TEXT NOT NULL,

    CONSTRAINT "AccountAccessRole_pkey" PRIMARY KEY ("accountId","accessRoleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermissionSet_name_key" ON "PermissionSet"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_code_key" ON "AccessRole"("code");

-- CreateIndex
CREATE INDEX "AccountOrganizationalScope_organizationalScopeId_idx" ON "AccountOrganizationalScope"("organizationalScopeId");

-- CreateIndex
CREATE INDEX "AccountAccessRole_accessRoleId_idx" ON "AccountAccessRole"("accessRoleId");

-- AddForeignKey
ALTER TABLE "AccessRole" ADD CONSTRAINT "AccessRole_permissionSetId_fkey" FOREIGN KEY ("permissionSetId") REFERENCES "PermissionSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountOrganizationalScope" ADD CONSTRAINT "AccountOrganizationalScope_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InternalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountOrganizationalScope" ADD CONSTRAINT "AccountOrganizationalScope_organizationalScopeId_fkey" FOREIGN KEY ("organizationalScopeId") REFERENCES "OrganizationalScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAccessRole" ADD CONSTRAINT "AccountAccessRole_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InternalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAccessRole" ADD CONSTRAINT "AccountAccessRole_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Story 2.3: InternalAccount ids are Prisma cuid strings, not UUIDs.
-- Keep correlation_id / event id as UUID; store actor as text for attribution.
ALTER TABLE kernel_events
  ALTER COLUMN actor_account_id TYPE TEXT USING actor_account_id::text;
