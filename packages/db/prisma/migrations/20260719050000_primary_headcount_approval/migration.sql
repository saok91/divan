-- AlterTable: PrimaryAssignment.headcountApprovalId (Story 4.13 / FR-29)
ALTER TABLE "PrimaryAssignment" ADD COLUMN IF NOT EXISTS "headcountApprovalId" TEXT;

CREATE INDEX IF NOT EXISTS "PrimaryAssignment_headcountApprovalId_idx"
  ON "PrimaryAssignment"("headcountApprovalId");
