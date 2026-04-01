-- Add indexes for production performance on frequently filtered columns

-- Users
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_companyId_idx" ON "users"("companyId");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");

-- Customers
CREATE INDEX IF NOT EXISTS "customers_companyId_idx" ON "customers"("companyId");
CREATE INDEX IF NOT EXISTS "customers_status_idx" ON "customers"("status");

-- Invoices
CREATE INDEX IF NOT EXISTS "invoices_companyId_idx" ON "invoices"("companyId");

-- Projects
CREATE INDEX IF NOT EXISTS "projects_companyId_idx" ON "projects"("companyId");

-- Tasks
CREATE INDEX IF NOT EXISTS "tasks_companyId_idx" ON "tasks"("companyId");

-- Bug Reports
CREATE INDEX IF NOT EXISTS "bug_reports_companyId_idx" ON "bug_reports"("companyId");

-- Expenses
CREATE INDEX IF NOT EXISTS "expenses_companyId_idx" ON "expenses"("companyId");
CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses"("date");

-- Ledger Entries
CREATE INDEX IF NOT EXISTS "ledger_entries_companyId_idx" ON "ledger_entries"("companyId");

-- Audit Logs
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
