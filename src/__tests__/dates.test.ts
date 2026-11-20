import { afterEach, describe, expect, it, vi } from "vitest";
import { dueStatus, localToday } from "@/lib/dates";

afterEach(() => {
  vi.useRealTimers();
});

describe("date helpers", () => {
  it("formats localToday from local date fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 20, 23, 55, 0));

    expect(localToday()).toBe("2026-11-20");
  });

  it("classifies due dates relative to the client's local date", () => {
    expect(dueStatus("2026-11-19", "2026-11-20")).toBe("overdue");
    expect(dueStatus("2026-11-20", "2026-11-20")).toBe("today");
    expect(dueStatus("2026-11-21", "2026-11-20")).toBe("upcoming");
    expect(dueStatus(null, "2026-11-20")).toBe("none");
  });

  it("does not mark a completed task overdue", () => {
    expect(dueStatus("2026-11-19", "2026-11-20", true)).toBe("none");
  });
});
