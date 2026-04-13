-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateTable
CREATE TABLE "recurring_invoices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextRunAt" DATE NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "paymentType" "PaymentType" NOT NULL DEFAULT 'FULL',
    "emiMonths" INTEGER,
    "dueDays" INTEGER NOT NULL DEFAULT 15,
    "notes" TEXT,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoice_items" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "recurringInvoiceId" TEXT NOT NULL,

    CONSTRAINT "recurring_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_invoices_companyId_idx" ON "recurring_invoices"("companyId");

-- CreateIndex
CREATE INDEX "recurring_invoices_customerId_idx" ON "recurring_invoices"("customerId");

-- CreateIndex
CREATE INDEX "recurring_invoices_status_idx" ON "recurring_invoices"("status");

-- CreateIndex
CREATE INDEX "recurring_invoices_nextRunAt_idx" ON "recurring_invoices"("nextRunAt");

-- AlterTable: link invoices back to their recurring template
ALTER TABLE "invoices" ADD COLUMN "recurringInvoiceId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_recurringInvoiceId_idx" ON "invoices"("recurringInvoiceId");

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_items" ADD CONSTRAINT "recurring_invoice_items_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "recurring_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "recurring_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
