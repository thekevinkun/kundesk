// Unit tests for helpers/format.ts
// Pure functions — no mocks needed except Date.now() for relative time tests
// Covers: formatRupiah, formatDate, formatPaymentMethod, formatRelativeTime, toDateSafe

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatRupiah,
  formatDate,
  formatPaymentMethod,
  formatRelativeTime,
  toDateSafe,
} from "./format";

describe("formatRupiah", () => {
  it("returns 'Gratis' for zero", () => {
    expect(formatRupiah(0)).toBe("Gratis");
  });

  it("formats Starter plan price correctly", () => {
    expect(formatRupiah(149000)).toBe("Rp 149.000");
  });

  it("formats Pro plan price correctly", () => {
    expect(formatRupiah(399000)).toBe("Rp 399.000");
  });

  it("formats amounts over 1 million", () => {
    expect(formatRupiah(1000000)).toBe("Rp 1.000.000");
  });
});

describe("formatDate", () => {
  it("returns '—' for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("formats a date in Indonesian locale", () => {
    // 1 June 2026
    const date = new Date("2026-06-01T00:00:00Z");
    const result = formatDate(date);

    // Indonesian locale: "1 Juni 2026"
    expect(result).toContain("2026");
    expect(result).toContain("Juni");
    expect(result).toContain("1");
  });

  it("accepts a string and formats it correctly", () => {
    const result = formatDate(new Date("2026-01-15T00:00:00Z"));
    expect(result).toContain("2026");
  });
});

describe("formatPaymentMethod", () => {
  it("returns '—' for null", () => {
    expect(formatPaymentMethod(null)).toBe("—");
  });

  it("maps bank_transfer correctly", () => {
    expect(formatPaymentMethod("bank_transfer")).toBe("Transfer Bank");
  });

  it("maps gopay correctly", () => {
    expect(formatPaymentMethod("gopay")).toBe("GoPay");
  });

  it("maps qris correctly", () => {
    expect(formatPaymentMethod("qris")).toBe("QRIS");
  });

  it("maps ovo correctly", () => {
    expect(formatPaymentMethod("ovo")).toBe("OVO");
  });

  it("maps dana correctly", () => {
    expect(formatPaymentMethod("dana")).toBe("DANA");
  });

  it("maps credit_card correctly", () => {
    expect(formatPaymentMethod("credit_card")).toBe("Kartu Kredit");
  });

  it("returns the raw value for unknown methods", () => {
    expect(formatPaymentMethod("unknown_method")).toBe("unknown_method");
  });
});

describe("formatRelativeTime", () => {
  // Pin Date.now() so relative time calculations are deterministic
  const NOW = new Date("2026-06-01T12:00:00Z").getTime();

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'Baru saja' for dates less than 1 minute ago", () => {
    const date = new Date(NOW - 30 * 1000); // 30 seconds ago
    expect(formatRelativeTime(date)).toBe("Baru saja");
  });

  it("returns minutes for dates less than 1 hour ago", () => {
    const date = new Date(NOW - 5 * 60 * 1000); // 5 minutes ago
    expect(formatRelativeTime(date)).toBe("5 mnt lalu");
  });

  it("returns hours for dates less than 24 hours ago", () => {
    const date = new Date(NOW - 3 * 60 * 60 * 1000); // 3 hours ago
    expect(formatRelativeTime(date)).toBe("3 jam lalu");
  });

  it("returns days for dates less than 30 days ago", () => {
    const date = new Date(NOW - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    expect(formatRelativeTime(date)).toBe("7 hari lalu");
  });

  it("returns months for dates less than 12 months ago", () => {
    const date = new Date(NOW - 45 * 24 * 60 * 60 * 1000); // ~1.5 months ago
    expect(formatRelativeTime(date)).toBe("1 bulan lalu");
  });

  it("returns years for dates over 12 months ago", () => {
    const date = new Date(NOW - 400 * 24 * 60 * 60 * 1000); // ~13 months ago
    expect(formatRelativeTime(date)).toBe("1 tahun lalu");
  });

  it("accepts a string date", () => {
    const date = new Date(NOW - 10 * 60 * 1000).toISOString(); // 10 minutes ago as string
    expect(formatRelativeTime(date)).toBe("10 mnt lalu");
  });

  it("returns '—' for invalid date string", () => {
    expect(formatRelativeTime("not-a-date")).toBe("—");
  });

  it("handles future dates gracefully — returns 'Baru saja'", () => {
    // diffMs is clamped to 0 via Math.max — future dates treated as now
    const futureDate = new Date(NOW + 60 * 1000);
    expect(formatRelativeTime(futureDate)).toBe("Baru saja");
  });
});

describe("toDateSafe", () => {
  it("returns the same Date object when given a Date", () => {
    const date = new Date("2026-06-01T00:00:00Z");
    const result = toDateSafe(date);
    expect(result.getTime()).toBe(date.getTime());
  });

  it("returns NaN date for null", () => {
    const result = toDateSafe(null);
    expect(Number.isNaN(result.getTime())).toBe(true);
  });

  it("parses ISO string with Z suffix correctly", () => {
    const result = toDateSafe("2026-06-01T12:00:00Z");
    expect(result.getTime()).toBe(new Date("2026-06-01T12:00:00Z").getTime());
  });

  it("appends Z when string has no timezone — treats as UTC", () => {
    const result = toDateSafe("2026-06-01T12:00:00");
    expect(result.getTime()).toBe(new Date("2026-06-01T12:00:00Z").getTime());
  });

  it("normalizes space separator between date and time (Neon raw SQL format)", () => {
    // Neon db.execute() returns "2026-06-01 12:00:00" without T
    const result = toDateSafe("2026-06-01 12:00:00");
    expect(result.getTime()).toBe(new Date("2026-06-01T12:00:00Z").getTime());
  });

  it("preserves existing timezone offset when present", () => {
    const result = toDateSafe("2026-06-01T12:00:00+07:00");
    expect(result.getTime()).toBe(
      new Date("2026-06-01T12:00:00+07:00").getTime(),
    );
  });
});
