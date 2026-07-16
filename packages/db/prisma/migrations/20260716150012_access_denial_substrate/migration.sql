-- CreateTable
CREATE TABLE "AccessDenial" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "coarseRole" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'denied',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessDenial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessDenial_correlationId_idx" ON "AccessDenial"("correlationId");

-- CreateIndex
CREATE INDEX "AccessDenial_occurredAt_idx" ON "AccessDenial"("occurredAt");
