/**
 * Axios-based API client with automatic JWT refresh.
 *
 * All requests go to /api/* which Vite proxies to the Express server
 * in development. In production the same origin serves both.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY_ACCESS = "bf_access";
const STORAGE_KEY_REFRESH = "bf_refresh";

export const tokenStorage = {
  getAccess: () => sessionStorage.getItem(STORAGE_KEY_ACCESS),
  getRefresh: () => localStorage.getItem(STORAGE_KEY_REFRESH),
  set: (access: string, refresh: string) => {
    sessionStorage.setItem(STORAGE_KEY_ACCESS, access);
    localStorage.setItem(STORAGE_KEY_REFRESH, refresh);
  },
  clear: () => {
    sessionStorage.removeItem(STORAGE_KEY_ACCESS);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
  },
};

// ─── Session expiry event ─────────────────────────────────────────────────────

export const SESSION_EXPIRED_EVENT = "bf:session-expired";

function emitSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

// ─── Axios instance ───────────────────────────────────────────────────────────

// In production, VITE_API_BASE_URL points to the backend (e.g. https://sirahos-api.onrender.com/api).
// In development, the Vite proxy forwards /api to localhost:3001.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Token refresh interceptor ────────────────────────────────────────────────

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) {
      tokenStorage.clear();
      emitSessionExpired();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      tokenStorage.set(data.accessToken, data.refreshToken);
      processQueue(null, data.accessToken);

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStorage.clear();
      emitSessionExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Typed API helpers ────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }),
  logout: (refreshToken: string) =>
    api.post("/auth/logout", { refreshToken }),
  me: () => api.get<AppUser>("/auth/me"),
};

export const usersApi = {
  list: () => api.get<AppUser[]>("/users"),
  assignable: () => api.get<AppUser[]>("/users/assignable"),
  create: (data: CreateUserPayload) => api.post<AppUser>("/users", data),
  updateStatus: (id: string, status: "ACTIVE" | "INACTIVE") =>
    api.patch<AppUser>(`/users/${id}/status`, { status }),
  update: (id: string, data: Partial<Pick<AppUser, "name" | "email" | "role"> & { reportsToId: string | null }>) =>
    api.patch<AppUser>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  updateReportsTo: (id: string, reportsToId: string | null) =>
    api.patch<AppUser>(`/users/${id}/reports-to`, { reportsToId }),
  profile: () => api.get<UserProfile>("/users/profile"),
  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    api.patch<AppUser>("/users/profile", data),
};

export const projectsApi = {
  list: () => api.get<Project[]>("/projects"),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: CreateProjectPayload) => api.post<Project>("/projects", data),
  assignPm: (id: string, pmId: string) => api.patch<Project>(`/projects/${id}/assign-pm`, { pmId }),
  assignLead: (id: string, leadId: string) => api.patch<Project>(`/projects/${id}/assign-lead`, { leadId }),
  addMember: (id: string, userId: string) => api.post(`/projects/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),
  updateStatus: (id: string, status: string) => api.patch<Project>(`/projects/${id}/status`, { status }),
};

export const tasksApi = {
  list: (projectId?: string) => unwrapPaginated<Task>(api.get("/tasks", { params: projectId ? { projectId } : {} })),
  create: (data: CreateTaskPayload) => api.post<Task>("/tasks", data),
  update: (id: string, data: Partial<Task> & { reassignNote?: string }) => api.patch<Task>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  assignableUsers: (projectId: string) => api.get<AssignableUser[]>("/tasks/assignable-users", { params: { projectId } }),
  reassign: (id: string, data: { assigned_to: string; note?: string }) => api.patch(`/tasks/${id}/assign`, data),
  history: (id: string) => api.get<TaskAssignmentLog[]>(`/tasks/${id}/history`),
};

export const bugsApi = {
  list: (projectId?: string) => unwrapPaginated<BugReport>(api.get("/bugs", { params: projectId ? { projectId } : {} })),
  create: (data: CreateBugPayload) => api.post<BugReport>("/bugs", data),
  assign: (id: string, assignedToId: string) => api.patch<BugReport>(`/bugs/${id}/assign`, { assignedToId }),
  updateStatus: (id: string, status: string, resolution?: string) =>
    api.patch<BugReport>(`/bugs/${id}/status`, { status, resolution }),
};

// ─── Paginated response unwrapper ─────────────────────────────────────────────
// Backend list endpoints return { data: T[], total, page, limit }.
// Unwrap so callers get { data: T[] } (Axios shape) with the array directly.

interface PaginatedResponse<T> { data: T[]; total: number; page: number; limit: number; }

function unwrapPaginated<T>(promise: Promise<{ data: PaginatedResponse<T> }>) {
  return promise.then(res => ({ ...res, data: res.data.data }));
}

export const invoicesApi = {
  list: (status?: string) => unwrapPaginated<Invoice>(api.get("/invoices", { params: status ? { status } : {} })),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  create: (data: unknown) => api.post<Invoice>("/invoices", data),
  update: (id: string, data: unknown) => api.patch<Invoice>(`/invoices/${id}`, data),
  addPayment: (id: string, data: unknown) => api.post(`/invoices/${id}/payments`, data),
};

export const customersApi = {
  list: () => unwrapPaginated<Customer>(api.get("/customers")),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (data: unknown) => api.post<Customer>("/customers", data),
  update: (id: string, data: unknown) => api.patch<Customer>(`/customers/${id}`, data),
};

export const ledgerApi = {
  list: (params?: { category?: string; status?: string }) => unwrapPaginated<LedgerEntry>(api.get("/ledger", { params })),
  create: (data: unknown) => api.post<LedgerEntry>("/ledger", data),
  delete: (id: string) => api.delete(`/ledger/${id}`),
};

export const expensesApi = {
  list: (params?: { category?: string }) => unwrapPaginated<Expense>(api.get("/expenses", { params })),
  create: (data: unknown) => api.post<Expense>("/expenses", data),
  update: (id: string, data: unknown) => api.patch<Expense>(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
};

export const notesApi = {
  list: () => api.get<Note[]>("/notes"),
  create: (data: { title: string; content?: string }) => api.post<Note>("/notes", data),
  update: (id: string, data: { title?: string; content?: string }) => api.patch<Note>(`/notes/${id}`, data),
  delete: (id: string) => api.delete(`/notes/${id}`),
};

export const leadsApi = {
  list: (params?: { search?: string; attendance_status?: string; business_type?: string; lp_name?: string; page?: number; limit?: number }) =>
    api.get<LeadListResponse>("/leads", { params }),
  stats: () => api.get<LeadStats>("/leads/stats"),
  filters: () => api.get<LeadFilters>("/leads/filters"),
  get: (id: string) => api.get<AdLead>(`/leads/${id}`),
  getNotes: (id: string) => api.get<LeadNote[]>(`/leads/${id}/notes`),
  addNote: (id: string, content: string) => api.post<LeadNote>(`/leads/${id}/notes`, { content }),
  updateNote: (id: string, noteId: string, content: string) => api.patch<LeadNote>(`/leads/${id}/notes/${noteId}`, { content }),
  deleteNote: (id: string, noteId: string) => api.delete(`/leads/${id}/notes/${noteId}`),
};

export const finesApi = {
  list: (userId?: string) => api.get<Fine[]>("/fines", { params: userId ? { userId } : {} }),
  summary: () => api.get<FineSummary>("/fines/summary"),
  mySummary: () => api.get<FineUserSummary>("/fines/my-summary"),
  create: (data: { userId: string; amount: number; reason: string }) => api.post<Fine>("/fines", data),
  togglePaid: (id: string, paid: boolean) => api.patch<Fine>(`/fines/${id}/paid`, { paid }),
  delete: (id: string) => api.delete(`/fines/${id}`),
};

export const adminApi = {
  purgeCustomers: () => api.delete("/admin/data/customers"),
  purgeProjects: () => api.delete("/admin/data/projects"),
  purgeLedger: () => api.delete("/admin/data/ledger"),
  purgeExpenses: () => api.delete("/admin/data/expenses"),
  purgeNotes: () => api.delete("/admin/data/notes"),
  purgeAttendance: () => api.delete("/admin/data/attendance"),
  purgeAll: () => api.delete("/admin/data/all"),
};

export const reportsApi = {
  summary: () => api.get<ReportSummary>("/reports/summary"),
  revenue: () => api.get<RevenueMonth[]>("/reports/revenue"),
  gst: () => api.get<Record<string, number>>("/reports/gst"),
  topClients: () => api.get<TopClient[]>("/reports/top-clients"),
};

export const attendanceApi = {
  list: (params?: { userId?: string; year?: number; month?: number }) =>
    api.get<AttendanceRecord[]>("/attendance", { params }),
  mark: (data: { date: string; status: AttendanceStatus; note?: string }) =>
    api.post<AttendanceRecord>("/attendance", data),
  summary: (params?: { userId?: string; year?: number; month?: number }) =>
    api.get<AttendanceSummary>("/attendance/summary", { params }),
};

export const leavesApi = {
  list: (params?: { status?: LeaveStatus; userId?: string }) =>
    api.get<LeaveRequest[]>("/leaves", { params }),
  create: (data: { leaveType: LeaveType; startDate: string; endDate: string; reason: string }) =>
    api.post<LeaveRequest>("/leaves", data),
  review: (id: string, data: { status: "IN_PROCESS" | "APPROVED" | "REJECTED"; note?: string }) =>
    api.patch<LeaveRequest>(`/leaves/${id}/review`, data),
  balance: (params?: { userId?: string; year?: number }) =>
    api.get<LeaveBalance[]>("/leaves/balance", { params }),
  allBalances: () =>
    api.get<UserWithBalances[]>("/leaves/balances/all"),
  assignBalance: (data: { userId: string; leaveType: LeaveType; total: number; year: number }) =>
    api.post<LeaveBalance>("/leaves/balance", data),
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "PROJECT_MANAGER" | "LEAD" | "DEVELOPER" | "TESTER";

export interface CompanyFeatures {
  id: string;
  name: string;
  slug: string;
  featureBilling: boolean;
  featureProjects: boolean;
  featureAttendance: boolean;
  featureLeads: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  initials?: string;
  companyId?: string | null;
  company?: CompanyFeatures | null;
  reportsToId?: string | null;
  reportsTo?: Pick<AppUser, "id" | "name" | "initials" | "role"> | null;
  createdAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AppUser;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  reportsToId?: string;
}

export interface UserProfile extends AppUser {
  updatedAt?: string;
  reportsTo?: Pick<AppUser, "id" | "name" | "initials" | "role"> | null;
  _count?: {
    assignedTasks: number;
    createdTasks: number;
    managedProjects: number;
    leadProjects: number;
    projectMemberships: number;
  };
}

export interface Project {
  id: string;
  name: string;
  client: string;
  description?: string;
  deadline?: string;
  status: "PLANNING" | "ACTIVE" | "PAUSED" | "REVIEW" | "COMPLETED";
  visibility: "PUBLIC" | "PRIVATE";
  pmId?: string;
  leadId?: string;
  pm?: Pick<AppUser, "id" | "name" | "initials" | "role">;
  lead?: Pick<AppUser, "id" | "name" | "initials" | "role">;
  members: { user: Pick<AppUser, "id" | "name" | "initials" | "role">; joinedAt: string }[];
  githubUrl?: string;
  developedBy?: string;
  createdAt: string;
  _count?: { tasks: number; bugs: number };
}

export interface CreateProjectPayload {
  name: string;
  client: string;
  description?: string;
  deadline?: string;
  pmId?: string;
  githubUrl?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: "TASK" | "FEATURE" | "BUG" | "IMPROVEMENT" | "SUBTASK";
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigneeId?: string;
  assignee?: Pick<AppUser, "id" | "name" | "initials" | "role">;
  createdById: string;
  dueDate?: string;
  createdAt: string;
}

export interface CreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  type?: Task["type"];
  priority?: Task["priority"];
  assigneeId?: string;
  dueDate?: string;
}

export interface BugReport {
  id: string;
  projectId: string;
  taskId?: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "IN_REVIEW" | "VERIFIED" | "CLOSED";
  resolution?: string;
  reportedById: string;
  reportedBy?: Pick<AppUser, "id" | "name" | "initials">;
  assignedToId?: string;
  assignedTo?: Pick<AppUser, "id" | "name" | "initials">;
  createdAt: string;
}

export interface CreateBugPayload {
  projectId: string;
  title: string;
  description: string;
  severity?: BugReport["severity"];
  taskId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: Pick<Customer, "id" | "name" | "company" | "email">;
  status: "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";
  gstRate: number;
  paymentType: "FULL" | "EMI";
  emiMonths?: number;
  dueDate?: string;
  notes?: string;
  items: InvoiceItem[];
  payments: Payment[];
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  gstin?: string;
  notes?: string;
  paymentType: "FULL" | "EMI";
  totalAmount?: number;
  monthlyEmi?: number;
  totalMonths?: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  invoices?: Invoice[];
  _count?: { invoices: number };
}

export interface LedgerEntry {
  id: string;
  date: string;
  ref: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
  category?: string;
  status: "PAID" | "PENDING";
  createdAt: string;
}

export type ExpenseCategory = "OFFICE" | "SOFTWARE" | "TRAVEL" | "SALARY" | "MARKETING" | "UTILITIES" | "OTHER";

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentMethod: string;
  receiptNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSummary {
  totalRevenue: number;
  totalInvoiced: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: string;
  totalCustomers: number;
  totalProjects: number;
  pendingInvoices: number;
  overdueInvoices: number;
}

export interface RevenueMonth {
  month: string;
  revenue: number;
  expenses: number;
}

export interface TopClient {
  id: string;
  name: string;
  company?: string;
  revenue: number;
}

// ─── Task Assignment Types ────────────────────────────────────────────────────

export interface AssignableUser {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
}

export interface TaskAssignmentLog {
  id: string;
  taskId: string;
  note?: string;
  assignedAt: string;
  assignedBy: Pick<AppUser, "id" | "name" | "initials" | "role">;
  assignedTo: Pick<AppUser, "id" | "name" | "initials" | "role">;
}

// ─── Ad Lead Types ───────────────────────────────────────────────────────────

export interface AdLead {
  id: string;
  name: string;
  email: string;
  business_type: string;
  country_code: string;
  phone: string;
  full_phone: string | null;
  created_at: string;
  meeting_time: string | null;
  meet_link: string | null;
  website: string | null;
  challenge: string | null;
  automate_process: string | null;
  attendance_status: string | null;
  lp_name: string | null;
}

export interface LeadListResponse {
  items: AdLead[];
  total: number;
  page: number;
  limit: number;
}

export interface LeadStats {
  total: number;
  attended: number;
  no_show: number;
  pending: number;
}

export interface LeadFilters {
  businessTypes: string[];
  attendanceStatuses: string[];
  lpNames: string[];
}

export interface LeadNote {
  id: string;
  leadId: string;
  content: string;
  authorId: string;
  author: Pick<AppUser, "id" | "name" | "initials">;
  createdAt: string;
  updatedAt: string;
}

// ─── Attendance & Leave Types ─────────────────────────────────────────────────

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALFDAY" | "WFH";
export type LeaveType        = "CASUAL" | "SICK" | "EARNED" | "UNPAID";
export type LeaveStatus      = "REQUESTED" | "IN_PROCESS" | "APPROVED" | "REJECTED";

export interface AttendanceRecord {
  id:       string;
  date:     string;
  status:   AttendanceStatus;
  markedAt: string;
  note?:    string;
  userId:   string;
  user:     Pick<AppUser, "id" | "name" | "initials" | "role">;
}

export interface AttendanceSummary {
  PRESENT: number;
  ABSENT:  number;
  HALFDAY: number;
  WFH:     number;
  total:   number;
}

export interface LeaveTimelineEntry {
  id:        string;
  status:    LeaveStatus;
  note?:     string;
  createdAt: string;
  reviewer:  Pick<AppUser, "id" | "name" | "initials">;
}

export interface LeaveRequest {
  id:        string;
  leaveType: LeaveType;
  startDate: string;
  endDate:   string;
  reason:    string;
  status:    LeaveStatus;
  createdAt: string;
  userId:    string;
  user:      Pick<AppUser, "id" | "name" | "initials" | "role">;
  timeline:  LeaveTimelineEntry[];
}

export interface LeaveBalance {
  id:        string;
  leaveType: LeaveType;
  total:     number;
  used:      number;
  year:      number;
  userId:    string;
}

export interface UserWithBalances extends Pick<AppUser, "id" | "name" | "initials" | "role"> {
  leaveBalances: LeaveBalance[];
}

// ─── Fine Types ──────────────────────────────────────────────────────────────

export interface Fine {
  id:         string;
  amount:     number;
  reason:     string;
  paid:       boolean;
  createdAt:  string;
  userId:     string;
  user:       Pick<AppUser, "id" | "name" | "initials" | "role">;
  issuedById: string;
  issuedBy:   Pick<AppUser, "id" | "name" | "initials" | "role">;
}

export interface FineUserSummary {
  totalAmount: number;
  totalPaid:   number;
  totalUnpaid: number;
  totalCount:  number;
}

export interface FineSummary extends FineUserSummary {
  byUser: {
    user:    Pick<AppUser, "id" | "name" | "initials" | "role">;
    total:   number;
    paid:    number;
    unpaid:  number;
    count:   number;
  }[];
}

// ─── Super Admin Types ───────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  featureBilling: boolean;
  featureProjects: boolean;
  featureAttendance: boolean;
  featureLeads: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
  users?: Pick<AppUser, "id" | "name" | "email" | "role">[];
  userStats?: { total: number; active: number; inactive: number };
}

export interface CreateCompanyPayload {
  companyName: string;
  companySlug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  grantSuperAdmin?: boolean;
  features: {
    billing: boolean;
    projects: boolean;
    attendance: boolean;
    leads: boolean;
  };
}

export const superAdminApi = {
  listCompanies: () => api.get<Company[]>("/companies"),
  getCompany: (id: string) => api.get<Company>(`/companies/${id}`),
  createCompany: (data: CreateCompanyPayload) => api.post<{ company: Company; admin: AppUser }>("/companies", data),
  updateCompany: (id: string, data: Partial<Company>) => api.patch<Company>(`/companies/${id}`, data),
  suspendCompany: (id: string) => api.patch<Company>(`/companies/${id}`, { status: "SUSPENDED" }),
  reactivateCompany: (id: string) => api.patch<Company>(`/companies/${id}`, { status: "ACTIVE" }),
  getCompanyUsers: (id: string) => api.get<AppUser[]>(`/companies/${id}/users`),
  toggleSuperAdmin: (companyId: string, userId: string, grantSuperAdmin: boolean) =>
    api.patch<AppUser>(`/companies/${companyId}/users/${userId}/role`, { grantSuperAdmin }),
};
