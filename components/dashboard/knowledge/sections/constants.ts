// Copy + option lists for the Katalog & FAQ tab — shared across its dialogs

import type { SectionKind } from "@/types/knowledge";

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  catalog: "Katalog",
  faq: "FAQ",
  policy: "Kebijakan",
  promo: "Promo",
  note: "Catatan",
};

export const SECTION_KIND_OPTIONS: { value: SectionKind; label: string }[] = [
  { value: "catalog", label: "Katalog — menu, layanan, atau produk berharga" },
  { value: "faq", label: "FAQ — pertanyaan yang sering ditanyakan" },
  { value: "policy", label: "Kebijakan — aturan, syarat, ketentuan" },
  { value: "promo", label: "Promo — penawaran atau diskon" },
  { value: "note", label: "Catatan — info bebas lainnya" },
];

// Wording differs by kind: catalog items go "habis" (rule 175), everything
// else is simply turned on/off
export function availabilityLabel(
  kind: SectionKind,
  isAvailable: boolean,
): string {
  if (kind === "catalog") return isAvailable ? "Tersedia" : "Habis";
  return isAvailable ? "Aktif" : "Nonaktif";
}

export const REMOVE_SECTION_COPY = {
  title: "Hapus bagian ini?",
  cancelLabel: "Batal",
  confirmLabel: "Hapus",
};

export const REMOVE_ENTRY_COPY = {
  title: "Hapus entri ini?",
  cancelLabel: "Batal",
  confirmLabel: "Hapus",
};
