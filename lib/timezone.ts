// Returns the BUSINESS's timezone (orgs.timezone) for dashboard queries and charts
// Previously read a browser cookie, which made the dashboard disagree with KUN
// whenever the viewer's device was in another zone

import { getSession } from "@/lib/auth";
import { getOrgTimezone } from "@/lib/db/queries/org-timezone";
import { DEFAULT_TIMEZONE } from "@/helpers/format";

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedDateParts(date: Date, timezone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((item) => item.type === type)?.value;
    if (!part) throw new Error(`Missing ${type} for timezone ${timezone}`);
    return Number(part);
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedDateParts(date, timezone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - date.getTime()
  );
}

function zonedMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timezone: string,
): Date {
  const wallTimeAsUtc = Date.UTC(year, month - 1, day);
  let instant = wallTimeAsUtc;

  // Resolve the offset again after moving to the target instant. This keeps the
  // conversion correct on daylight-saving transitions without browser-local time.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nextInstant =
      wallTimeAsUtc - getTimezoneOffsetMs(new Date(instant), timezone);
    if (nextInstant === instant) break;
    instant = nextInstant;
  }

  return new Date(instant);
}

// UTC bounds for the owner-local calendar day. The database stores message
// timestamps in UTC, so every time-grouped dashboard query must use this range.
export function getOwnerDayBounds(
  timezone: string,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const local = getZonedDateParts(now, timezone);
  const start = zonedMidnightToUtc(
    local.year,
    local.month,
    local.day,
    timezone,
  );
  const nextLocalDate = new Date(
    Date.UTC(local.year, local.month - 1, local.day + 1),
  );
  const end = zonedMidnightToUtc(
    nextLocalDate.getUTCFullYear(),
    nextLocalDate.getUTCMonth() + 1,
    nextLocalDate.getUTCDate(),
    timezone,
  );

  return { start, end };
}

export async function getOwnerTimezone(): Promise<string> {
  try {
    // orgId comes from the server session, never from the client
    const session = await getSession();
    if (!session) return DEFAULT_TIMEZONE;
    return await getOrgTimezone(session.orgId);
  } catch (err) {
    // A failed lookup must never take the dashboard down — fall back and log
    console.error("[getOwnerTimezone] Failed, using default:", err);
    return DEFAULT_TIMEZONE;
  }
}
