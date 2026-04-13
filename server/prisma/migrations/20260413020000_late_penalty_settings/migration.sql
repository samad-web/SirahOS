-- AlterTable: add late penalty settings to companies
ALTER TABLE "companies" ADD COLUMN "latePenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "companies" ADD COLUMN "lateClockInTime" TEXT NOT NULL DEFAULT '09:30';

-- AlterTable: add type to fines (MANUAL vs LATE_CLOCK_IN)
ALTER TABLE "fines" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'MANUAL';
