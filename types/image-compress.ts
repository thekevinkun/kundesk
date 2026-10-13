// Types for the browser-side photo compression (helpers/image-compress.ts).
// The browser APIs are injected as CompressDeps, so the logic is tested with plain fakes.

// What the helper needs from a drawing surface — narrower than a real 2D context on purpose
export interface CompressContext {
  fillWhite(width: number, height: number): void; // white background first, so transparency never turns black
  draw(image: ImageBitmap, width: number, height: number): void; // draws the whole image scaled to the canvas
}

export interface CompressCanvas {
  getContext(): CompressContext | null; // null = the browser gave no 2D context
  toBlob(type: string, quality: number): Promise<Blob | null>; // null = the browser could not encode
}

export interface CompressDeps {
  // Decodes the file, applying its EXIF rotation. Throws if the browser cannot open the file
  decode(file: File): Promise<ImageBitmap>;
  createCanvas(width: number, height: number): CompressCanvas;
}

// Either a JPEG ready to upload, or an owner-safe message
export type CompressResult =
  | { ok: true; blob: Blob }
  | { ok: false; error: string };
