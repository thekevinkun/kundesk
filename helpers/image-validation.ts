// Validation for the photo import upload — pure functions, no side effects.
// The browser always re-encodes the photo to JPEG before sending (canvas), so the server only
// accepts JPEG. Fewer formats = less file parsing to defend.

// Server cap — the browser aims at ~1MB, 3MB leaves room and stays under Vercel's 4.5MB body limit
export const MAX_IMPORT_PHOTO_BYTES = 3 * 1024 * 1024;

// The only content type the server accepts
const JPEG_MIME = "image/jpeg";

// Every JPEG file starts with the bytes FF D8 FF — the claimed type alone proves nothing
export function hasJpegMagicBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

export interface ImportPhotoInput {
  contentType: string; // what the client claims
  bytes: Uint8Array; // the real file content
}

// Returns null if valid, an owner-safe error message if not (caller maps it to HTTP 400)
export function validateImportPhoto(input: ImportPhotoInput): string | null {
  const { contentType, bytes } = input;

  // Size comes from the real bytes, never from a client-supplied number
  if (bytes.length === 0) return "Foto kosong.";

  if (contentType.trim().toLowerCase() !== JPEG_MIME) {
    return "Format foto tidak didukung.";
  }

  if (bytes.length > MAX_IMPORT_PHOTO_BYTES) {
    return "Foto terlalu besar. Maksimal 3MB.";
  }

  // Last check: the content really is a JPEG, whatever the client said
  if (!hasJpegMagicBytes(bytes)) return "File bukan foto yang valid.";

  return null;
}
