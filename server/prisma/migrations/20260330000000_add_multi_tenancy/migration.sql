-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN' BEFORE 'ADMIN';

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "featureBilling" BOOLEAN NOT NULL DEFAULT true,
    "featureProjects" BOOLEAN NOT NULL DEFAULT true,
    "featureAttendance" BOOLEAN NOT NULL DEFAULT true,
    "featureLeads" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- Add companyId columns (nullable for backward compat)
ALTER TABLE "users" ADD COLUMN "companyId" TEXT;
ALTER TABLE "projects" ADD COLUMN "companyId" TEXT;
ALTER TABLE "tasks" ADD COLUMN "companyId" TEXT;
ALTER TABLE "bug_reports" ADD COLUMN "companyId" TEXT;
ALTER TABLE "customers" ADD COLUMN "companyId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ledger_entries" ADD COLUMN "companyId" TEXT;
ALTER TABLE "expenses" ADD COLUMN "companyId" TEXT;
ALTER TABLE "attendance" ADD COLUMN "companyId" TEXT;
ALTER TABLE "leaves" ADD COLUMN "companyId" TEXT;
ALTER TABLE "notes" ADD COLUMN "companyId" TEXT;
ALTER TABLE "lead_notes" ADD COLUMN "companyId" TEXT;
ALTER TABLE "fines" ADD COLUMN "companyId" TEXT;

-- Seed company for existing data
INSERT INTO "companies" ("id", "name", "slug", "status", "featureBilling", "featureProjects", "featureAttendance", "featureLeads", "createdAt", "updatedAt")
VALUES ('seed-company-sirah', 'Sirah Digital', 'sirah-digital', 'ACTIVE', true, true, true, true, NOW(), NOW());

-- Backfill all existing records with the seed company
UPDATE "users" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "projects" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "tasks" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "bug_reports" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "customers" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "invoices" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "ledger_entries" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "expenses" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "attendance" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "leaves" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "notes" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "lead_notes" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;
UPDATE "fines" SET "companyId" = 'seed-company-sirah' WHERE "companyId" IS NULL;

-- Add foreign key constraints
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fines" ADD CONSTRAINT "fines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
