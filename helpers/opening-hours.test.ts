// Unit tests for helpers/opening-hours.ts
// Pure functions — every clock is pinned, no mocks needed

import { describe, it, expect } from "vitest";
import {
  describeOpenStatus,
  formatDays,
  formatTimeRange,
  getGreetingPeriod,
  getLocalTime,
  parseClock,
} from "./opening-hours";
import type { HoursSchedule } from "@/types/knowledge";

const WITA = "Asia/Makassar";

// Klinik Hewan, Monday–Friday 08.00–20.00 (the Rumah Paco case that failed in production)
const klinik: HoursSchedule = {
  label: "Klinik Hewan",
  lines: [{ days: [1, 2, 3, 4, 5], opens: "08:00", closes: "20:00" }],
};

const at = (iso: string) => new Date(iso);

describe("parseClock", () => {
  it("parses valid clocks, including end of day", () => {
    expect(parseClock("08:00")).toBe(480);
    expect(parseClock("00:00")).toBe(0);
    expect(parseClock("24:00")).toBe(1440);
  });

  it("rejects malformed values", () => {
    expect(parseClock("8:00")).toBeNull();
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("24:30")).toBeNull();
    expect(parseClock("12:60")).toBeNull();
    expect(parseClock("abc")).toBeNull();
  });
});

describe("getLocalTime", () => {
  it("reads the business's own clock", () => {
    // 04:09 UTC = 12.09 WITA on Monday 21 September 2026
    expect(getLocalTime(at("2026-09-21T04:09:00Z"), WITA)).toEqual({
      weekday: 1,
      minutes: 729,
    });
  });

  it("rolls the weekday over with the timezone", () => {
    // 13:21 UTC = 21.21 WITA on Sunday
    expect(getLocalTime(at("2026-09-20T13:21:00Z"), WITA)).toEqual({
      weekday: 0,
      minutes: 1281,
    });
  });
});

describe("getGreetingPeriod", () => {
  it("covers every boundary", () => {
    expect(getGreetingPeriod(299)).toBe("Malam"); // 04.59
    expect(getGreetingPeriod(300)).toBe("Pagi"); // 05.00
    expect(getGreetingPeriod(659)).toBe("Pagi"); // 10.59
    expect(getGreetingPeriod(660)).toBe("Siang"); // 11.00
    expect(getGreetingPeriod(729)).toBe("Siang"); // 12.09 — the case that said "Malam"
    expect(getGreetingPeriod(899)).toBe("Siang"); // 14.59
    expect(getGreetingPeriod(900)).toBe("Sore"); // 15.00
    expect(getGreetingPeriod(1079)).toBe("Sore"); // 17.59
    expect(getGreetingPeriod(1080)).toBe("Malam"); // 18.00
    expect(getGreetingPeriod(0)).toBe("Malam"); // midnight
  });
});

describe("formatDays", () => {
  it("collapses runs of three or more days", () => {
    expect(formatDays([1, 2, 3, 4, 5])).toBe("Senin – Jumat");
  });

  it("lists shorter runs and single days", () => {
    expect(formatDays([6, 0])).toBe("Sabtu, Minggu");
    expect(formatDays([1, 3])).toBe("Senin, Rabu");
    expect(formatDays([0])).toBe("Minggu");
  });

  it("mixes runs and single days", () => {
    expect(formatDays([1, 2, 3, 5, 6])).toBe("Senin – Rabu, Jumat, Sabtu");
  });

  it("says Setiap hari for all seven, in any order", () => {
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe("Setiap hari");
    expect(formatDays([3, 1, 0, 2, 6, 5, 4])).toBe("Setiap hari");
  });
});

describe("formatTimeRange", () => {
  it("uses Indonesian dots", () => {
    expect(formatTimeRange("08:00", "20:00")).toBe("08.00 – 20.00");
  });

  it("says 24 jam for a full day", () => {
    expect(formatTimeRange("00:00", "24:00")).toBe("24 jam");
  });
});

describe("describeOpenStatus", () => {
  it("says BUKA at 12.09 on a Monday — the exact production bug", () => {
    expect(describeOpenStatus([klinik], WITA, at("2026-09-21T04:09:00Z"))).toBe(
      "- Klinik Hewan: BUKA sekarang, tutup pukul 20.00.",
    );
  });

  it("is open exactly at opening time and closed exactly at closing time", () => {
    expect(
      describeOpenStatus([klinik], WITA, at("2026-09-21T00:00:00Z")),
    ).toContain("BUKA");
    expect(
      describeOpenStatus([klinik], WITA, at("2026-09-21T12:00:00Z")),
    ).toContain("TUTUP");
  });

  it("points to tomorrow after closing", () => {
    // Monday 20.30 WITA
    expect(describeOpenStatus([klinik], WITA, at("2026-09-21T12:30:00Z"))).toBe(
      "- Klinik Hewan: TUTUP sekarang. Buka lagi besok (Selasa) pukul 08.00.",
    );
  });

  it("points to today before opening", () => {
    // Monday 07.30 WITA
    expect(describeOpenStatus([klinik], WITA, at("2026-09-20T23:30:00Z"))).toBe(
      "- Klinik Hewan: TUTUP sekarang. Buka lagi hari ini pukul 08.00.",
    );
  });

  it("skips the weekend on Friday evening", () => {
    // Friday 21.00 WITA
    expect(describeOpenStatus([klinik], WITA, at("2026-09-25T13:00:00Z"))).toBe(
      "- Klinik Hewan: TUTUP sekarang. Buka lagi hari Senin pukul 08.00.",
    );
  });

  it("handles a lunch break", () => {
    const withBreak: HoursSchedule = {
      label: "Klinik",
      lines: [
        { days: [1, 2, 3, 4, 5], opens: "08:00", closes: "12:00" },
        { days: [1, 2, 3, 4, 5], opens: "13:00", closes: "20:00" },
      ],
    };
    // Monday 12.30 WITA
    expect(
      describeOpenStatus([withBreak], WITA, at("2026-09-21T04:30:00Z")),
    ).toBe("- Klinik: TUTUP sekarang. Buka lagi hari ini pukul 13.00.");
  });

  describe("shifts that end after midnight", () => {
    const kafe: HoursSchedule = {
      label: "Kafe",
      lines: [{ days: [5, 6], opens: "18:00", closes: "02:00" }],
    };

    it("is still open after midnight on the night's second day", () => {
      // Saturday 01.00 WITA — Friday's shift still running
      expect(describeOpenStatus([kafe], WITA, at("2026-09-25T17:00:00Z"))).toBe(
        "- Kafe: BUKA sekarang, tutup pukul 02.00.",
      );
      // Sunday 01.00 WITA — Saturday's shift still running
      expect(
        describeOpenStatus([kafe], WITA, at("2026-09-26T17:00:00Z")),
      ).toContain("BUKA");
    });

    it("is closed after the shift ends and points to the evening", () => {
      // Saturday 03.00 WITA
      expect(describeOpenStatus([kafe], WITA, at("2026-09-25T19:00:00Z"))).toBe(
        "- Kafe: TUTUP sekarang. Buka lagi hari ini pukul 18.00.",
      );
    });
  });

  it("says a full-day, every-day schedule never closes", () => {
    const igd: HoursSchedule = {
      label: "Darurat",
      lines: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: "00:00", closes: "24:00" }],
    };

    // Monday 23.59 WITA — no "tutup tengah malam"
    expect(describeOpenStatus([igd], WITA, at("2026-09-21T15:59:00Z"))).toBe(
      "- Darurat: BUKA sekarang, buka 24 jam setiap hari.",
    );
  });

  it("reports every schedule on its own line", () => {
    const petShop: HoursSchedule = {
      label: "Pet Shop",
      lines: [{ days: [0], opens: "10:00", closes: "15:00" }],
    };

    // Monday 12.09 WITA — klinik open, pet shop open only on Sunday
    expect(
      describeOpenStatus([klinik, petShop], WITA, at("2026-09-21T04:09:00Z")),
    ).toBe(
      "- Klinik Hewan: BUKA sekarang, tutup pukul 20.00.\n- Pet Shop: TUTUP sekarang. Buka lagi hari Minggu pukul 10.00.",
    );
  });

  it("says only TUTUP when the schedule never opens", () => {
    const never: HoursSchedule = {
      label: "Kosong",
      lines: [{ days: [], opens: "08:00", closes: "20:00" }],
    };

    expect(describeOpenStatus([never], WITA, at("2026-09-21T04:09:00Z"))).toBe(
      "- Kosong: TUTUP sekarang.",
    );
  });

  it("returns null with no schedules, and skips schedules it can't read", () => {
    expect(describeOpenStatus([], WITA, at("2026-09-21T04:09:00Z"))).toBeNull();

    const broken: HoursSchedule = {
      label: "Rusak",
      lines: [{ days: [1], opens: "abc", closes: "def" }],
    };
    expect(
      describeOpenStatus([broken], WITA, at("2026-09-21T04:09:00Z")),
    ).toBeNull();
  });

  describe("full-day lines on some days only", () => {
    const kantor: HoursSchedule = {
      label: "Kantor",
      lines: [{ days: [1, 2, 3, 4, 5], opens: "00:00", closes: "24:00" }],
    };

    it("stays open past midnight when the next day starts at 00:00", () => {
      // Monday 12.09 WITA — Tuesday also opens at 00:00
      expect(
        describeOpenStatus([kantor], WITA, at("2026-09-21T04:09:00Z")),
      ).toBe("- Kantor: BUKA sekarang, lanjut buka melewati tengah malam.");
    });

    it("closes at midnight on the last full day", () => {
      // Friday 12.00 WITA — Saturday has no line
      expect(
        describeOpenStatus([kantor], WITA, at("2026-09-25T04:00:00Z")),
      ).toBe("- Kantor: BUKA sekarang, tutup tengah malam.");
    });
  });

  describe("lines that make no sense", () => {
    it("ignores a line whose open and close times are equal", () => {
      const equal: HoursSchedule = {
        label: "Aneh",
        lines: [{ days: [1], opens: "08:00", closes: "08:00" }],
      };

      expect(
        describeOpenStatus([equal], WITA, at("2026-09-21T04:09:00Z")),
      ).toBeNull();
    });

    it("ignores a line that opens at 24:00", () => {
      const late: HoursSchedule = {
        label: "Aneh",
        lines: [
          { days: [0, 1, 2, 3, 4, 5, 6], opens: "24:00", closes: "20:00" },
        ],
      };

      expect(
        describeOpenStatus([late], WITA, at("2026-09-21T04:09:00Z")),
      ).toBeNull();
    });

    it("never lets a bad line turn a schedule open", () => {
      const mixed: HoursSchedule = {
        label: "Campur",
        lines: [
          { days: [2], opens: "08:00", closes: "20:00" },
          { days: [1], opens: "08:00", closes: "08:00" }, // bad line, Monday
        ],
      };

      // Monday 12.09 WITA — the bad line must not read as open
      expect(
        describeOpenStatus([mixed], WITA, at("2026-09-21T04:09:00Z")),
      ).toBe("- Campur: TUTUP sekarang. Buka lagi besok (Selasa) pukul 08.00.");
    });
  });
});
