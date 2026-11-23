import { describe, it, expect } from "vitest";
import { getPreviewKind } from "./document-preview";

describe("getPreviewKind", () => {
  it("treats pdf files as pdf, whatever the letter case", () => {
    expect(getPreviewKind("menu.pdf")).toBe("pdf");
    expect(getPreviewKind("MENU.PDF")).toBe("pdf");
  });

  it("uses the last extension when the name has several dots", () => {
    expect(getPreviewKind("menu.v2.pdf")).toBe("pdf");
    expect(getPreviewKind("menu.pdf.txt")).toBe("other");
  });

  it("treats txt, md and docx as other", () => {
    expect(getPreviewKind("a.txt")).toBe("other");
    expect(getPreviewKind("a.md")).toBe("other");
    expect(getPreviewKind("a.docx")).toBe("other");
  });

  it("treats a name with no extension as other, even if it says pdf", () => {
    expect(getPreviewKind("pdf")).toBe("other");
    expect(getPreviewKind("README")).toBe("other");
  });
});
