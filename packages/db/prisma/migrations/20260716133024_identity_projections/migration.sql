-- CreateEnum
CREATE TYPE "CoarseRole" AS ENUM ('hr_operator', 'hr_admin', 'manager', 'audit_reviewer', 'system_admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "HumanIdentity" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "coarseRole" "CoarseRole" NOT NULL,
    "humanIdentityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "accountId" TEXT,
    "usernameAttempted" TEXT,
    "outcome" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalAccount_username_key" ON "InternalAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAccount_humanIdentityId_key" ON "InternalAccount"("humanIdentityId");

-- CreateIndex
CREATE INDEX "AuthAttempt_correlationId_idx" ON "AuthAttempt"("correlationId");

-- CreateIndex
CREATE INDEX "AuthAttempt_occurredAt_idx" ON "AuthAttempt"("occurredAt");

-- AddForeignKey
ALTER TABLE "InternalAccount" ADD CONSTRAINT "InternalAccount_humanIdentityId_fkey" FOREIGN KEY ("humanIdentityId") REFERENCES "HumanIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
