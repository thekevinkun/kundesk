// The words the import dialog shows, as pure functions — so the wording is tested instead of
// buried inside components. Indonesian, and "bagian" is never used for a step ("tahap" instead),
// because "bagian" already means a section everywhere else in this app.

import type {
  ImportProgressState,
  ImportSource,
  ImportStep,
  PhotoStage,
} from "@/types/knowledge-import";

const TEXT_DESCRIPTIONS: Record<ImportStep, string> = {
  paste:
    "Tempel daftar item dari WhatsApp, Excel, atau catatan. KUN membacanya, lalu kamu cek dulu sebelum disimpan.",
  reading: "Sedang membaca teks kamu.",
  review: "Cek nama dan harga. Item yang ditandai perlu diperiksa dulu.",
  saving: "Sedang menyimpan item.",
  result: "Impor selesai.",
};

// Only the first two screens differ for a photo; review, saving and result are the same
const PHOTO_DESCRIPTIONS: Pick<
  Record<ImportStep, string>,
  "paste" | "reading"
> = {
  paste:
    "Pilih foto menu atau daftar harga. KUN membacanya, lalu kamu cek dulu sebelum disimpan.",
  reading: "Sedang membaca foto kamu.",
};

export function getStepDescription(
  step: ImportStep,
  source: ImportSource,
): string {
  if (source === "photo" && (step === "paste" || step === "reading")) {
    return PHOTO_DESCRIPTIONS[step];
  }
  return TEXT_DESCRIPTIONS[step];
}

interface ReadingLabelInput {
  source: ImportSource;
  stage: PhotoStage;
  progress: ImportProgressState;
}

// The line above the progress bar while a read is running
export function getReadingLabel({
  source,
  stage,
  progress,
}: ReadingLabelInput): string {
  if (source === "photo") {
    return stage === "compressing"
      ? "Menyiapkan foto..."
      : "Membaca foto. Ini bisa sampai satu menit.";
  }

  // A short paste is one round, so a counter would only confuse
  if (progress.total > 1) {
    const current = Math.min(progress.done + 1, progress.total);
    return `Membaca teks (tahap ${current} dari ${progress.total})`;
  }
  return "Membaca teks...";
}

// "850 KB", "2,4 MB" — Indonesian decimal comma
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
