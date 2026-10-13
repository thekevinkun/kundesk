// @vitest-environment node
// Needs Node's own FormData, File and Response — jsdom's versions differ
import { describe, expect, it, vi } from "vitest";
import { uploadImportPhoto } from "./knowledge-import-photo-upload";

const PHOTO = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x01])], {
  type: "image/jpeg",
});

const REVIEW_ROW = {
  title: "Nasi Goreng",
  description: "",
  price: { mode: "fixed", amount: 25000 },
  flags: { injection: false, suspiciousPrice: false, duplicate: false },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("uploadImportPhoto — the request", () => {
  it("POSTs the section id and the photo as a JPEG file", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { rows: [], remainingSlots: 5, truncated: false },
      }),
    );

    await uploadImportPhoto({ sectionId: 7, photo: PHOTO }, fetchFn);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/knowledge/import-photo");
    expect(init.method).toBe("POST");

    const form = init.body as FormData;
    expect(form.get("sectionId")).toBe("7");
    const file = form.get("photo") as File;
    expect(file.name).toBe("menu.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBe(4);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { rows: [], remainingSlots: 1, truncated: false },
      }),
    );
    const controller = new AbortController();

    await uploadImportPhoto(
      { sectionId: 1, photo: PHOTO, signal: controller.signal },
      fetchFn,
    );

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});

describe("uploadImportPhoto — no signal", () => {
  it("sends a null signal to fetch when the caller has none", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { rows: [], remainingSlots: 1, truncated: false },
      }),
    );

    await uploadImportPhoto({ sectionId: 1, photo: PHOTO }, fetchFn);

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeNull();
  });
});

describe("uploadImportPhoto — the answer", () => {
  it("returns the rows, free slots and truncated flag on success", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { rows: [REVIEW_ROW], remainingSlots: 40, truncated: true },
      }),
    );

    const result = await uploadImportPhoto(
      { sectionId: 1, photo: PHOTO },
      fetchFn,
    );

    expect(result).toEqual({
      success: true,
      data: { rows: [REVIEW_ROW], remainingSlots: 40, truncated: true },
    });
  });

  it("passes the route's own error message through, whatever the status", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: "Terlalu banyak impor foto. Coba lagi nanti.",
        },
        429,
      ),
    );

    const result = await uploadImportPhoto(
      { sectionId: 1, photo: PHOTO },
      fetchFn,
    );

    expect(result).toEqual({
      success: false,
      error: "Terlalu banyak impor foto. Coba lagi nanti.",
    });
  });

  it("explains a 413 that is not JSON (Vercel's own page)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response("Request Entity Too Large", { status: 413 }),
      );

    const result = await uploadImportPhoto(
      { sectionId: 1, photo: PHOTO },
      fetchFn,
    );

    expect(result).toEqual({
      success: false,
      error: "Foto terlalu besar. Maksimal 3MB.",
    });
  });

  it("gives a generic message for an HTML error page", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response("<html>Bad gateway</html>", { status: 502 }),
      );

    const result = await uploadImportPhoto(
      { sectionId: 1, photo: PHOTO },
      fetchFn,
    );

    expect(result).toEqual({
      success: false,
      error: "Gagal membaca foto. Coba lagi.",
    });
  });

  it.each([
    ["a JSON array", []],
    ["null", null],
    ["a success without data", { success: true }],
    [
      "data without rows",
      { success: true, data: { remainingSlots: 1, truncated: false } },
    ],
    [
      "data with a text slot count",
      {
        success: true,
        data: { rows: [], remainingSlots: "5", truncated: false },
      },
    ],
    [
      "data without the truncated flag",
      { success: true, data: { rows: [], remainingSlots: 5 } },
    ],
    ["a failure without a message", { success: false }],
  ])("gives a generic message for %s", async (_label, body) => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(body));

    const result = await uploadImportPhoto(
      { sectionId: 1, photo: PHOTO },
      fetchFn,
    );

    expect(result).toEqual({
      success: false,
      error: "Gagal membaca foto. Coba lagi.",
    });
  });

  it("lets a dropped connection throw, for the runner to handle", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("network down"));

    await expect(
      uploadImportPhoto({ sectionId: 1, photo: PHOTO }, fetchFn),
    ).rejects.toThrow("network down");
  });
});
