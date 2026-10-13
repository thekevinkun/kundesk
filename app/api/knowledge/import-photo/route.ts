// Photo import, step 1: a photo of a menu or price list → candidate rows for the review screen.
// Saves NOTHING — the owner reviews the rows, and the existing save action re-validates them.
// A Route Handler (multipart FormData), not a Server Action: it avoids raising the global Server
// Action body limit, and sending the raw file avoids base64's ~33% size overhead.
// Order matters: every cheap rejection runs BEFORE the rate limiter and OpenAI, so a request that
// cannot succeed costs nothing and uses no allowance (same rule as the text import).
// The photo is never stored and never logged.

import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireOrgAdmin } from "@/lib/auth";
import { checkKnowledgeImportPhotoLimit } from "@/lib/redis";
import {
  ImageTooDenseError,
  extractCatalogRowsFromImage,
} from "@/lib/ai/extract-image";
import {
  getOrgKnowledgeEntryCount,
  getOrgPlan,
} from "@/lib/db/queries/knowledge";
import {
  getSectionEntryTitles,
  getSectionKind,
} from "@/lib/db/queries/knowledge-import";
import { flagRows } from "@/helpers/knowledge-import";
import { readBodyWithLimit } from "@/helpers/read-body-limit";
import {
  MAX_IMPORT_PHOTO_BYTES,
  validateImportPhoto,
} from "@/helpers/image-validation";
import { PLAN_LIMITS } from "@/types/billing";
import type { ActionResult } from "@/types/api";
import type { PhotoExtractResult } from "@/types/knowledge";

// The form also carries the sectionId field and multipart framing — a little room above the photo cap
const FORM_OVERHEAD_BYTES = 64 * 1024;

// One place for every error response, so no branch can forget the shape
function fail(error: string, status: number): NextResponse {
  return NextResponse.json<ActionResult<PhotoExtractResult>>(
    { success: false, error },
    { status },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth: admin only. requireOrgAdmin throws plain Errors — map them to 401 / 403, never a 500 ──
  let orgId: string;
  try {
    ({ orgId } = await requireOrgAdmin());
  } catch (err) {
    const signedOut = err instanceof Error && err.message === "Unauthenticated";
    return signedOut
      ? fail("Silakan masuk dulu.", 401)
      : fail("Hanya admin yang dapat mengimpor.", 403);
  }

  try {
    // ── Fast path only: Content-Length can be missing (chunked) or wrong, so the real limit is the
    // byte counter below. This just refuses an honestly declared huge body before reading anything ──
    const declaredSize = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredSize) &&
      declaredSize > MAX_IMPORT_PHOTO_BYTES + FORM_OVERHEAD_BYTES
    ) {
      return fail("Foto terlalu besar. Maksimal 3MB.", 413);
    }

    // ── Read the body, counting the bytes actually received. Stops at the cap, so a body with no
    // Content-Length (or a lying one) can never be buffered whole. The multipart parser runs only
    // on bytes already known to fit ──
    let form: FormData;
    try {
      const body = await readBodyWithLimit(
        request.body,
        MAX_IMPORT_PHOTO_BYTES + FORM_OVERHEAD_BYTES,
      );
      if (body === null) return fail("Foto terlalu besar. Maksimal 3MB.", 413);

      form = await new Response(body, {
        headers: { "content-type": request.headers.get("content-type") ?? "" },
      }).formData();
    } catch {
      // Not a form, or the connection dropped mid-upload — the owner's request, not our bug
      return fail("Permintaan tidak valid.", 400);
    }

    // sectionId must be plain digits — no signs, decimals or exponents
    const rawSectionId = form.get("sectionId");
    if (typeof rawSectionId !== "string" || !/^\d{1,9}$/.test(rawSectionId)) {
      return fail("Bagian tidak valid.", 400);
    }
    const sectionId = Number(rawSectionId);
    if (sectionId < 1) return fail("Bagian tidak valid.", 400);

    // A text field named "photo" is not a file
    const photo = form.get("photo");
    if (photo === null || typeof photo === "string") {
      return fail("Foto wajib diisi.", 400);
    }

    // ── Validate the photo from its REAL bytes — the claimed type and size prove nothing ──
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const photoError = validateImportPhoto({ contentType: photo.type, bytes });
    if (photoError) return fail(photoError, 400);

    // ── Cheap checks first. Same "not found" whether the section is missing or belongs to another org ──
    const kind = await getSectionKind(orgId, sectionId);
    if (kind === null) return fail("Bagian tidak ditemukan", 404);
    if (kind !== "catalog") {
      return fail("Impor hanya bisa ke bagian katalog.", 400);
    }

    // Advisory only: the real, atomic slot check runs inside the save transaction
    const plan = await getOrgPlan(orgId);
    const used = await getOrgKnowledgeEntryCount(orgId);
    const remainingSlots = Math.max(
      0,
      PLAN_LIMITS[plan].knowledgeEntries - used,
    );
    if (remainingSlots === 0) {
      return fail(
        "Batas entri tercapai. Upgrade plan untuk menambah lebih banyak.",
        403,
      );
    }

    // The limiter sits right before the paid call, so only real reads count
    const limit = await checkKnowledgeImportPhotoLimit(orgId);
    if (!limit.success) {
      return fail("Terlalu banyak impor foto. Coba lagi nanti.", 429);
    }

    // ── The paid call. request.signal cancels it if the owner closes the dialog ──
    let extracted;
    try {
      extracted = await extractCatalogRowsFromImage(bytes, request.signal);
    } catch (err) {
      // Expected, not a bug: the photo holds more items than one read can return
      if (err instanceof ImageTooDenseError) {
        return fail(
          "Foto terlalu padat untuk dibaca sekaligus. Potret per bagian (misalnya satu halaman menu per foto), lalu impor satu per satu.",
          422,
        );
      }

      // Name and message only — never the image, never OpenAI's response body
      console.error(
        "[knowledge-import/photo] extraction failed:",
        err instanceof Error ? `${err.name}: ${err.message}` : "unknown error",
      );
      Sentry.captureException(err, {
        extra: { orgId, action: "importPhoto" },
      });
      return fail("Gagal membaca foto. Coba lagi.", 500);
    }

    // Warnings are advisory — the owner decides in the review screen
    const existingTitles = await getSectionEntryTitles(orgId, sectionId);
    return NextResponse.json<ActionResult<PhotoExtractResult>>({
      success: true,
      data: {
        rows: flagRows(extracted.rows, existingTitles),
        remainingSlots,
        truncated: extracted.truncated,
      },
    });
  } catch (err) {
    // Anything unexpected (a DB or Redis failure) — generic message, ids only in Sentry
    console.error(
      "[knowledge-import/photo] failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown error",
    );
    Sentry.captureException(err, { extra: { orgId, action: "importPhoto" } });
    return fail("Terjadi kesalahan. Coba lagi.", 500);
  }
}
