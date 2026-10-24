import { describe, expect, it } from "vitest";
import {
  displayDate,
  displayDateTime,
  displayMonth,
  parseDisplayDate,
  parseDisplayMonth,
} from "../src/domain/dates";

describe("day-first dates", () => {
  it("formats stored dates and months without changing their values", () => {
    expect(displayDate("2026-10-21")).toBe("21-10-2026");
    expect(displayDate("2026-10-21T12:00:00Z")).toBe("21-10-2026");
    expect(displayMonth("2026-10")).toBe("10-2026");
    expect(displayDateTime("2026-10-21T04:35:00Z")).toBe("21-10-2026 10:05");
  });

  it("accepts only real day-first dates", () => {
    expect(parseDisplayDate("29-02-2024")).toBe("2024-02-29");
    expect(parseDisplayDate("29-02-2025")).toBeNull();
    expect(parseDisplayDate("31-04-2026")).toBeNull();
    expect(parseDisplayDate("2026-10-21")).toBeNull();
    expect(parseDisplayMonth("10-2026")).toBe("2026-10");
    expect(parseDisplayMonth("13-2026")).toBeNull();
  });
});
