// Unit tests for buildSystemPrompt (lib/ai/rag.ts)
// rag.ts imports the DB client and the embed module at load time — both stubbed so no env or network is needed
// Every test pins `now`, so nothing depends on the real clock

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ai/embed", () => ({ embedText: vi.fn() }));

import { buildSystemPrompt } from "./rag";
import type { ChatbotConfig } from "@/types/chat";
import type { HoursSchedule } from "@/types/knowledge";

const config: ChatbotConfig = {
  language: "id",
  accentColor: "#069494",
  systemPrompt: null,
  quickReplies: null,
};

const PROFILE = "Alamat: Jalan Pramuka No. 47, Samarinda";

// Monday 12.09 WITA — the moment production KUN answered "Malam" and "tutup"
const MONDAY_NOON = new Date("2026-09-21T04:09:00Z");
// Sunday 21.21 WITA
const SUNDAY_NIGHT = new Date("2026-09-20T13:21:00Z");

const base = { timeZone: "Asia/Makassar", now: MONDAY_NOON };

const klinik: HoursSchedule = {
  label: "Klinik Hewan",
  lines: [{ days: [1, 2, 3, 4, 5], opens: "08:00", closes: "20:00" }],
};

describe("buildSystemPrompt without a profile", () => {
  it("keeps the original source wording and adds no profile or status section", () => {
    const prompt = buildSystemPrompt(config, ["[chunk]"], base);

    expect(prompt).toContain(
      "Jawab HANYA berdasarkan informasi dalam DOKUMEN BISNIS di bawah ini.",
    );
    expect(prompt).toContain("berdasarkan dokumen di atas.");
    expect(prompt).toContain("berdasarkan dokumen bisnis di atas.");
    expect(prompt).not.toContain("PROFIL BISNIS");
    expect(prompt).not.toContain("STATUS BUKA/TUTUP");
  });

  it("treats null and whitespace-only profiles as no profile", () => {
    const plain = buildSystemPrompt(config, ["[chunk]"], base);

    expect(
      buildSystemPrompt(config, ["[chunk]"], { ...base, profileBlock: null }),
    ).toBe(plain);
    expect(
      buildSystemPrompt(config, ["[chunk]"], { ...base, profileBlock: "   " }),
    ).toBe(plain);
  });
});

describe("buildSystemPrompt with a profile", () => {
  it("places the profile before the documents", () => {
    const prompt = buildSystemPrompt(config, ["isi dokumen"], {
      ...base,
      profileBlock: PROFILE,
    });

    const profileAt = prompt.indexOf(`PROFIL BISNIS:\n${PROFILE}`);
    const documentsAt = prompt.indexOf("DOKUMEN BISNIS:\n");

    expect(profileAt).toBeGreaterThan(-1);
    expect(documentsAt).toBeGreaterThan(profileAt);
  });

  it("names both sources in the instructions", () => {
    const prompt = buildSystemPrompt(config, [], {
      ...base,
      profileBlock: PROFILE,
    });

    expect(prompt).toContain(
      "dalam PROFIL BISNIS dan DOKUMEN BISNIS di bawah ini",
    );
    expect(prompt).toContain("berdasarkan profil dan dokumen di atas.");
    expect(prompt).toContain("berdasarkan profil dan dokumen bisnis di atas.");
  });

  it("keeps the owner's custom instructions ahead of the profile", () => {
    const prompt = buildSystemPrompt(
      { ...config, systemPrompt: "Jangan menawarkan diskon." },
      [],
      { ...base, profileBlock: PROFILE },
    );

    expect(prompt.indexOf("INSTRUKSI TAMBAHAN DARI BISNIS")).toBeLessThan(
      prompt.indexOf("PROFIL BISNIS:\n"),
    );
  });
});

describe("buildSystemPrompt open/closed status", () => {
  it("states BUKA at 12.09 on a Monday and tells KUN not to recompute", () => {
    const prompt = buildSystemPrompt(config, [], {
      ...base,
      profileBlock: PROFILE,
      hours: [klinik],
    });

    expect(prompt).toContain("STATUS BUKA/TUTUP SAAT INI");
    expect(prompt).toContain(
      "- Klinik Hewan: BUKA sekarang, tutup pukul 20.00.",
    );
    expect(prompt).toContain("jangan menghitung sendiri");
  });

  it("states TUTUP with the next opening on Sunday night", () => {
    const prompt = buildSystemPrompt(config, [], {
      timeZone: "Asia/Makassar",
      now: SUNDAY_NIGHT,
      profileBlock: PROFILE,
      hours: [klinik],
    });

    expect(prompt).toContain(
      "- Klinik Hewan: TUTUP sekarang. Buka lagi besok (Senin) pukul 08.00.",
    );
  });

  it("warns that holidays are not taken into account", () => {
    const prompt = buildSystemPrompt(config, [], { ...base, hours: [klinik] });

    expect(prompt).toContain("tidak memperhitungkan hari libur");
  });

  it("adds no status section when there are no hours", () => {
    const prompt = buildSystemPrompt(config, [], {
      ...base,
      profileBlock: PROFILE,
      hours: [],
    });

    expect(prompt).not.toContain("STATUS BUKA/TUTUP");
    expect(prompt).not.toContain("jangan menghitung sendiri");
  });
});

describe("buildSystemPrompt greeting", () => {
  it("names the right day part for the business's local time", () => {
    expect(buildSystemPrompt(config, [], base)).toContain(
      'Sapaan waktu yang tepat saat ini adalah "Siang"',
    );
    expect(
      buildSystemPrompt(config, [], {
        timeZone: "Asia/Makassar",
        now: SUNDAY_NIGHT,
      }),
    ).toContain('Sapaan waktu yang tepat saat ini adalah "Malam"');
  });

  it("appears for orgs without a profile too", () => {
    expect(buildSystemPrompt(config, [], base)).toContain(
      "Sapaan waktu yang tepat",
    );
  });
});

describe("buildSystemPrompt clock", () => {
  it("uses the business timezone", () => {
    expect(buildSystemPrompt(config, [], base)).toContain("WITA (UTC+8)");
  });

  it("falls back to WIB when no timezone is given", () => {
    expect(buildSystemPrompt(config, [], { now: MONDAY_NOON })).toContain(
      "WIB (UTC+7)",
    );
  });
});
