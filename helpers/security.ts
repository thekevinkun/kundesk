// Security helpers — input validation and injection detection
// Pure functions — no side effects, no dependencies, fully unit testable
// Used by chat route (injection) and upload route (file validation)

// ─── Prompt injection patterns ───
// Detects attempts to override AI instructions or extract system prompt
// 15 patterns covering common jailbreak and prompt injection techniques
const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above|all)\s+instructions?/i,
  /forget\s+(everything|all|your|the)\s+(instructions?|rules?|context)/i,
  /you\s+are\s+now\s+(a\s+)?(?!the\s+assistant)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(?!a\s+helpful)/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /override\s+(your\s+)?(instructions?|rules?|guidelines?)/i,
  /system\s*prompt/i,
  /reveal\s+(your\s+)?(instructions?|prompt|rules?)/i,
  /what\s+are\s+your\s+instructions/i,
  /disregard\s+(your\s+)?(previous|prior|all)/i,
  /bypass\s+(your\s+)?(restrictions?|filters?|rules?)/i,
  /<\s*script/i,
  /\{\{.*\}\}/i,
] as const;

// Returns true if the message contains a known injection pattern
// HTTP 200 is returned even on detection — never tip off the attacker
export function detectInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

// ─── Human handoff request patterns ───
// Detects when a customer explicitly wants to speak with a human agent
// Covers Indonesian and English phrasing — bilingual SME customer base
const HANDOFF_PATTERNS = [
  /bicara\s+(sama|dengan|ke)\s+(admin|staff|manusia|orang|cs|operator)/i,
  /hubungi\s+(admin|staff|cs|operator)/i,
  /minta\s+(bicara|ngobrol|chat)\s+(sama|dengan|ke)\s+(manusia|orang|admin|staff)/i,
  /tolong\s+(sambungkan|hubungkan)\s+(ke|sama|dengan)\s+(admin|staff|manusia|orang)/i,
  /ada\s+(manusia|orang|admin|staff)(nya|\s+nya|\s+yang\s+bisa\s+bantu)/i,
  /bisa\s+(bicara|ngobrol|chat)\s+(sama|dengan)\s+(manusia|orang|admin|staff)/i,
  /speak\s+to\s+(a\s+)?(human|agent|staff|person|admin)/i,
  /talk\s+to\s+(an?\s+)?(human|agent|staff|person|admin)/i,
  /connect\s+me\s+(to|with)\s+(a\s+)?(human|agent|staff|person)/i,
] as const;

// Returns true if the customer is requesting a human handoff
export function detectHandoffRequest(message: string): boolean {
  return HANDOFF_PATTERNS.some((pattern) => pattern.test(message));
}

// ─── Upload validation ───
// Validates filename, MIME type, extension, and file size before issuing presigned URL
// Returns null on success, error string on failure — caller decides HTTP status

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"] as const;

// Max file size: 10MB — matches the Project Bible spec
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadValidationInput {
  filename: unknown;
  contentType: unknown;
  fileSize: unknown;
}

// Returns null if valid, error message string if invalid
// Caller maps the string to an HTTP 400 response
export function validateUploadRequest(
  input: UploadValidationInput,
): string | null {
  const { filename, contentType, fileSize } = input;

  // Filename must be a non-empty string
  if (typeof filename !== "string" || !filename.trim()) {
    return "Invalid filename";
  }

  const normalizedFilename = filename.trim().toLowerCase();

  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
    normalizedFilename.endsWith(ext),
  );

  const normalizedContentType =
    typeof contentType === "string" ? contentType.trim().toLowerCase() : "";

  const hasAllowedMimeType =
    normalizedContentType !== "" &&
    ALLOWED_MIME_TYPES.has(normalizedContentType);

  // Always require an allowed extension. MIME is optional because some browsers
  // omit it, but an explicit MIME must still match the allowlist.
  if (
    !hasAllowedExtension ||
    (normalizedContentType !== "" && !hasAllowedMimeType)
  ) {
    return "Only PDF, TXT, MD, and DOCX files are allowed";
  }

  // File size must be a finite positive number under 10MB
  if (
    typeof fileSize !== "number" ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > MAX_FILE_SIZE_BYTES
  ) {
    return "File size must be under 10MB";
  }

  // All checks passed
  return null;
}
