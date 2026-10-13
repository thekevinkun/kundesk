// @vitest-environment node
// Route Handlers run on Node, and NextRequest needs Node's own FormData and File — jsdom's versions break formData()

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// All mocks are hoisted so the factories below can use them
const m = vi.hoisted(() => ({
  requireOrgAdmin: vi.fn(),
  checkKnowledgeImportPhotoLimit: vi.fn(),
  extractCatalogRowsFromImage: vi.fn(),
  getOrgPlan: vi.fn(),
  getOrgKnowledgeEntryCount: vi.fn(),
  getSectionKind: vi.fn(),
  getSectionEntryTitles: vi.fn(),
  flagRows: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrgAdmin: m.requireOrgAdmin }));
vi.mock("@/lib/redis", () => ({
  checkKnowledgeImportPhotoLimit: m.checkKnowledgeImportPhotoLimit,
}));
// A class checked with instanceof is defined INSIDE the factory (rule 163)
vi.mock("@/lib/ai/extract-image", () => ({
  extractCatalogRowsFromImage: m.extractCatalogRowsFromImage,
  ImageTooDenseError: class ImageTooDenseError extends Error {},
}));
vi.mock("@/lib/db/queries/knowledge", () => ({
  getOrgPlan: m.getOrgPlan,
  getOrgKnowledgeEntryCount: m.getOrgKnowledgeEntryCount,
}));
vi.mock("@/lib/db/queries/knowledge-import", () => ({
  getSectionKind: m.getSectionKind,
  getSectionEntryTitles: m.getSectionEntryTitles,
}));
vi.mock("@/helpers/knowledge-import", () => ({ flagRows: m.flagRows }));
vi.mock("@sentry/nextjs", () => ({ captureException: m.captureException }));

import { ImageTooDenseError } from "@/lib/ai/extract-image";
import { MAX_IMPORT_PHOTO_BYTES } from "@/helpers/image-validation";
import { PLAN_LIMITS } from "@/types/billing";
import { POST } from "./route";

// Bytes that start like a real JPEG (FF D8 FF)
function jpegBytes(length = 10) {
  const bytes = new Uint8Array(length);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes;
}

function photoFile(bytes = jpegBytes(), type = "image/jpeg"): File {
  return new File([bytes], "menu.jpg", { type });
}

interface RequestParts {
  sectionId?: string;
  photo?: File | string | null;
  headers?: Record<string, string>;
}

function buildRequest(parts: RequestParts = {}): NextRequest {
  const form = new FormData();
  const sectionId = parts.sectionId ?? "7";
  form.set("sectionId", sectionId);
  const photo = parts.photo === undefined ? photoFile() : parts.photo;
  if (photo !== null) form.set("photo", photo);
  return new NextRequest("http://localhost/api/knowledge/import-photo", {
    method: "POST",
    body: form,
    headers: parts.headers ?? {},
  });
}

interface JsonBody {
  success: boolean;
  error?: string;
  data?: {
    rows: unknown[];
    remainingSlots: number;
    truncated: boolean;
  };
}

async function readBody(response: Response): Promise<JsonBody> {
  return (await response.json()) as JsonBody;
}

const EXTRACTED_ROWS = [
  {
    title: "Nasi Goreng",
    description: "",
    price: { mode: "fixed", amount: 25000 },
  },
];
const FLAGGED_ROWS = [
  {
    ...EXTRACTED_ROWS[0],
    flags: { injection: false, suspiciousPrice: false, duplicate: false },
  },
];
const USED_SLOTS = 10;
const FREE_SLOTS = PLAN_LIMITS.free.knowledgeEntries - USED_SLOTS;

beforeEach(() => {
  vi.resetAllMocks();
  // Defaults: a signed-in admin, a catalog section, plenty of room, limiter open, a clean read
  m.requireOrgAdmin.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
  m.getSectionKind.mockResolvedValue("catalog");
  m.getOrgPlan.mockResolvedValue("free");
  m.getOrgKnowledgeEntryCount.mockResolvedValue(USED_SLOTS);
  m.checkKnowledgeImportPhotoLimit.mockResolvedValue({
    success: true,
    remaining: 9,
    reset: 0,
  });
  m.extractCatalogRowsFromImage.mockResolvedValue({
    rows: EXTRACTED_ROWS,
    truncated: false,
  });
  m.getSectionEntryTitles.mockResolvedValue(["Es Teh"]);
  m.flagRows.mockReturnValue(FLAGGED_ROWS);
});

// Nothing paid or counted may have happened
function expectNoSpend() {
  expect(m.checkKnowledgeImportPhotoLimit).not.toHaveBeenCalled();
  expect(m.extractCatalogRowsFromImage).not.toHaveBeenCalled();
}

describe("POST /api/knowledge/import-photo — auth", () => {
  it("answers 401 for a signed-out user and does nothing else", async () => {
    m.requireOrgAdmin.mockRejectedValue(new Error("Unauthenticated"));

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
    expect((await readBody(response)).success).toBe(false);
    expect(m.getSectionKind).not.toHaveBeenCalled();
    expectNoSpend();
  });

  it("answers 403 for a non-admin", async () => {
    m.requireOrgAdmin.mockRejectedValue(
      new Error("Hanya admin yang dapat melakukan tindakan ini."),
    );

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
    expectNoSpend();
  });

  it("answers 403 when no organization is active", async () => {
    m.requireOrgAdmin.mockRejectedValue(new Error("No active organization"));

    expect((await POST(buildRequest())).status).toBe(403);
  });
});

describe("POST /api/knowledge/import-photo — the request", () => {
  // Relies on the Request keeping a hand-set content-length header; if this one test fails on the
  // header itself, tell me — the other tests do not depend on it
  it("refuses an oversized body from its declared size, before reading it", async () => {
    const response = await POST(
      buildRequest({
        headers: {
          "content-length": String(MAX_IMPORT_PHOTO_BYTES + 1024 * 1024),
        },
      }),
    );

    expect(response.status).toBe(413);
    expect(m.getSectionKind).not.toHaveBeenCalled();
    expectNoSpend();
  });

  it("answers 400 when the body is not a form", async () => {
    const request = new NextRequest(
      "http://localhost/api/knowledge/import-photo",
      {
        method: "POST",
        body: "not a form",
        headers: { "content-type": "text/plain" },
      },
    );

    expect((await POST(request)).status).toBe(400);
    expectNoSpend();
  });

  it.each(["abc", "-1", "1.5", "0", "1e3", ""])(
    "rejects sectionId %j",
    async (sectionId) => {
      const response = await POST(buildRequest({ sectionId }));

      expect((await readBody(response)).error).toBe("Bagian tidak valid.");

      expect(response.status).toBe(400);
      expect(m.getSectionKind).not.toHaveBeenCalled();
      expectNoSpend();
    },
  );

  it("rejects a missing photo", async () => {
    const response = await POST(buildRequest({ photo: null }));

    expect((await readBody(response)).error).toBe("Foto wajib diisi.");

    expect(response.status).toBe(400);
    expectNoSpend();
  });

  it("rejects a text field posing as the photo", async () => {
    const response = await POST(buildRequest({ photo: "i am a string" }));

    expect((await readBody(response)).error).toBe("Foto wajib diisi.");

    expect(response.status).toBe(400);
    expectNoSpend();
  });
});

describe("POST /api/knowledge/import-photo — photo validation", () => {
  it("rejects a PNG", async () => {
    const response = await POST(
      buildRequest({ photo: photoFile(jpegBytes(), "image/png") }),
    );

    expect(response.status).toBe(400);
    expect((await readBody(response)).error).toBe(
      "Format foto tidak didukung.",
    );
    expect(m.getSectionKind).not.toHaveBeenCalled();
    expectNoSpend();
  });

  it("rejects bytes that are not a JPEG even when the type says so", async () => {
    const notJpeg = new Uint8Array(10); // starts with 00 00 00
    const response = await POST(buildRequest({ photo: photoFile(notJpeg) }));

    expect(response.status).toBe(400);
    expect((await readBody(response)).error).toBe(
      "File bukan foto yang valid.",
    );
    expectNoSpend();
  });

  it("rejects a photo over the size cap", async () => {
    const big = jpegBytes(MAX_IMPORT_PHOTO_BYTES + 1);
    const response = await POST(buildRequest({ photo: photoFile(big) }));

    expect(response.status).toBe(400);
    expect((await readBody(response)).error).toBe(
      "Foto terlalu besar. Maksimal 3MB.",
    );
    expectNoSpend();
  });
});

describe("POST /api/knowledge/import-photo — cheap checks before the paid call", () => {
  it("answers 404 for a missing or foreign section, the same way for both", async () => {
    m.getSectionKind.mockResolvedValue(null);

    const response = await POST(buildRequest());

    expect(response.status).toBe(404);
    expect((await readBody(response)).error).toBe("Bagian tidak ditemukan");
    // Scoped to the session's org, never an id from the form
    expect(m.getSectionKind).toHaveBeenCalledWith("org_1", 7);
    expectNoSpend();
  });

  it("answers 400 for a section that is not a catalog", async () => {
    m.getSectionKind.mockResolvedValue("faq");

    const response = await POST(buildRequest());

    expect(response.status).toBe(400);
    expectNoSpend();
  });

  it("answers 403 when the plan has no free entry slots", async () => {
    m.getOrgKnowledgeEntryCount.mockResolvedValue(
      PLAN_LIMITS.free.knowledgeEntries,
    );

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
    expectNoSpend();
  });

  it("answers 429 when the photo limiter blocks, without calling OpenAI", async () => {
    m.checkKnowledgeImportPhotoLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 0,
    });

    const response = await POST(buildRequest());

    expect(response.status).toBe(429);
    expect(m.checkKnowledgeImportPhotoLimit).toHaveBeenCalledWith("org_1");
    expect(m.extractCatalogRowsFromImage).not.toHaveBeenCalled();
  });
});

describe("POST /api/knowledge/import-photo — success", () => {
  it("returns the flagged rows, the free slots and truncated: false", async () => {
    const response = await POST(buildRequest());
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        rows: FLAGGED_ROWS,
        remainingSlots: FREE_SLOTS,
        truncated: false,
      },
    });
  });

  it("sends the photo's real bytes and an abort signal to the extractor", async () => {
    await POST(buildRequest({ photo: photoFile(jpegBytes(25)) }));

    const [bytes, signal] = m.extractCatalogRowsFromImage.mock.calls[0] as [
      Uint8Array,
      AbortSignal,
    ];
    expect(bytes).toHaveLength(25);
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xff, 0xd8, 0xff]);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("flags the rows against the section's existing titles", async () => {
    await POST(buildRequest());

    expect(m.getSectionEntryTitles).toHaveBeenCalledWith("org_1", 7);
    expect(m.flagRows).toHaveBeenCalledWith(EXTRACTED_ROWS, ["Es Teh"]);
  });

  it("uses the limiter BEFORE the paid call", async () => {
    await POST(buildRequest());

    const limiterOrder =
      m.checkKnowledgeImportPhotoLimit.mock.invocationCallOrder[0] ?? 0;
    const extractOrder =
      m.extractCatalogRowsFromImage.mock.invocationCallOrder[0] ?? 0;
    expect(limiterOrder).toBeGreaterThan(0);
    expect(limiterOrder).toBeLessThan(extractOrder);
  });

  it("passes the truncated flag through", async () => {
    m.extractCatalogRowsFromImage.mockResolvedValue({
      rows: EXTRACTED_ROWS,
      truncated: true,
    });

    const body = await readBody(await POST(buildRequest()));

    expect(body.data?.truncated).toBe(true);
  });
});

describe("POST /api/knowledge/import-photo — failures", () => {
  it("answers 422 with advice when the photo is too dense, and does not alert Sentry", async () => {
    m.extractCatalogRowsFromImage.mockRejectedValue(new ImageTooDenseError());

    const response = await POST(buildRequest());

    expect(response.status).toBe(422);
    expect((await readBody(response)).error).toContain("Potret per bagian");
    expect(m.captureException).not.toHaveBeenCalled();
  });

  it("answers a generic 500 and reports ids only when the read fails", async () => {
    m.extractCatalogRowsFromImage.mockRejectedValue(
      new Error("OpenAI extraction error: 500"),
    );

    const response = await POST(buildRequest());
    const body = await readBody(response);

    expect(response.status).toBe(500);
    expect(body.error).toBe("Gagal membaca foto. Coba lagi.");
    expect(JSON.stringify(body)).not.toContain("OpenAI");
    expect(m.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { orgId: "org_1", action: "importPhoto" },
    });
  });

  it("answers a generic 500 when a database lookup fails", async () => {
    m.getSectionKind.mockRejectedValue(new Error("connection reset: secret"));

    const response = await POST(buildRequest());
    const body = await readBody(response);

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(m.captureException).toHaveBeenCalledTimes(1);
    expectNoSpend();
  });
});
