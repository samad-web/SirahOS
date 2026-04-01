import { describe, it, expect } from "vitest";

// Standalone version of requireCompanyMatch for testing without Express deps
function requireCompanyMatch(
  resourceCompanyId: string | null | undefined,
  userRole: string,
  userCompanyId: string | null | undefined,
): boolean {
  if (userRole === "SUPER_ADMIN") return true;
  if (!userCompanyId) return false;
  return resourceCompanyId === userCompanyId;
}

describe("requireCompanyMatch", () => {
  it("allows SUPER_ADMIN access to any company", () => {
    expect(requireCompanyMatch("company-a", "SUPER_ADMIN", null)).toBe(true);
    expect(requireCompanyMatch("company-b", "SUPER_ADMIN", "company-a")).toBe(true);
    expect(requireCompanyMatch(null, "SUPER_ADMIN", null)).toBe(true);
  });

  it("allows access when user company matches resource company", () => {
    expect(requireCompanyMatch("company-a", "ADMIN", "company-a")).toBe(true);
  });

  it("denies access when company IDs differ", () => {
    expect(requireCompanyMatch("company-b", "ADMIN", "company-a")).toBe(false);
  });

  it("denies access when user has no company", () => {
    expect(requireCompanyMatch("company-a", "ADMIN", null)).toBe(false);
    expect(requireCompanyMatch("company-a", "ADMIN", undefined)).toBe(false);
  });

  it("denies access when resource has null company and user has a company", () => {
    expect(requireCompanyMatch(null, "ADMIN", "company-a")).toBe(false);
  });
});
