// Unit tests for buildSystemPrompt (lib/ai/rag.ts)
// rag.ts imports the DB client and the embed module at load time — both stubbed so no env or network is needed

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ai/embed", () => ({ embedText: vi.fn() }));

import { buildSystemPrompt } from "./rag";
import type { ChatbotConfig } from "@/types/chat";

const config: ChatbotConfig = {
  language: "id",
  accentColor: "#069494",
  systemPrompt: null,
  quickReplies: null,
};

const PROFILE = "Alamat: Jalan Pramuka 6 No. 27, Samarinda";

describe("buildSystemPrompt without a profile", () => {
  it("keeps the original wording and adds no profile section", () => {
    const prompt = buildSystemPrompt(config, ["[chunk]"]);

    expect(prompt).toContain(
      "Jawab HANYA berdasarkan informasi dalam DOKUMEN BISNIS di bawah ini.",
    );
    expect(prompt).toContain("berdasarkan dokumen di atas.");
    expect(prompt).toContain("berdasarkan dokumen bisnis di atas.");
    expect(prompt).not.toContain("PROFIL BISNIS");
  });

  it("treats null and whitespace-only profiles as no profile", () => {
    const base = buildSystemPrompt(config, ["[chunk]"], {
      timeZone: "Asia/Makassar",
    });

    expect(
      buildSystemPrompt(config, ["[chunk]"], {
        timeZone: "Asia/Makassar",
        profileBlock: null,
      }),
    ).toBe(base);
    expect(
      buildSystemPrompt(config, ["[chunk]"], {
        timeZone: "Asia/Makassar",
        profileBlock: "   ",
      }),
    ).toBe(base);
  });
});

describe("buildSystemPrompt with a profile", () => {
  it("places the profile before the documents", () => {
    const prompt = buildSystemPrompt(config, ["isi dokumen"], {
      profileBlock: PROFILE,
    });

    const profileAt = prompt.indexOf(`PROFIL BISNIS:\n${PROFILE}`);
    const documentsAt = prompt.indexOf("DOKUMEN BISNIS:\n");

    expect(profileAt).toBeGreaterThan(-1);
    expect(documentsAt).toBeGreaterThan(profileAt);
  });

  it("names both sources in the instructions", () => {
    const prompt = buildSystemPrompt(config, [], { profileBlock: PROFILE });

    expect(prompt).toContain(
      "dalam PROFIL BISNIS dan DOKUMEN BISNIS di bawah ini",
    );
    expect(prompt).toContain("berdasarkan profil dan dokumen di atas.");
    expect(prompt).toContain("berdasarkan profil dan dokumen bisnis di atas.");
  });

  it("tells KUN how to answer 'buka sekarang?'", () => {
    const prompt = buildSystemPrompt(config, [], { profileBlock: PROFILE });

    expect(prompt).toContain("buka sekarang?");
    expect(prompt).toContain("jam operasional di PROFIL BISNIS");
  });

  it("keeps the owner's custom instructions ahead of the profile", () => {
    const prompt = buildSystemPrompt(
      { ...config, systemPrompt: "Jangan menawarkan diskon." },
      [],
      { profileBlock: PROFILE },
    );

    expect(prompt.indexOf("INSTRUKSI TAMBAHAN DARI BISNIS")).toBeLessThan(
      prompt.indexOf("PROFIL BISNIS:\n"),
    );
  });
});

describe("buildSystemPrompt clock", () => {
  it("uses the business timezone", () => {
    expect(
      buildSystemPrompt(config, [], { timeZone: "Asia/Makassar" }),
    ).toContain("WITA (UTC+8)");
  });

  it("falls back to WIB when no timezone is given", () => {
    expect(buildSystemPrompt(config, [])).toContain("WIB (UTC+7)");
  });
});
