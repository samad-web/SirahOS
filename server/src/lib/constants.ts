/**
 * Shared constants — eliminates magic strings across the codebase.
 */

// ─── Pagination defaults ────────────────────────────────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
} as const;

// ─── Feature flags ──────────────────────────────────────────────────────────

export const FEATURES = {
  BILLING: "billing",
  PROJECTS: "projects",
  ATTENDANCE: "attendance",
  LEADS: "leads",
} as const;

// ─── Audit actions ──────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  CREATE_INVOICE: "CREATE_INVOICE",
  UPDATE_INVOICE: "UPDATE_INVOICE",
  ADD_PAYMENT: "ADD_PAYMENT",
  CREATE_CUSTOMER: "CREATE_CUSTOMER",
  UPDATE_CUSTOMER: "UPDATE_CUSTOMER",
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  UPDATE_USER_STATUS: "UPDATE_USER_STATUS",
  DELETE_USER: "DELETE_USER",
  REASSIGN_USER: "REASSIGN_USER",
  CREATE_PROJECT: "CREATE_PROJECT",
  ASSIGN_PM: "ASSIGN_PM",
  ASSIGN_LEAD: "ASSIGN_LEAD",
  ADD_MEMBER: "ADD_MEMBER",
  REMOVE_MEMBER: "REMOVE_MEMBER",
  UPDATE_PROJECT_STATUS: "UPDATE_PROJECT_STATUS",
  CREATE_TASK: "CREATE_TASK",
  UPDATE_TASK: "UPDATE_TASK",
  REASSIGN_TASK: "REASSIGN_TASK",
  DELETE_TASK: "DELETE_TASK",
  REPORT_BUG: "REPORT_BUG",
  ASSIGN_BUG: "ASSIGN_BUG",
  UPDATE_BUG_STATUS: "UPDATE_BUG_STATUS",
  CREATE_EXPENSE: "CREATE_EXPENSE",
  UPDATE_EXPENSE: "UPDATE_EXPENSE",
  DELETE_EXPENSE: "DELETE_EXPENSE",
  CREATE_LEDGER_ENTRY: "CREATE_LEDGER_ENTRY",
  DELETE_LEDGER_ENTRY: "DELETE_LEDGER_ENTRY",
  CREATE_NOTE: "CREATE_NOTE",
  UPDATE_NOTE: "UPDATE_NOTE",
  DELETE_NOTE: "DELETE_NOTE",
  CREATE_FINE: "CREATE_FINE",
  UPDATE_FINE: "UPDATE_FINE",
  DELETE_FINE: "DELETE_FINE",
  SEND_EMI_REMINDERS: "SEND_EMI_REMINDERS",
} as const;

// ─── Resource types ─────────────────────────────────────────────────────────

export const RESOURCE_TYPES = {
  INVOICE: "Invoice",
  CUSTOMER: "Customer",
  USER: "User",
  PROJECT: "Project",
  TASK: "Task",
  BUG_REPORT: "BugReport",
  EXPENSE: "Expense",
  LEDGER_ENTRY: "LedgerEntry",
  NOTE: "Note",
  FINE: "Fine",
} as const;
