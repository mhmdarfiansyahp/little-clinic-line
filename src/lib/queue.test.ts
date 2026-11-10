import { describe, expect, it } from "vitest";
import { clinicDate, formatQueueCode } from "./queue";

describe("queue numbers", () => {
  it("formats numbers as A001, A002, …", () => {
    expect(formatQueueCode(1)).toBe("A001");
    expect(formatQueueCode(2)).toBe("A002");
    expect(formatQueueCode(57)).toBe("A057");
  });

  it("keeps counting past 999", () => {
    expect(formatQueueCode(1000)).toBe("A1000");
  });

  it("starts a new clinic day at midnight clinic time, not UTC", () => {
    // 17:30 UTC on Nov 10 is 00:30 on Nov 11 at the clinic
    expect(clinicDate(new Date("2026-11-10T17:30:00Z"))).toBe("2026-11-11");
    expect(clinicDate(new Date("2026-11-10T16:59:00Z"))).toBe("2026-11-10");
  });
});
