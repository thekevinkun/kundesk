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

// Get every 1st day on next month from current month
export function getNextMonthFirstDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
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

// Well-known Indonesian zone names — every other zone falls back to a "UTC+X" label
const ID_TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

// Used when an org has no timezone set — most Indonesian SMEs run on WIB
export const DEFAULT_TIMEZONE = "Asia/Jakarta";

// True when the string is a real IANA zone the runtime understands (e.g. "Asia/Makassar")
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// "UTC+8", "UTC+5:30", "UTC-4", or "UTC" — the zone's offset at one specific moment
function getUtcOffsetLabel(date: Date, timeZone: string): string {
  const raw =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";

  // longOffset looks like "GMT+08:00" — plain "GMT" means UTC itself
  const match = raw.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  const sign = match?.[1];
  const hours = match?.[2];
  const minutes = match?.[3];
  if (!sign || !hours || !minutes) return "UTC";

  return minutes === "00"
    ? `UTC${sign}${Number(hours)}`
    : `UTC${sign}${Number(hours)}:${minutes}`;
}

// Current date and time in the BUSINESS's timezone — "Minggu, 20 September 2026 — 21.21 WITA (UTC+8)"
// The zone label is always included so KUN never has to guess it
// `now` is injectable so tests can pin the clock (same pattern as formatRelativeTime)
export function getCurrentDateTime(
  timeZone: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): string {
  // A bad or empty zone must never crash a chat request — fall back to the default
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

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
  // Intl gives English weekday abbreviations — map them onto our Indonesian names
  const weekdayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  // Every field below is read in the target zone, never the server's local zone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // 00–23, so midnight is "00", never "24"
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const dayName = dayNames[weekdayIndex[get("weekday")] ?? 0] ?? "";
  const monthName = monthNames[Number(get("month")) - 1] ?? "";

  // Named zones read "WITA (UTC+8)"; everything else just "UTC+1"
  const offset = getUtcOffsetLabel(now, zone);
  const name = ID_TIMEZONE_LABELS[zone];
  const zoneLabel = name ? `${name} (${offset})` : offset;

  return `${dayName}, ${get("day")} ${monthName} ${get("year")} — ${get("hour")}.${get("minute")} ${zoneLabel}`;
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
