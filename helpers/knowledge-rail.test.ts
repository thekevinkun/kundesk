import { describe, expect, it } from "vitest";
import { getKnowledgeRowDisplay } from "@/helpers/knowledge-rail";
import type { RecentKnowledgeItem } from "@/types/dashboard";

// Builds a rail item — each test overrides only what it is about
const item = (
  overrides: Partial<RecentKnowledgeItem>,
): RecentKnowledgeItem => ({
  id: 1,
  source: "document",
  title: "menu.pdf",
  kind: null,
  chunkCount: 4,
  entryCount: null,
  status: "ready",
  updatedAt: "2026-11-26T10:00:00.000Z",
  ...overrides,
});

describe("getKnowledgeRowDisplay — documents", () => {
  it("shows a ready document as previewable with its chunk count", () => {
    expect(getKnowledgeRowDisplay(item({}))).toEqual({
      isDocument: true,
      typeLabel: "PDF",
      status: "ready",
      detail: "4 chunks · Dokumen siap",
      canPreview: true,
    });
  });

  it("shows a processing document as not previewable", () => {
    expect(
      getKnowledgeRowDisplay(item({ status: "processing", chunkCount: 0 })),
    ).toMatchObject({
      status: "processing",
      detail: "KUN sedang mempelajari dokumen",
      canPreview: false,
    });
  });

  it("shows a failed document as not previewable", () => {
    expect(getKnowledgeRowDisplay(item({ status: "failed" }))).toMatchObject({
      status: "failed",
      detail: "Gagal diproses — buka Info Bisnis",
      canPreview: false,
    });
  });

  it("treats an unexpected status as still processing", () => {
    expect(getKnowledgeRowDisplay(item({ status: "weird" }))).toMatchObject({
      status: "processing",
      canPreview: false,
    });
    expect(getKnowledgeRowDisplay(item({ status: null }))).toMatchObject({
      status: "processing",
    });
  });

  it("takes the file type from the last extension, upper-cased", () => {
    expect(
      getKnowledgeRowDisplay(item({ title: "menu.final.docx" })).typeLabel,
    ).toBe("DOCX");
    expect(getKnowledgeRowDisplay(item({ title: "notes.md" })).typeLabel).toBe(
      "MD",
    );
  });

  it("falls back to FILE when there is no real extension", () => {
    expect(getKnowledgeRowDisplay(item({ title: "README" })).typeLabel).toBe(
      "FILE",
    );
    expect(getKnowledgeRowDisplay(item({ title: "notes." })).typeLabel).toBe(
      "FILE",
    );
  });

  it("caps a long extension at four letters", () => {
    expect(
      getKnowledgeRowDisplay(item({ title: "data.markdown" })).typeLabel,
    ).toBe("MARK");
  });
});

describe("getKnowledgeRowDisplay — manual sections", () => {
  const manual = (overrides: Partial<RecentKnowledgeItem>) =>
    item({
      source: "manual",
      title: "Daftar Menu",
      kind: "catalog",
      chunkCount: 12,
      entryCount: 3,
      status: null,
      ...overrides,
    });

  it("is always ready, never previewable, and counts items and chunks", () => {
    expect(getKnowledgeRowDisplay(manual({}))).toEqual({
      isDocument: false,
      typeLabel: "Katalog",
      status: "ready",
      detail: "3 item · 12 chunks",
      canPreview: false,
    });
  });

  it("names every section kind", () => {
    const label = (kind: string) =>
      getKnowledgeRowDisplay(manual({ kind })).typeLabel;
    expect(label("faq")).toBe("FAQ");
    expect(label("policy")).toBe("Kebijakan");
    expect(label("promo")).toBe("Promo");
    expect(label("note")).toBe("Catatan");
  });

  it("falls back to Isi Manual for an unknown or missing kind", () => {
    expect(getKnowledgeRowDisplay(manual({ kind: "other" })).typeLabel).toBe(
      "Isi Manual",
    );
    expect(getKnowledgeRowDisplay(manual({ kind: null })).typeLabel).toBe(
      "Isi Manual",
    );
  });

  it("counts a missing entry count as zero", () => {
    expect(getKnowledgeRowDisplay(manual({ entryCount: null })).detail).toBe(
      "0 item · 12 chunks",
    );
  });
});
