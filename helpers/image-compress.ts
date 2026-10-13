// Shrinks and re-encodes a photo as JPEG in the browser before upload.
// Why: a phone photo is 3–8MB, the server cap is 3MB and Vercel's body limit is 4.5MB; a ~1600px
// JPEG is usually under 1MB and is plenty to read a menu. Re-encoding through a canvas also strips
// EXIF data (GPS location included) — the server only ever sees pixels.
// The browser APIs are injected (CompressDeps) so the logic is tested without a canvas.

import { MAX_IMPORT_PHOTO_BYTES } from "@/helpers/image-validation";
import type {
  CompressCanvas,
  CompressDeps,
  CompressResult,
} from "@/types/image-compress";

// Longest side after resizing — enough to read small menu print, small enough to stay light
export const IMPORT_PHOTO_MAX_SIDE = 1600;

// Max size of the ORIGINAL file — bounds the memory the browser needs to decode it
export const MAX_IMPORT_PHOTO_INPUT_BYTES = 25 * 1024 * 1024;

// Tried in order until the JPEG fits the server cap
const QUALITY_STEPS = [0.8, 0.6, 0.4] as const;

// What the owner may pick. SVG is excluded on purpose; an empty type (some browsers) is refused too
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ERROR_TYPE = "Pilih foto berformat JPG, PNG, atau WebP.";
const ERROR_INPUT_TOO_BIG = "Foto terlalu besar. Maksimal 25MB.";
const ERROR_DECODE =
  "Foto tidak bisa dibuka. Coba foto lain, atau simpan sebagai JPG dulu.";
const ERROR_NO_CANVAS = "Browser kamu belum bisa memproses foto ini.";
const ERROR_ENCODE = "Gagal memproses foto. Coba lagi.";
const ERROR_STILL_TOO_BIG =
  "Foto masih terlalu besar setelah dikompres. Potret lebih dekat, atau pakai foto yang lebih sederhana.";

// Scales to fit maxSide on the long side, keeping the shape. Never upscales; never returns 0.
export function calculateTargetSize(
  width: number,
  height: number,
  maxSide: number = IMPORT_PHOTO_MAX_SIDE,
): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= maxSide) return { width, height };

  const scale = maxSide / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Draws the decoded image onto a new canvas. Always closes the bitmap (it holds memory).
// Returns null when the browser cannot give a canvas or a 2D context.
function drawToCanvas(
  bitmap: ImageBitmap,
  deps: CompressDeps,
): CompressCanvas | null {
  try {
    const { width, height } = calculateTargetSize(bitmap.width, bitmap.height);
    const canvas = deps.createCanvas(width, height);
    const context = canvas.getContext();
    if (!context) return null;

    // White first: JPEG has no transparency, and a transparent PNG would otherwise turn black
    context.fillWhite(width, height);
    context.draw(bitmap, width, height);
    return canvas;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

// The real browser APIs. createImageBitmap applies the photo's EXIF rotation, so a portrait
// photo is not uploaded sideways. Only touched when called — safe to import anywhere.
export const browserCompressDeps: CompressDeps = {
  decode: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    return {
      getContext: () => {
        const context = canvas.getContext("2d");
        if (!context) return null;
        return {
          fillWhite: (w, h) => {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, w, h);
          },
          draw: (image, w, h) => context.drawImage(image, 0, 0, w, h),
        };
      },
      toBlob: (type, quality) =>
        new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
    };
  },
};

// Turns the owner's chosen file into a JPEG that fits the server cap, or an owner-safe error.
export async function compressPhotoForImport(
  file: File,
  deps: CompressDeps = browserCompressDeps,
): Promise<CompressResult> {
  if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, error: ERROR_TYPE };
  }
  if (file.size > MAX_IMPORT_PHOTO_INPUT_BYTES) {
    return { ok: false, error: ERROR_INPUT_TOO_BIG };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await deps.decode(file);
  } catch {
    return { ok: false, error: ERROR_DECODE };
  }

  // A zero-size image has nothing to read
  if (bitmap.width <= 0 || bitmap.height <= 0) {
    bitmap.close();
    return { ok: false, error: ERROR_DECODE };
  }

  const canvas = drawToCanvas(bitmap, deps);
  if (!canvas) return { ok: false, error: ERROR_NO_CANVAS };

  // The pixels are on the canvas once; only the JPEG quality changes between tries
  for (const quality of QUALITY_STEPS) {
    let blob: Blob | null;
    try {
      blob = await canvas.toBlob("image/jpeg", quality);
    } catch {
      return { ok: false, error: ERROR_ENCODE };
    }
    if (!blob) return { ok: false, error: ERROR_ENCODE };

    if (blob.size <= MAX_IMPORT_PHOTO_BYTES) return { ok: true, blob };
  }

  return { ok: false, error: ERROR_STILL_TOO_BIG };
}
