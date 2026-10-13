import { describe, expect, it, vi } from "vitest";
import {
  IMPORT_PHOTO_MAX_SIDE,
  MAX_IMPORT_PHOTO_INPUT_BYTES,
  calculateTargetSize,
  compressPhotoForImport,
} from "./image-compress";
import { MAX_IMPORT_PHOTO_BYTES } from "./image-validation";
import type { CompressDeps } from "@/types/image-compress";

// A stand-in for the owner's file — the helper only reads type and size, decoding is injected
function fakeFile(type = "image/jpeg", size = 1000): File {
  return { type, size } as unknown as File;
}

function fakeBitmap(width: number, height: number) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

function blobOf(size: number): Blob {
  return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
}

interface DepsOptions {
  bitmap?: ImageBitmap;
  decodeError?: boolean;
  noContext?: boolean;
  // One entry per toBlob call, in order; the last one repeats
  blobs?: Array<Blob | null>;
}

// Builds fake browser APIs and keeps every mock so tests can inspect the calls
function makeDeps(options: DepsOptions = {}) {
  const bitmap = options.bitmap ?? fakeBitmap(4000, 3000);
  const blobs = options.blobs ?? [blobOf(500_000)];

  const decode = vi.fn(async (file: File) => {
    void file;
    if (options.decodeError) throw new Error("cannot decode");
    return bitmap;
  });
  const fillWhite = vi.fn();
  const draw = vi.fn();
  let toBlobCalls = 0;
  const toBlob = vi.fn(async (type: string, quality: number) => {
    void type;
    void quality;
    const next = blobs[Math.min(toBlobCalls, blobs.length - 1)] ?? null;
    toBlobCalls += 1;
    return next;
  });
  const createCanvas = vi.fn((width: number, height: number) => {
    void width;
    void height;
    return {
      getContext: () => (options.noContext ? null : { fillWhite, draw }),
      toBlob,
    };
  });

  const deps: CompressDeps = { decode, createCanvas };
  return { deps, bitmap, decode, createCanvas, fillWhite, draw, toBlob };
}

describe("calculateTargetSize", () => {
  it("scales a landscape photo to the max long side", () => {
    expect(calculateTargetSize(4000, 3000)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("scales a portrait photo to the max long side", () => {
    expect(calculateTargetSize(3000, 4000)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it("scales a square photo", () => {
    expect(calculateTargetSize(3000, 3000)).toEqual({
      width: 1600,
      height: 1600,
    });
  });

  it("never upscales a small photo", () => {
    expect(calculateTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("leaves a photo exactly at the limit unchanged", () => {
    expect(calculateTargetSize(IMPORT_PHOTO_MAX_SIDE, 900)).toEqual({
      width: IMPORT_PHOTO_MAX_SIDE,
      height: 900,
    });
  });

  it("never returns a side of 0 for an extreme shape", () => {
    expect(calculateTargetSize(10000, 1)).toEqual({ width: 1600, height: 1 });
  });

  it("honours a custom max side", () => {
    expect(calculateTargetSize(2000, 1000, 500)).toEqual({
      width: 500,
      height: 250,
    });
  });
});

describe("compressPhotoForImport — refusing the file", () => {
  it.each(["image/svg+xml", "application/pdf", "text/plain", ""])(
    "rejects type %j without decoding",
    async (type) => {
      const { deps, decode } = makeDeps();

      const result = await compressPhotoForImport(fakeFile(type), deps);

      expect(result).toEqual({
        ok: false,
        error: "Pilih foto berformat JPG, PNG, atau WebP.",
      });
      expect(decode).not.toHaveBeenCalled();
    },
  );

  it.each(["image/jpeg", "image/png", "image/webp", "IMAGE/JPEG"])(
    "accepts type %j",
    async (type) => {
      const { deps } = makeDeps();

      const result = await compressPhotoForImport(fakeFile(type), deps);

      expect(result.ok).toBe(true);
    },
  );

  it("rejects an original file over the input cap without decoding", async () => {
    const { deps, decode } = makeDeps();

    const result = await compressPhotoForImport(
      fakeFile("image/jpeg", MAX_IMPORT_PHOTO_INPUT_BYTES + 1),
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: "Foto terlalu besar. Maksimal 25MB.",
    });
    expect(decode).not.toHaveBeenCalled();
  });

  it("accepts an original file exactly at the input cap", async () => {
    const { deps } = makeDeps();

    const result = await compressPhotoForImport(
      fakeFile("image/jpeg", MAX_IMPORT_PHOTO_INPUT_BYTES),
      deps,
    );

    expect(result.ok).toBe(true);
  });
});

describe("compressPhotoForImport — decoding and drawing", () => {
  it("gives the file to the decoder", async () => {
    const { deps, decode } = makeDeps();
    const file = fakeFile();

    await compressPhotoForImport(file, deps);

    expect(decode).toHaveBeenCalledWith(file);
  });

  it("returns an error when the browser cannot open the file", async () => {
    const { deps, createCanvas } = makeDeps({ decodeError: true });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result).toEqual({
      ok: false,
      error:
        "Foto tidak bisa dibuka. Coba foto lain, atau simpan sebagai JPG dulu.",
    });
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it("returns an error for a zero-size image and still closes the bitmap", async () => {
    const bitmap = fakeBitmap(0, 0);
    const { deps, createCanvas } = makeDeps({ bitmap });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result.ok).toBe(false);
    expect(createCanvas).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("creates the canvas at the scaled size", async () => {
    const { deps, createCanvas } = makeDeps({ bitmap: fakeBitmap(4000, 3000) });

    await compressPhotoForImport(fakeFile(), deps);

    expect(createCanvas).toHaveBeenCalledWith(1600, 1200);
  });

  it("does not upscale a small photo", async () => {
    const { deps, createCanvas } = makeDeps({ bitmap: fakeBitmap(800, 600) });

    await compressPhotoForImport(fakeFile(), deps);

    expect(createCanvas).toHaveBeenCalledWith(800, 600);
  });

  it("fills the background white BEFORE drawing the photo", async () => {
    const { deps, fillWhite, draw } = makeDeps();

    await compressPhotoForImport(fakeFile(), deps);

    expect(fillWhite).toHaveBeenCalledWith(1600, 1200);
    expect(draw).toHaveBeenCalledWith(expect.anything(), 1600, 1200);
    const fillOrder = fillWhite.mock.invocationCallOrder[0] ?? 0;
    const drawOrder = draw.mock.invocationCallOrder[0] ?? 0;
    expect(fillOrder).toBeGreaterThan(0);
    expect(fillOrder).toBeLessThan(drawOrder);
  });

  it("closes the bitmap after a successful draw", async () => {
    const { deps, bitmap } = makeDeps();

    await compressPhotoForImport(fakeFile(), deps);

    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("returns an error and closes the bitmap when there is no 2D context", async () => {
    const { deps, bitmap } = makeDeps({ noContext: true });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result).toEqual({
      ok: false,
      error: "Browser kamu belum bisa memproses foto ini.",
    });
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});

describe("compressPhotoForImport — encoding", () => {
  it("returns the JPEG from the first try when it fits", async () => {
    const blob = blobOf(400_000);
    const { deps, toBlob } = makeDeps({ blobs: [blob] });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result).toEqual({ ok: true, blob });
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith("image/jpeg", 0.8);
  });

  it("accepts a JPEG exactly at the server cap", async () => {
    const { deps } = makeDeps({ blobs: [blobOf(MAX_IMPORT_PHOTO_BYTES)] });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result.ok).toBe(true);
  });

  it("retries at lower quality when the first JPEG is over the cap", async () => {
    const small = blobOf(900_000);
    const { deps, toBlob } = makeDeps({
      blobs: [blobOf(MAX_IMPORT_PHOTO_BYTES + 1), small],
    });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result).toEqual({ ok: true, blob: small });
    expect(toBlob.mock.calls).toEqual([
      ["image/jpeg", 0.8],
      ["image/jpeg", 0.6],
    ]);
  });

  it("gives up with advice after the last quality step", async () => {
    const { deps, toBlob, bitmap } = makeDeps({
      blobs: [blobOf(MAX_IMPORT_PHOTO_BYTES + 1)],
    });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("masih terlalu besar");
    expect(toBlob.mock.calls).toEqual([
      ["image/jpeg", 0.8],
      ["image/jpeg", 0.6],
      ["image/jpeg", 0.4],
    ]);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("returns an error when the browser cannot encode", async () => {
    const { deps } = makeDeps({ blobs: [null] });

    const result = await compressPhotoForImport(fakeFile(), deps);

    expect(result).toEqual({
      ok: false,
      error: "Gagal memproses foto. Coba lagi.",
    });
  });
});
