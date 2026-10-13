// The real network call for photo import: POSTs the compressed photo to the Route Handler.
// Whatever comes back — a normal answer, Vercel's own non-JSON 413 page, a malformed body — leaves
// here as an ActionResult, so callers never see raw responses. A dropped connection or an abort
// still throws; the runner decides what that means.

import type { ActionResult } from "@/types/api";
import type { PhotoExtractResult } from "@/types/knowledge";
import type { PhotoUploadFn } from "@/types/knowledge-import";

const PHOTO_ROUTE = "/api/knowledge/import-photo";

const ERROR_GENERIC = "Gagal membaca foto. Coba lagi.";
const ERROR_TOO_BIG = "Foto terlalu besar. Maksimal 3MB.";

// Narrow on purpose so tests can pass a plain fake instead of the whole fetch type
type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function uploadImportPhoto(
  input: Parameters<PhotoUploadFn>[0],
  // Looked up when called, never at import — safe to load anywhere
  fetchFn: FetchFn = (url, init) => fetch(url, init),
): Promise<ActionResult<PhotoExtractResult>> {
  const form = new FormData();
  form.set("sectionId", String(input.sectionId));
  // A file name is needed for the part to count as a file; the server never uses it
  form.set("photo", input.photo, "menu.jpg");

  const response = await fetchFn(PHOTO_ROUTE, {
    method: "POST",
    body: form,
    signal: input.signal ?? null,
  });

  // Vercel's own 413 page is not JSON, so the status decides the message
  const fallback: ActionResult<PhotoExtractResult> = {
    success: false,
    error: response.status === 413 ? ERROR_TOO_BIG : ERROR_GENERIC,
  };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return fallback;
  }
  if (!isRecord(json)) return fallback;

  // Our route's own refusals: a message that is already safe to show
  if (json.success === false && typeof json.error === "string") {
    return { success: false, error: json.error };
  }

  const data = json.data;
  if (
    json.success === true &&
    isRecord(data) &&
    Array.isArray(data.rows) &&
    typeof data.remainingSlots === "number" &&
    typeof data.truncated === "boolean"
  ) {
    // The rows came from our own route; the shape of the envelope is what is verified here
    return {
      success: true,
      data: {
        rows: data.rows as PhotoExtractResult["rows"],
        remainingSlots: data.remainingSlots,
        truncated: data.truncated,
      },
    };
  }

  return fallback;
}
