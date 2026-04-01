# Sirahos API Documentation

Base URL: `/api`

## Authentication

All endpoints except `/api/auth/login` and `/health` require a Bearer token.

### POST /api/auth/login
Login and receive JWT tokens.

**Body:**
```json
{ "email": "user@example.com", "password": "password123" }
```
**Response:** `{ accessToken, refreshToken, user }`

### POST /api/auth/refresh
Rotate refresh token and get new access token.

**Body:** `{ "refreshToken": "..." }`
**Response:** `{ accessToken, refreshToken }`

### POST /api/auth/logout
Revoke refresh token. Requires auth.

**Body:** `{ "refreshToken": "..." }`

### GET /api/auth/me
Get current user profile. Requires auth.

---

## Pagination

All list endpoints support pagination via query params:
- `page` (default: 1)
- `limit` (default: 50, max: 200)

**Response format:**
```json
{ "data": [...], "total": 100, "page": 1, "limit": 50 }
```

---

## Users

### GET /api/users
List all users. **Admin only.**

### GET /api/users/assignable
List active users for assignment dropdowns.

### POST /api/users
Create a user. **Admin only.**

**Body:**
```json
{ "name": "John", "email": "john@co.com", "password": "secret123", "role": "DEVELOPER", "reportsToId": "..." }
```

### PATCH /api/users/:id
Update user details. **Admin only.**

### PATCH /api/users/:id/status
Activate/deactivate user. **Admin only.** Body: `{ "status": "ACTIVE" | "INACTIVE" }`

### PATCH /api/users/:id/reports-to
Reassign manager. **Admin only.** Body: `{ "reportsToId": "..." }`

### DELETE /api/users/:id
Delete user. **Admin only.** Cannot self-delete.

### GET /api/users/profile
Get own profile.

### PATCH /api/users/profile
Update own name/password. Rate limited (5/15min).

**Body:** `{ "name": "...", "currentPassword": "...", "newPassword": "..." }`

---

## Invoices

All invoice endpoints require **Admin** role and **billing** feature flag.

### GET /api/invoices
List invoices. Supports `status` filter + pagination.

### POST /api/invoices
Create invoice.

**Body:**
```json
{
  "customerId": "...", "invoiceNumber": "INV-001",
  "gstRate": 18, "paymentType": "FULL",
  "items": [{ "description": "Service", "quantity": 1, "unitPrice": 1000 }]
}
```

### GET /api/invoices/:id
Get invoice by ID. Includes company ownership check.

### PATCH /api/invoices/:id
Update invoice status/notes. Body: `{ "status": "PAID", "notes": "..." }`

### POST /api/invoices/:id/payments
Record a payment. Automatically recalculates invoice status.

**Body:** `{ "amount": 500, "method": "bank_transfer" }`

---

## Customers

All endpoints require **Admin** role and **billing** feature flag.

### GET /api/customers
List customers with pagination.

### POST /api/customers
Create customer.

### GET /api/customers/:id
Get customer with invoices. Includes company ownership check.

### PATCH /api/customers/:id
Update customer.

---

## Projects

Require **projects** feature flag.

### GET /api/projects
List projects (filtered by role visibility).

### POST /api/projects
Create project. **Admin only.**

### GET /api/projects/:id
Get project with tasks and bugs. Includes company ownership check.

### PATCH /api/projects/:id/assign-pm
Assign PM. **Admin only.**

### PATCH /api/projects/:id/assign-lead
Assign lead. **Admin or PM.**

### POST /api/projects/:id/members
Add member. **Admin, PM, or Lead.**

### DELETE /api/projects/:id/members/:userId
Remove member.

### PATCH /api/projects/:id/status
Update status. **Admin or PM.**

---

## Tasks

Require **projects** feature flag.

### GET /api/tasks
List tasks with pagination. Devs/testers see only assigned tasks.

### POST /api/tasks
Create task. **Lead or above.** Supports hierarchical assignment validation.

### GET /api/tasks/:id
Get task.

### PATCH /api/tasks/:id
Update task. Devs can only update status on assigned tasks.

### PATCH /api/tasks/:id/assign
Reassign task. **Lead or above.**

### GET /api/tasks/:id/history
Get assignment audit trail.

### DELETE /api/tasks/:id
Delete task. **Lead or above.**

---

## Bug Reports

### GET /api/bugs
List bugs with pagination.

### POST /api/bugs
Report bug. **Tester or above** (developers cannot report directly).

### PATCH /api/bugs/:id/assign
Assign bug. **PM or Admin.**

### PATCH /api/bugs/:id/status
Update bug status. Role-based transitions enforced.

---

## Ledger

### GET /api/ledger
List entries with pagination. Supports `category` and `status` filters.

### POST /api/ledger
Create entry. **Admin only.**

### DELETE /api/ledger/:id
Delete entry. **Admin only.**

---

## Expenses

### GET /api/expenses
List expenses with pagination. Supports `category` filter.

### POST /api/expenses
Create expense.

### PATCH /api/expenses/:id
Update expense.

### DELETE /api/expenses/:id
Delete expense.

---

## Reports

All endpoints are **Admin only** with **billing** feature flag. Cached for 5 minutes.

### GET /api/reports/summary
Dashboard KPIs (revenue, expenses, profit, counts).

### GET /api/reports/revenue
Monthly revenue/expenses breakdown (last 12 months).

### GET /api/reports/gst
GST collection grouped by rate.

### GET /api/reports/top-clients
Top 5 clients by revenue.

---

## Attendance

Require **attendance** feature flag.

### GET /api/attendance
List records. Role-based visibility (admin sees all, lead sees team, dev sees self).

### POST /api/attendance
Mark/update own attendance. Body: `{ "date": "2026-03-31", "status": "PRESENT" }`

### GET /api/attendance/summary
Monthly attendance counts.

---

## Leaves

### GET /api/leaves
List leave requests.

### POST /api/leaves
Create leave request.

### PATCH /api/leaves/:id/review
Review leave (approve/reject). Body: `{ "status": "APPROVED", "note": "..." }`

### GET /api/leaves/balance
Get leave balance for a user/year.

---

## Fines

### GET /api/fines
List fines. Admin sees all, others see own.

### POST /api/fines
Create fine. **Admin only.** Cannot fine admins.

### PATCH /api/fines/:id/paid
Toggle paid status. **Admin only.**

### DELETE /api/fines/:id
Delete fine. **Admin only.**

---

## Leads

Require **leads** feature flag. Data sourced from external Supabase database.

### GET /api/leads
List leads with search and filter. Supports pagination.

### GET /api/leads/stats
Summary counts (total, attended, no_show, pending).

### GET /api/leads/filters
Unique filter values for dropdowns.

### GET /api/leads/:id
Get single lead.

### GET /api/leads/:id/notes
List notes for a lead.

### POST /api/leads/:id/notes
Add note.

---

## Admin

All endpoints require **Admin** role.

### GET /api/admin/audit-logs
Retrieve audit logs with pagination. Supports filters: `action`, `resourceType`, `userId`.

### DELETE /api/admin/audit-logs/cleanup
Delete audit logs older than 90 days. Requires `X-Confirm-Purge: CONFIRM` header.

### POST /api/admin/monthly-refresh
Trigger monthly refresh tasks.

### DELETE /api/admin/data/{resource}
Purge data endpoints (customers, projects, ledger, expenses, notes, attendance, all).
Requires `X-Confirm-Purge: CONFIRM` header. Rate limited: 5/15min.

---

## Error Responses

All errors follow this format:
```json
{ "error": "Error message", "errorId": "uuid (for 500s only)" }
```

Validation errors in development include details:
```json
{ "error": "Validation failed", "details": { ... } }
```
In production, validation details are omitted.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 200/15min (prod), 2000/15min (dev) |
| Auth endpoints | 20/15min (prod), 500/15min (dev) |
| Password change | 5/15min |
| Destructive admin ops | 5/15min |
| Per-account login | 5 attempts then 15min lockout |
