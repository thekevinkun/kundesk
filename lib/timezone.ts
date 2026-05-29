// Reads the owner's local timezone from the browser-set cookie
// Falls back to "Asia/Jakarta" (WIB UTC+7) — most common Indonesian timezone
// Cookie is set by Topbar on mount via Intl.DateTimeFormat().resolvedOptions().timeZone

import { cookies } from "next/headers";

const FALLBACK_TIMEZONE = "Asia/Jakarta";

// Validates that the value is a real IANA timezone — prevents injection
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function getOwnerTimezone(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("tz")?.value;
    if (!raw) return FALLBACK_TIMEZONE;

    const decoded = decodeURIComponent(raw);
    return isValidTimezone(decoded) ? decoded : FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}
