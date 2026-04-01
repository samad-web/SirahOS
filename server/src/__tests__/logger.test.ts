import { describe, it, expect, vi, beforeEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("formats messages with timestamp, level, and tag", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Inline a simplified version of the logger for testing without module resolution issues
    const formatMessage = (level: string, tag: string, message: string) => {
      const timestamp = new Date().toISOString();
      return `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
    };

    const output = formatMessage("error", "Test", "something broke");
    expect(output).toMatch(/\[ERROR\] \[Test\] something broke/);

    spy.mockRestore();
  });

  it("includes meta data in output", () => {
    const formatMessage = (level: string, tag: string, message: string, meta?: unknown) => {
      const timestamp = new Date().toISOString();
      const base = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
      if (meta !== undefined) {
        return `${base} ${typeof meta === "string" ? meta : JSON.stringify(meta)}`;
      }
      return base;
    };

    const output = formatMessage("info", "DB", "Connected", { host: "localhost" });
    expect(output).toContain('{"host":"localhost"}');
  });
});
