// Shared formatting utilities — date, currency, labels
// Imported by billing components and any future dashboard components that need formatting

// Format Rupiah — "Rp 149.000" style, "Gratis" for zero
export function formatRupiah(amount: number): string {
  if (amount === 0) return "Gratis";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

// Format Date to Indonesian locale — "1 Juni 2026"
export function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Maps Midtrans payment_type to human-readable Indonesian label
export function formatPaymentMethod(method: string | null): string {
  if (!method) return "—";
  const map: Record<string, string> = {
    bank_transfer: "Transfer Bank",
    gopay: "GoPay",
    qris: "QRIS",
    ovo: "OVO",
    dana: "DANA",
    credit_card: "Kartu Kredit",
  };
  return map[method] ?? method;
}

export function formatRelativeTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 30) return `${diffDays} hari lalu`;

  const diffMonths = Math.floor(diffDays / 30);
  
  if (diffMonths < 12) return `${diffMonths} bulan lalu`;

  const diffYears = Math.floor(diffDays / 365);

  return `${diffYears} tahun lalu`;
}

// Safely converts a Neon timestamp to a JavaScript Date
// Drizzle .select() returns Date objects, db.execute() returns strings
// The Z suffix forces UTC interpretation on strings — matches how Neon stores timestamps
export function parseNeonTimestamp(value: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Neon strings: "2026-05-15 07:30:11.720836" — no timezone marker
  // Adding T and Z: "2026-05-15T07:30:11.720836Z" — valid UTC ISO string
  return new Date(String(value).replace(" ", "T") + "Z");
}

export const toDateSafe = (value: unknown): Date => {
  if (value instanceof Date) return value;

  const raw = String(value);
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");

  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
    ? normalized
    : `${normalized}Z`;

  return new Date(withZone);
};
