import { describe, it, expect } from "vitest";
import { PAGINATION } from "../lib/constants";

describe("PAGINATION constants", () => {
  it("has sensible defaults", () => {
    expect(PAGINATION.DEFAULT_PAGE).toBe(1);
    expect(PAGINATION.DEFAULT_LIMIT).toBe(50);
    expect(PAGINATION.MAX_LIMIT).toBe(200);
  });

  it("limits are enforced correctly", () => {
    // Simulate the pagination logic used in routes
    const parsePagination = (page?: string, limit?: string) => {
      const take = Math.min(Number(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
      const skip = ((Math.max(Number(page) || 1, 1)) - 1) * take;
      return { take, skip };
    };

    // Default values
    expect(parsePagination()).toEqual({ take: 50, skip: 0 });

    // Page 2
    expect(parsePagination("2")).toEqual({ take: 50, skip: 50 });

    // Custom limit
    expect(parsePagination("1", "25")).toEqual({ take: 25, skip: 0 });

    // Over max limit — clamped
    expect(parsePagination("1", "500")).toEqual({ take: 200, skip: 0 });

    // Negative page — clamped to 1
    expect(parsePagination("-1")).toEqual({ take: 50, skip: 0 });

    // Zero page — clamped to 1
    expect(parsePagination("0")).toEqual({ take: 50, skip: 0 });

    // Invalid values — defaults
    expect(parsePagination("abc", "xyz")).toEqual({ take: 50, skip: 0 });
  });
});
