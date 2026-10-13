import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_PHOTO_BYTES,
  hasJpegMagicBytes,
  validateImportPhoto,
} from "./image-validation";

// A tiny buffer that starts like a real JPEG
function jpegBytes(length = 10): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

// The PNG signature — a real image, but not a JPEG
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("hasJpegMagicBytes", () => {
  it("accepts FF D8 FF", () => {
    expect(hasJpegMagicBytes(jpegBytes())).toBe(true);
  });

  it("rejects a PNG signature", () => {
    expect(hasJpegMagicBytes(PNG_BYTES)).toBe(false);
  });

  it("rejects fewer than 3 bytes", () => {
    expect(hasJpegMagicBytes(new Uint8Array([0xff, 0xd8]))).toBe(false);
    expect(hasJpegMagicBytes(new Uint8Array([]))).toBe(false);
  });

  it("rejects when only the first two bytes match", () => {
    expect(hasJpegMagicBytes(new Uint8Array([0xff, 0xd8, 0x00]))).toBe(false);
  });
});

describe("validateImportPhoto", () => {
  it("accepts a JPEG with the right type", () => {
    expect(
      validateImportPhoto({ contentType: "image/jpeg", bytes: jpegBytes() }),
    ).toBeNull();
  });

  it("accepts the type in any case and with spaces", () => {
    expect(
      validateImportPhoto({ contentType: " IMAGE/JPEG ", bytes: jpegBytes() }),
    ).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(
      validateImportPhoto({
        contentType: "image/jpeg",
        bytes: new Uint8Array(),
      }),
    ).toBe("Foto kosong.");
  });

  it("rejects any other content type, even with JPEG bytes", () => {
    expect(
      validateImportPhoto({ contentType: "image/png", bytes: jpegBytes() }),
    ).toBe("Format foto tidak didukung.");
    expect(validateImportPhoto({ contentType: "", bytes: jpegBytes() })).toBe(
      "Format foto tidak didukung.",
    );
  });

  it("accepts a file exactly at the size cap", () => {
    expect(
      validateImportPhoto({
        contentType: "image/jpeg",
        bytes: jpegBytes(MAX_IMPORT_PHOTO_BYTES),
      }),
    ).toBeNull();
  });

  it("rejects a file one byte over the cap", () => {
    expect(
      validateImportPhoto({
        contentType: "image/jpeg",
        bytes: jpegBytes(MAX_IMPORT_PHOTO_BYTES + 1),
      }),
    ).toBe("Foto terlalu besar. Maksimal 3MB.");
  });

  it("rejects a PNG that claims to be a JPEG", () => {
    expect(
      validateImportPhoto({ contentType: "image/jpeg", bytes: PNG_BYTES }),
    ).toBe("File bukan foto yang valid.");
  });
});
