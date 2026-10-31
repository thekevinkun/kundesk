// Tests for helpers/file-signature.ts — content checks for uploaded documents
import { describe, it, expect } from "vitest";
import {
  BINARY_TEXT_MESSAGE,
  SIGNATURE_MISMATCH_MESSAGE,
  findSignatureProblem,
} from "./file-signature";

describe("findSignatureProblem", () => {
  describe("pdf", () => {
    it("accepts a file that starts with the PDF header", () => {
      expect(
        findSignatureProblem(Buffer.from("%PDF-1.7\n..."), "menu.pdf"),
      ).toBeNull();
    });

    it("accepts a header after a few junk bytes, inside the first 1024 bytes", () => {
      const buffer = Buffer.concat([
        Buffer.alloc(1000, "a"),
        Buffer.from("%PDF-1.4"),
      ]);
      expect(findSignatureProblem(buffer, "menu.pdf")).toBeNull();
    });

    it("rejects a header that only appears after the first 1024 bytes", () => {
      const buffer = Buffer.concat([
        Buffer.alloc(1100, "a"),
        Buffer.from("%PDF-1.4"),
      ]);
      expect(findSignatureProblem(buffer, "menu.pdf")).toBe(
        SIGNATURE_MISMATCH_MESSAGE,
      );
    });

    it("rejects an HTML file renamed to .pdf", () => {
      expect(
        findSignatureProblem(Buffer.from("<html>bukan pdf</html>"), "menu.pdf"),
      ).toBe(SIGNATURE_MISMATCH_MESSAGE);
    });

    it("rejects an empty file", () => {
      expect(findSignatureProblem(Buffer.alloc(0), "menu.pdf")).toBe(
        SIGNATURE_MISMATCH_MESSAGE,
      );
    });
  });

  describe("docx", () => {
    it("accepts a file that starts with the zip header", () => {
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(findSignatureProblem(buffer, "menu.docx")).toBeNull();
    });

    it("rejects plain text renamed to .docx", () => {
      expect(
        findSignatureProblem(Buffer.from("halo, ini teks biasa"), "menu.docx"),
      ).toBe(SIGNATURE_MISMATCH_MESSAGE);
    });

    it("rejects a file shorter than the zip header", () => {
      expect(findSignatureProblem(Buffer.from([0x50, 0x4b]), "menu.docx")).toBe(
        SIGNATURE_MISMATCH_MESSAGE,
      );
    });

    it("rejects a file where only part of the header matches", () => {
      expect(
        findSignatureProblem(
          Buffer.from([0x50, 0x4b, 0x05, 0x06]),
          "menu.docx",
        ),
      ).toBe(SIGNATURE_MISMATCH_MESSAGE);
    });
  });

  describe("txt and md", () => {
    it("accepts normal UTF-8 text, including non-ASCII characters", () => {
      expect(
        findSignatureProblem(
          Buffer.from("Menu: nasi goreng — Rp 25.000"),
          "menu.txt",
        ),
      ).toBeNull();
    });

    it("rejects a .txt that contains a NUL byte", () => {
      expect(
        findSignatureProblem(Buffer.from([0x68, 0x00, 0x69]), "menu.txt"),
      ).toBe(BINARY_TEXT_MESSAGE);
    });

    it("rejects a UTF-16 text file (full of NUL bytes)", () => {
      const utf16 = Buffer.from("Halo dunia", "utf16le");
      expect(findSignatureProblem(utf16, "menu.txt")).toBe(BINARY_TEXT_MESSAGE);
    });

    it("applies the same rule to .md", () => {
      expect(
        findSignatureProblem(Buffer.from([0x23, 0x00, 0x20]), "menu.md"),
      ).toBe(BINARY_TEXT_MESSAGE);
      expect(findSignatureProblem(Buffer.from("# Menu"), "menu.md")).toBeNull();
    });

    it("lets an empty text file through (the empty-document check handles it later)", () => {
      expect(findSignatureProblem(Buffer.alloc(0), "menu.txt")).toBeNull();
    });
  });

  describe("extensions", () => {
    it("matches the extension case-insensitively", () => {
      expect(
        findSignatureProblem(Buffer.from("%PDF-1.7"), "MENU.PDF"),
      ).toBeNull();
      expect(
        findSignatureProblem(Buffer.from("<html></html>"), "MENU.PDF"),
      ).toBe(SIGNATURE_MISMATCH_MESSAGE);
    });

    it("uses the LAST extension of a name with several dots", () => {
      expect(
        findSignatureProblem(Buffer.from("<html></html>"), "menu.v2.final.pdf"),
      ).toBe(SIGNATURE_MISMATCH_MESSAGE);
    });

    it("returns null for an unknown extension or a name without one (the parser rejects those)", () => {
      expect(findSignatureProblem(Buffer.from("x"), "menu.exe")).toBeNull();
      expect(findSignatureProblem(Buffer.from("x"), "menu")).toBeNull();
    });
  });
});
