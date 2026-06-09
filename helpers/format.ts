// Shared formatting utilities — date, currency, labels
// Imported by billing components and any future dashboard components that need formatting

// Format Rupiah — "Rp 149.000" style, "Gratis" for zero
export function formatRupiah(amount: number): string {
  if (amount === 0) return "Gratis";
  return `Rp ${amount.toLocaleString("id-ID")}`;
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

// Format Date to Indonesian locale — "1 Juni 2026"
export function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Timezone helpers ──
// Returns the device's IANA timezone string — e.g. "Asia/Makassar", "Asia/Jakarta"
// Used to pass local timezone to server-side analytics queries
// Falls back to "Asia/Jakarta" (WIB UTC+7) if browser API unavailable
export function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Asia/Jakarta";
  }
}

// Format local time as HH:MM:SS string in id-ID locale
export function formatLocalClock(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Format current date and time in Indonesian locale with timezone — "1 Juni 2026, 14:30:00 (UTC+7)"
export function getCurrentDateTime(): string {
  const now = new Date();

  const dayNames = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ];

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${dayNames[now.getDay()]}, ${now.getDate()} ${
    monthNames[now.getMonth()]
  } ${now.getFullYear()} — ${String(now.getHours()).padStart(2, "0")}.${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

// Format UTC offset string — e.g. "UTC+8", "UTC+7", "UTC+5:30"
export function formatUtcOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? "+" : "-";
  return offsetMins > 0
    ? `UTC${sign}${offsetHours}:${String(offsetMins).padStart(2, "0")}`
    : `UTC${sign}${offsetHours}`;
}

// Formats a date as relative time in Indonesian —
// "Baru saja", "5 mnt lalu", "2 jam lalu", "3 hari lalu", "4 bulan lalu", "1 tahun lalu"
export function formatRelativeTime(date: Date | string, now?: number): string {
  const d = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Math.max(0, (now ?? Date.now()) - d.getTime());
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

// Format a date as "1 Juni 2026, 14:30:00 (UTC+7)" — includes local time and UTC offset
export const toDateSafe = (value: Date | string | null): Date => {
  if (value === null) return new Date(NaN); // or throw, or return a sentinel
  if (value instanceof Date) return value;

  const raw = value;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");

  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
    ? normalized
    : `${normalized}Z`;

  return new Date(withZone);
};
