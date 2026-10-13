import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  getReadingLabel,
  getStepDescription,
} from "./knowledge-import-labels";

describe("getStepDescription", () => {
  it("tells the owner to paste text on the text paste screen", () => {
    expect(getStepDescription("paste", "text")).toContain("Tempel");
  });

  it("tells the owner to pick a photo on the photo screen", () => {
    const text = getStepDescription("paste", "photo");
    expect(text).toContain("foto");
    expect(text).not.toContain("Tempel");
  });

  it("says what is being read while reading", () => {
    expect(getStepDescription("reading", "text")).toBe(
      "Sedang membaca teks kamu.",
    );
    expect(getStepDescription("reading", "photo")).toBe(
      "Sedang membaca foto kamu.",
    );
  });

  it.each(["review", "saving", "result"] as const)(
    "uses the same words for %s whatever the source",
    (step) => {
      expect(getStepDescription(step, "photo")).toBe(
        getStepDescription(step, "text"),
      );
    },
  );
});

describe("getReadingLabel", () => {
  const none = { done: 0, total: 0 };

  it("shows a plain label for a one-round text read", () => {
    expect(
      getReadingLabel({
        source: "text",
        stage: "reading",
        progress: { done: 0, total: 1 },
      }),
    ).toBe("Membaca teks...");
    expect(
      getReadingLabel({ source: "text", stage: "reading", progress: none }),
    ).toBe("Membaca teks...");
  });

  it("counts rounds with 'tahap', never 'bagian'", () => {
    const label = getReadingLabel({
      source: "text",
      stage: "reading",
      progress: { done: 1, total: 3 },
    });

    expect(label).toBe("Membaca teks (tahap 2 dari 3)");
    expect(label).not.toContain("bagian");
  });

  it("never counts past the last round", () => {
    expect(
      getReadingLabel({
        source: "text",
        stage: "reading",
        progress: { done: 3, total: 3 },
      }),
    ).toBe("Membaca teks (tahap 3 dari 3)");
  });

  it("shows the two photo stages", () => {
    expect(
      getReadingLabel({
        source: "photo",
        stage: "compressing",
        progress: none,
      }),
    ).toBe("Menyiapkan foto...");
    expect(
      getReadingLabel({ source: "photo", stage: "reading", progress: none }),
    ).toContain("Membaca foto");
  });

  it("ignores text progress for a photo", () => {
    expect(
      getReadingLabel({
        source: "photo",
        stage: "reading",
        progress: { done: 2, total: 5 },
      }),
    ).not.toContain("tahap");
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536, "2 KB"],
    [850 * 1024, "850 KB"],
    [1024 * 1024, "1,0 MB"],
    [2.5 * 1024 * 1024, "2,5 MB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
