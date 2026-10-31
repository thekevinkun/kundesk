// Content checks for uploaded documents.
// The upload route only sees what the browser CLAIMS (filename, MIME type, size); these checks
// look at the real bytes before a file is parsed.
// Pure functions — no I/O, fully unit testable.

// Shown to the owner when the bytes do not match the extension (PDF / DOCX)
export const SIGNATURE_MISMATCH_MESSAGE =
  "Isi file tidak sesuai dengan ekstensinya.";

// Shown for a .txt / .md that contains binary bytes (for example a UTF-16 file saved as "Unicode")
export const BINARY_TEXT_MESSAGE =
  "File teks ini berisi karakter biner. Simpan ulang sebagai teks UTF-8 lalu upload lagi.";

// A PDF may have a few junk bytes before the header; readers accept it within the first 1024 bytes
const PDF_MAGIC = "%PDF-";
const PDF_SEARCH_BYTES = 1024;

// A .docx is a zip archive, which always starts with "PK\x03\x04"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

// Returns null when the bytes fit the extension, or an owner-safe message when they do not.
// Same extension rule as parseFile in the process route. An unknown extension returns null:
// parseFile already rejects it.
export function findSignatureProblem(
  buffer: Buffer,
  filename: string,
): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      // Look for the header only at the start of the file
      return buffer.subarray(0, PDF_SEARCH_BYTES).includes(PDF_MAGIC)
        ? null
        : SIGNATURE_MISMATCH_MESSAGE;

    case "docx":
      // Every byte of the zip header must match
      return buffer.length >= ZIP_MAGIC.length &&
        ZIP_MAGIC.every((byte, index) => buffer[index] === byte)
        ? null
        : SIGNATURE_MISMATCH_MESSAGE;

    case "txt":
    case "md":
      // Real text never contains a NUL byte; UTF-16 and binary files are full of them
      return buffer.includes(0) ? BINARY_TEXT_MESSAGE : null;

    default:
      return null;
  }
}
