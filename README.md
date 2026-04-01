# Sirahos (BizFlow Suite)

An all-in-one business management platform for startups — covering billing, project management, HR, accounting, and CRM in a single application.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Pages & Routes](#pages--routes)
- [Components](#components)
- [State Management](#state-management)
- [Authentication & Authorization](#authentication--authorization)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Styling & Theming](#styling--theming)
- [Types & Interfaces](#types--interfaces)
- [Integrations](#integrations)
- [Testing](#testing)
- [Scripts & Commands](#scripts--commands)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

---

## Overview

Sirahos is a production-ready business management platform designed for startups. It provides:

- **Billing & Invoicing** — Create invoices with GST, track payments, EMI support
- **Accounting** — Ledger management, expense tracking, financial reports
- **Project Management** — Projects, tasks, and bug tracking with role-based views
- **Team Management** — Employee directory, attendance, leaves, fines
- **Sales CRM** — Lead management with notes and filtering
- **Financial Reporting** — Revenue analytics, GST summaries, expense breakdowns, top clients
- **Dashboard** — Real-time overview with charts and key metrics

**Target Users:** Startup founders, accountants, project managers, and team members.

---

## Tech Stack

### Frontend

| Technology             | Purpose                        |
| ---------------------- | ------------------------------ |
| React 18.3             | UI framework                   |
| TypeScript 5.8         | Type safety                    |
| Vite 5.4               | Build tool & dev server        |
| React Router DOM 6.30  | Client-side routing            |
| TailwindCSS 3.4        | Utility-first styling          |
| Shadcn/ui (Radix UI)   | Pre-built UI component library |
| React Query 5.83       | Server state & caching         |
| React Hook Form 7.61   | Form handling                  |
| Zod 3.25               | Schema validation              |
| Axios 1.7              | HTTP client                    |
| Recharts 2.15          | Data visualization / charts    |
| Framer Motion 12.37    | Animations                     |
| Sonner 1.7             | Toast notifications            |
| Lucide React 0.462     | Icon library                   |
| Date-fns 3.6           | Date utilities                 |
| Next-themes 0.3        | Dark mode support              |

### Backend

| Technology             | Purpose                        |
| ---------------------- | ------------------------------ |
| Express 4.21           | Web server framework           |
| Prisma 5.22            | ORM & database client          |
| PostgreSQL (Supabase)  | Primary database               |
| JSON Web Tokens 9.0    | Authentication tokens          |
| bcryptjs 2.4           | Password hashing               |
| Helmet 8.0             | Security headers               |
| Express Rate Limit 7.4 | Rate limiting                  |
| Node-cron 4.2          | Scheduled background jobs      |
| Morgan 1.10            | HTTP request logging           |
| CORS 2.8               | Cross-origin handling          |

### Testing & Tooling

| Technology           | Purpose              |
| -------------------- | -------------------- |
| Vitest 3.2           | Unit testing         |
| Testing Library      | Component testing    |
| Playwright 1.57      | E2E testing          |
| ESLint 9.32          | Code linting         |

---

## Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Vercel         │       │   Render          │       │   Supabase       │
│   (Frontend)     │──────▶│   (API Server)    │──────▶│   (PostgreSQL)   │
│   React SPA      │       │   Express + Prisma│       │   Database       │
│   Port 8080      │       │   Port 3001/10000 │       │                  │
└─────────────────┘       └──────────────────┘       └──────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Evolution API   │
                          │  (WhatsApp)      │
                          └──────────────────┘
```

- **Monorepo** with frontend (root) and backend (`server/`) in a single repository
- **Vite dev server** proxies `/api` requests to Express during development
- **JWT-based auth** with access tokens (15 min) and refresh tokens (7 days)

---

## Project Structure

```
bizflow-suite/
├── src/                          # Frontend (React)
│   ├── components/               # React components
│   │   ├── ui/                   # Shadcn/ui library (48 components)
│   │   ├── projects/             # Role-based project views
│   │   ├── attendance/           # Attendance views
│   │   ├── AppSidebar.tsx        # Main navigation sidebar
│   │   ├── PageHeader.tsx        # Page title & breadcrumbs
│   │   ├── CommandBar.tsx        # Command palette (Cmd+K)
│   │   ├── NotificationBell.tsx  # Notification center
│   │   ├── ProtectedRoute.tsx    # Route guard by role
│   │   ├── ErrorBoundary.tsx     # Error fallback UI
│   │   ├── ThemeProvider.tsx     # Dark mode provider
│   │   └── SessionExpiredModal.tsx
│   ├── pages/                    # Page components (16 pages)
│   │   ├── Index.tsx             # Dashboard
│   │   ├── Invoices.tsx          # Invoice management
│   │   ├── Customers.tsx         # Customer database
│   │   ├── Ledger.tsx            # Accounting ledger
│   │   ├── Employees.tsx         # Employee management
│   │   ├── Expenses.tsx          # Expense tracking
│   │   ├── Projects.tsx          # Project management
│   │   ├── Attendance.tsx        # Attendance tracking
│   │   ├── Notes.tsx             # General notes
│   │   ├── Leads.tsx             # Sales leads
│   │   ├── LeadDetail.tsx        # Individual lead detail
│   │   ├── Profile.tsx           # User profile
│   │   ├── SettingsPage.tsx      # System settings
│   │   ├── Login.tsx             # Authentication
│   │   └── NotFound.tsx          # 404 page
│   ├── contexts/                 # React context providers
│   │   ├── AuthContext.tsx       # Auth state & user management
│   │   └── ProjectContext.tsx    # Project/task/bug state
│   ├── hooks/                    # Custom hooks
│   │   ├── useDebounce.ts        # Input debouncing
│   │   ├── use-mobile.tsx        # Mobile breakpoint detection
│   │   └── use-toast.ts          # Toast notifications
│   ├── lib/                      # Utilities
│   │   ├── api.ts                # Axios client, all API modules, types
│   │   └── utils.ts              # General utilities
│   ├── test/                     # Test setup & examples
│   ├── App.tsx                   # Root component & routing
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles & Tailwind imports
│
├── server/                       # Backend (Express)
│   ├── src/
│   │   ├── routes/               # API route handlers
│   │   │   ├── auth.ts           # Login, logout, refresh, me
│   │   │   ├── users.ts          # User CRUD & profile
│   │   │   ├── projects.ts       # Project management
│   │   │   ├── tasks.ts          # Task management
│   │   │   ├── bugs.ts           # Bug tracking
│   │   │   ├── invoices.ts       # Billing & payments
│   │   │   ├── customers.ts      # Customer database
│   │   │   ├── ledger.ts         # Accounting ledger
│   │   │   ├── expenses.ts       # Expense tracking
│   │   │   ├── reports.ts        # Financial reports
│   │   │   ├── attendance.ts     # Attendance records
│   │   │   ├── leaves.ts         # Leave management
│   │   │   ├── notes.ts          # General notes
│   │   │   ├── leads.ts          # Sales leads
│   │   │   ├── fines.ts          # Fine management
│   │   │   └── admin.ts          # Admin operations
│   │   ├── middleware/           # Express middleware
│   │   │   ├── auth.ts           # JWT verification
│   │   │   ├── rbac.ts           # Role-based access control
│   │   │   ├── audit.ts          # Audit logging
│   │   │   ├── validate.ts       # Request validation (Zod)
│   │   │   └── timeout.ts        # Request timeout
│   │   ├── lib/                  # Server utilities
│   │   │   ├── prisma.ts         # Prisma client init
│   │   │   ├── cache.ts          # In-memory caching
│   │   │   └── scheduler.ts      # Cron job scheduler
│   │   └── index.ts              # Server entry point
│   └── prisma/
│       ├── schema.prisma         # Database schema
│       └── migrations/           # Database migrations
│
├── vite.config.ts                # Vite configuration
├── tailwind.config.ts            # Tailwind theming
├── tsconfig.json                 # TypeScript config
├── vitest.config.ts              # Unit test config
├── playwright.config.ts          # E2E test config
├── render.yaml                   # Render deployment blueprint
├── vercel.json                   # Vercel SPA routing
└── package.json                  # Dependencies & scripts
```

---

## Pages & Routes

### Admin-Only Routes

| Path         | Page             | Description                                          |
| ------------ | ---------------- | ---------------------------------------------------- |
| `/`          | Index            | Dashboard — GST info, revenue charts, expense breakdown, fines |
| `/invoices`  | Invoices         | Create/manage invoices with GST, payment tracking, EMI |
| `/customers` | Customers        | Customer database management                         |
| `/ledger`    | Ledger           | Accounting ledger entries                            |
| `/employees` | Employees        | Employee directory, roles, status management         |
| `/expenses`  | Expenses         | Track expenses by category                           |
| `/notes`     | Notes            | General notes and documentation                      |
| `/leads`     | Leads            | Sales leads list with filtering                      |
| `/leads/:id` | LeadDetail       | Individual lead details with notes                   |

### Admin + Project Manager Routes

| Path        | Page         | Description                               |
| ----------- | ------------ | ----------------------------------------- |
| `/settings` | SettingsPage | System settings, company info, user management |

### All Authenticated Users

| Path          | Page       | Description                               |
| ------------- | ---------- | ----------------------------------------- |
| `/profile`    | Profile    | User profile management, password change  |
| `/projects`   | Projects   | Project list with role-specific views     |
| `/attendance` | Attendance | Mark attendance, view records             |

### Public Routes

| Path    | Page     | Description        |
| ------- | -------- | ------------------ |
| `/login`| Login    | Email/password authentication |
| `*`     | NotFound | 404 error page     |

---

## Components

### Layout & Navigation

| Component              | Description                              |
| ---------------------- | ---------------------------------------- |
| `AppSidebar`           | Main sidebar with role-based menu items  |
| `PageHeader`           | Page title and breadcrumb navigation     |
| `CommandBar`           | Command palette triggered by Cmd+K       |
| `NotificationBell`     | Notification center dropdown             |
| `ProtectedRoute`       | Route guard — restricts access by role   |
| `ErrorBoundary`        | Error fallback UI for runtime crashes    |
| `ThemeProvider`        | Dark/light mode context provider         |
| `ThemeToggle`          | Dark mode toggle button                  |
| `SessionExpiredModal`  | Prompts re-login on session timeout      |
| `NavLink`              | Active-state navigation link wrapper     |

### Feature Components

| Component                 | Description                           |
| ------------------------- | ------------------------------------- |
| `OngoingProjects`         | Dashboard widget for active projects  |
| `AdminProjectsView`       | Admin-level project management view   |
| `DeveloperProjectsView`   | Developer's assigned projects view    |
| `LeadProjectsView`        | Team lead's project oversight view    |
| `PMProjectsView`          | Project manager's view                |
| `TesterProjectsView`      | Tester's assigned projects view       |
| `AdminAttendanceView`     | Admin attendance management           |
| `LeadAttendanceView`      | Lead team attendance view             |
| `SelfAttendanceView`      | Personal attendance marking           |

### UI Component Library (Shadcn/ui)

48 pre-built components in `src/components/ui/` including: Accordion, Alert, Avatar, Badge, Button, Calendar, Card, Carousel, Chart, Checkbox, Command, Dialog, Drawer, Dropdown Menu, Form, Input, Label, Pagination, Popover, Progress, Select, Sheet, Sidebar, Skeleton, Spinner, Switch, Table, Tabs, Textarea, Toggle, Tooltip, and more.

---

## State Management

### Authentication State — `AuthContext`

```
AuthContext (React Context)
├── user          — Current logged-in user
├── allUsers      — All users (admin)
├── login()       — Authenticate user
├── logout()      — Clear session
├── addUser()     — Create new user
└── toggleStatus()— Enable/disable user
```

Hook: `useAuth()`

### Project State — `ProjectContext`

```
ProjectContext (React Context + React Query)
├── projects      — All projects
├── tasks         — Tasks per project
├── bugs          — Bugs per project
├── CRUD mutations for projects, tasks, bugs
└── Assignment mutations
```

Hook: `useProjects()`

### Server State — React Query

- **Stale time:** 30 seconds
- **Cache time:** 10 minutes
- Auto-refresh on window focus
- Automatic retry on failure

### Token Storage

- **Access token** → `sessionStorage` (cleared on browser close)
- **Refresh token** → `localStorage` (persistent across sessions)

---

## Authentication & Authorization

### Login Flow

```
User enters credentials
       │
       ▼
POST /api/auth/login
       │
       ▼
Backend validates with bcrypt
       │
       ▼
Returns accessToken + refreshToken + user
       │
       ▼
Tokens stored (session/local storage)
       │
       ▼
Redirect to role-based home route
```

### Token Lifecycle

- **Access Token (JWT):** 15-minute expiry, stored in `sessionStorage`
- **Refresh Token (JWT):** 7-day expiry, stored in `localStorage`
- **Auto-refresh:** Axios interceptor calls `/api/auth/refresh` on 401 responses
- **Session expiry:** Custom `bf:session-expired` event triggers logout modal

### Roles & Permissions

| Role              | Access                                              |
| ----------------- | --------------------------------------------------- |
| `ADMIN`           | Full access to all pages and features               |
| `PROJECT_MANAGER` | Projects, settings, profile, attendance             |
| `LEAD`            | Projects, profile, attendance (team view)           |
| `DEVELOPER`       | Projects, profile, attendance (self view)           |
| `TESTER`          | Projects, profile, attendance (self view)           |

### Security Features

- Brute-force protection: 5 login attempts per 15 minutes (per account)
- Rate limiting on all API endpoints
- Helmet security headers
- CORS restriction to allowed origins

---

## API Reference

All endpoints are prefixed with `/api`.

| Module       | Endpoint Base      | Key Operations                              |
| ------------ | ------------------ | ------------------------------------------- |
| Auth         | `/api/auth`        | `POST login`, `POST logout`, `POST refresh`, `GET me` |
| Users        | `/api/users`       | CRUD, profile update, assignable users list |
| Projects     | `/api/projects`    | CRUD, assign PM/Lead, manage members        |
| Tasks        | `/api/tasks`       | CRUD, assignment, reassignment history      |
| Bugs         | `/api/bugs`        | CRUD, assignment, status transitions        |
| Invoices     | `/api/invoices`    | CRUD, payment tracking, EMI management      |
| Customers    | `/api/customers`   | CRUD                                        |
| Ledger       | `/api/ledger`      | Ledger entry management                     |
| Expenses     | `/api/expenses`    | CRUD with categories                        |
| Reports      | `/api/reports`     | Revenue summaries, GST, top clients         |
| Attendance   | `/api/attendance`  | Mark attendance, summaries, records         |
| Leaves       | `/api/leaves`      | Leave requests, balance management          |
| Notes        | `/api/notes`       | CRUD                                        |
| Leads        | `/api/leads`       | Leads with notes, filtering, stats          |
| Fines        | `/api/fines`       | Fine management                             |
| Admin        | `/api/admin`       | Data purge operations                       |

### Middleware Pipeline

Every request passes through:

1. **Helmet** — Security headers
2. **CORS** — Origin validation
3. **Rate Limiter** — Request throttling
4. **Morgan** — Request logging
5. **Auth Middleware** — JWT verification (protected routes)
6. **RBAC Middleware** — Role-based access check
7. **Validation Middleware** — Zod schema validation
8. **Timeout Middleware** — Request timeout enforcement
9. **Audit Middleware** — Action logging

---

## Database Schema

Managed by **Prisma ORM**. Schema is defined in `server/prisma/schema.prisma`.

### Core Models

| Model            | Description                    | Key Relations                |
| ---------------- | ------------------------------ | ---------------------------- |
| `User`           | System users with roles        | Projects, Tasks, Bugs, Attendance |
| `Project`        | Projects with status tracking  | PM, Lead, Members, Tasks, Bugs |
| `Task`           | Work items within projects     | Assignee, Project            |
| `Bug`            | Bug reports within projects    | Reporter, Assignee, Project  |
| `Invoice`        | Invoices with GST support      | Customer, Items, Payments    |
| `InvoiceItem`    | Line items on invoices         | Invoice                      |
| `Payment`        | Payment records (full/EMI)     | Invoice                      |
| `Customer`       | Customer directory             | Invoices                     |
| `LedgerEntry`    | Accounting ledger entries      | —                            |
| `Expense`        | Categorized expenses           | —                            |
| `AttendanceRecord` | Daily attendance logs        | User                         |
| `LeaveRequest`   | Employee leave applications    | User                         |
| `Note`           | General notes                  | —                            |
| `Lead`           | Sales leads                    | Lead Notes                   |
| `Fine`           | Employee fines                 | User                         |

---

## Styling & Theming

### Tailwind CSS

- Utility-first approach with custom theme extensions
- Responsive breakpoints for mobile/tablet/desktop
- Dark mode via `next-themes` (class-based toggling)

### Color Palette

| Token       | Value                       | Usage               |
| ----------- | --------------------------- | -------------------- |
| Primary     | Indigo `hsl(250, 75%, 58%)` | Buttons, links, accents |
| Secondary   | Slate grays                 | Text, backgrounds    |
| Money-in    | Teal `#20b981`              | Revenue, income      |
| Money-out   | Red `#ef4444`               | Expenses, losses     |
| Warning     | Amber `#fbbf24`             | Alerts, overdue      |

### Animations

- **Framer Motion** for page transitions and complex animations
- **Tailwind animate** for CSS-based transitions
- Custom keyframes: `accordion-down`, `accordion-up`, `pulse-subtle`

---

## Types & Interfaces

All types are exported from `src/lib/api.ts`.

### User & Roles

```typescript
type UserRole = "ADMIN" | "PROJECT_MANAGER" | "LEAD" | "DEVELOPER" | "TESTER";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  reportsToId?: string;
  reportsTo?: AppUser;
}
```

### Financial

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: Customer;
  items: InvoiceItem[];
  gstRate: number;
  status: "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";
  paymentType: "FULL" | "EMI";
  payments: Payment[];
}

interface Customer {
  id: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
}

type ExpenseCategory = "OFFICE" | "SOFTWARE" | "TRAVEL" | "SALARY" | "MARKETING" | "UTILITIES" | "OTHER";
```

### Project Management

```typescript
type ProjectStatus = "PLANNING" | "ACTIVE" | "PAUSED" | "REVIEW" | "COMPLETED";
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type BugSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type BugStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "IN_REVIEW" | "VERIFIED" | "CLOSED";
```

### HR & Attendance

```typescript
type AttendanceStatus = "PRESENT" | "ABSENT" | "HALFDAY" | "WFH";
type LeaveType = "CASUAL" | "SICK" | "EARNED" | "UNPAID";
type LeaveStatus = "REQUESTED" | "IN_PROCESS" | "APPROVED" | "REJECTED";
```

---

## Integrations

| Service          | Purpose                              | Config Keys                          |
| ---------------- | ------------------------------------ | ------------------------------------ |
| **Supabase**     | PostgreSQL database hosting          | `DATABASE_URL`, `DIRECT_URL`         |
| **Supabase (Leads)** | Separate CRM/leads database     | `LEADS_SUPABASE_URL`, `LEADS_SUPABASE_KEY` |
| **Evolution API**| WhatsApp messaging notifications     | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` |
| **Vercel**       | Frontend hosting & SPA routing       | `VITE_API_BASE_URL`                  |
| **Render**       | Backend API hosting                  | `render.yaml` blueprint              |

---

## Testing

### Unit Tests (Vitest)

```bash
npm run test          # Run tests once
npm run test:watch    # Watch mode
```

- **Config:** `vitest.config.ts`
- **Environment:** jsdom
- **Setup:** `src/test/setup.ts`
- **Pattern:** `src/**/*.{test,spec}.{ts,tsx}`

### E2E Tests (Playwright)

- **Config:** `playwright.config.ts`
- **Fixture:** `playwright-fixture.ts`

### Component Tests (Testing Library)

- `@testing-library/react` for rendering
- `@testing-library/jest-dom` for DOM assertions

---

## Scripts & Commands

### Development

```bash
npm run dev           # Start frontend + backend concurrently
npm run dev:web       # Frontend only (Vite, port 8080)
npm run dev:api       # Backend only (Express, port 3001)
```

### Build

```bash
npm run build         # Production build (optimized, code-split)
npm run build:dev     # Development build (with source maps)
```

### Database

```bash
npm run db:push       # Push schema changes (development)
npm run db:migrate    # Create a new migration
npm run db:seed       # Seed the database with initial data
npm run db:studio     # Open Prisma Studio (GUI)
```

### Quality

```bash
npm run lint          # Run ESLint
npm run test          # Run unit tests
npm run test:watch    # Run tests in watch mode
```

---

## Deployment

### Production Setup

| Layer    | Service  | URL Pattern                      |
| -------- | -------- | -------------------------------- |
| Frontend | Vercel   | `https://sirahos.vercel.app`     |
| Backend  | Render   | `https://sirahos-api.onrender.com` |
| Database | Supabase | Managed PostgreSQL               |

### Deploy Steps

1. **Database:** Ensure Supabase project is configured with `schema.prisma`
2. **Backend:** Deploy to Render using `render.yaml` blueprint
3. **Frontend:** Deploy to Vercel — auto-detects Vite project
4. **Health Check:** Backend exposes `/health` endpoint

---

## Environment Variables

### Frontend (`.env`)

```
VITE_API_BASE_URL=https://sirahos-api.onrender.com/api
```

### Backend (`server/.env`)

```
NODE_ENV=production
DATABASE_URL=postgres://...          # Supabase pooled connection
DIRECT_URL=postgres://...            # Supabase direct connection
JWT_ACCESS_SECRET=<64-byte-hex>      # Access token signing key
JWT_REFRESH_SECRET=<64-byte-hex>     # Refresh token signing key
CORS_ORIGIN=https://sirahos.vercel.app
LEADS_SUPABASE_URL=...               # Leads database URL
LEADS_SUPABASE_KEY=...               # Leads database key
EVOLUTION_API_URL=...                # WhatsApp API URL
EVOLUTION_API_KEY=...                # WhatsApp API key
EVOLUTION_INSTANCE=...               # WhatsApp instance name
```

---

## Workflow Summary

```
1. User logs in → JWT issued (access + refresh tokens)
2. Frontend loads role-based dashboard/routes
3. React Query fetches data from Express API
4. Express validates request (auth → RBAC → Zod)
5. Prisma queries PostgreSQL on Supabase
6. Response cached by React Query (30s stale, 10min cache)
7. UI updates with Shadcn components + Tailwind styling
8. Token auto-refreshes on 401 → seamless session continuity
```
