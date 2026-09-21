// Opening-hours logic — pure functions, no DB, no network
// The CODE decides "buka / tutup" and the greeting; the AI only reports it.
// Small models are unreliable at comparing clock times.

import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/helpers/format";
import type { HoursSchedule } from "@/types/knowledge";

// Indexed by JS weekday number (0 = Minggu)
const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

// Monday-first, for display and for finding runs of consecutive days
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type GreetingPeriod = "Pagi" | "Siang" | "Sore" | "Malam";

export interface NextOpening {
  daysAhead: number; // 0 = today
  weekday: number;
  time: string; // "08:00"
}

export type ScheduleStatus =
  | { label: string; open: true; closesAt: string }
  | { label: string; open: false; next: NextOpening | null };

export function dayName(day: number | undefined): string {
  return day === undefined ? "" : (DAY_NAMES[day] ?? "");
}

// "08:00" → 480, "24:00" → 1440 (end of day), anything else → null
export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  if (hours === 24) return minutes === 0 ? 1440 : null;
  return hours <= 23 ? hours * 60 + minutes : null;
}

// "08:00" → "08.00" — the Indonesian style used everywhere else in the prompt
export function formatClock(value: string): string {
  return value.replace(":", ".");
}

// "08.00 – 20.00", or "24 jam" for a full day
export function formatTimeRange(opens: string, closes: string): string {
  if (opens === "00:00" && closes === "24:00") return "24 jam";
  return `${formatClock(opens)} – ${formatClock(closes)}`;
}

// [1,2,3,4,5] → "Senin – Jumat", [6,0] → "Sabtu, Minggu", all seven → "Setiap hari"
export function formatDays(days: number[]): string {
  const selected = new Set<number>(days);
  if (DISPLAY_ORDER.every((day) => selected.has(day))) return "Setiap hari";

  // Group consecutive selected days (Monday-first) into runs
  const runs: number[][] = [];
  let current: number[] | null = null;
  for (const day of DISPLAY_ORDER) {
    if (selected.has(day)) {
      if (!current) {
        current = [];
        runs.push(current);
      }
      current.push(day);
    } else {
      current = null;
    }
  }

  return runs
    .map((run) =>
      run.length >= 3
        ? `${dayName(run[0])} – ${dayName(run[run.length - 1])}`
        : run.map((day) => dayName(day)).join(", "),
    )
    .join(", ");
}

// Weekday and minutes-since-midnight in the business's own timezone
export function getLocalTime(
  now: Date,
  timeZone: string,
): { weekday: number; minutes: number } {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // 00–23, never "24"
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

// Indonesian day parts: pagi 05–10, siang 11–14, sore 15–17, malam 18–04
export function getGreetingPeriod(minutes: number): GreetingPeriod {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
}

// The line of this schedule that is open right now, or null
function findOpenLine(
  schedule: HoursSchedule,
  weekday: number,
  minutes: number,
): HoursSchedule["lines"][number] | null {
  const previousDay = (weekday + 6) % 7;

  for (const line of schedule.lines) {
    const open = parseClock(line.opens);
    const close = parseClock(line.closes);
    if (open === null || close === null) continue; // malformed line — never guess

    if (close > open) {
      // Normal same-day shift
      if (line.days.includes(weekday) && minutes >= open && minutes < close) {
        return line;
      }
    } else {
      // Shift that ends after midnight, e.g. 18.00 – 02.00: today's evening part
      // or yesterday's shift still running
      if (line.days.includes(weekday) && minutes >= open) return line;
      if (line.days.includes(previousDay) && minutes < close) return line;
    }
  }

  return null;
}

// The earliest upcoming opening of this schedule (looks a full week ahead)
function findNextOpening(
  schedule: HoursSchedule,
  weekday: number,
  minutes: number,
): NextOpening | null {
  for (let ahead = 0; ahead <= 7; ahead += 1) {
    const day = (weekday + ahead) % 7;
    let earliest: { open: number; time: string } | null = null;

    for (const line of schedule.lines) {
      const open = parseClock(line.opens);
      if (open === null || parseClock(line.closes) === null) continue;
      if (!line.days.includes(day)) continue;
      // Today's opening only counts if it's still ahead of us
      if (ahead === 0 && open <= minutes) continue;
      if (!earliest || open < earliest.open) {
        earliest = { open, time: line.opens };
      }
    }

    if (earliest)
      return { daysAhead: ahead, weekday: day, time: earliest.time };
  }

  return null;
}

export function getScheduleStatus(
  schedule: HoursSchedule,
  weekday: number,
  minutes: number,
): ScheduleStatus {
  const line = findOpenLine(schedule, weekday, minutes);
  if (line) return { label: schedule.label, open: true, closesAt: line.closes };
  return {
    label: schedule.label,
    open: false,
    next: findNextOpening(schedule, weekday, minutes),
  };
}

function describeNext(next: NextOpening): string {
  const time = formatClock(next.time);
  if (next.daysAhead === 0) return `hari ini pukul ${time}`;
  if (next.daysAhead === 1)
    return `besok (${dayName(next.weekday)}) pukul ${time}`;
  return `hari ${dayName(next.weekday)} pukul ${time}`;
}

// A schedule with no readable line can't be judged — better to say nothing than to say "tutup"
function hasUsableLines(schedule: HoursSchedule): boolean {
  return schedule.lines.some(
    (line) =>
      parseClock(line.opens) !== null && parseClock(line.closes) !== null,
  );
}

// One line per schedule, computed for `now` in the business's timezone.
// Returns null when there is nothing usable, so the prompt stays without a status section.
export function describeOpenStatus(
  schedules: HoursSchedule[],
  timeZone: string,
  now: Date = new Date(),
): string | null {
  const usable = schedules.filter(hasUsableLines);
  if (usable.length === 0) return null;

  const { weekday, minutes } = getLocalTime(now, timeZone);

  return usable
    .map((schedule) => {
      const status = getScheduleStatus(schedule, weekday, minutes);
      if (status.open) {
        const closes =
          status.closesAt === "24:00"
            ? "tengah malam"
            : `pukul ${formatClock(status.closesAt)}`;
        return `- ${status.label}: BUKA sekarang, tutup ${closes}.`;
      }
      return status.next
        ? `- ${status.label}: TUTUP sekarang. Buka lagi ${describeNext(status.next)}.`
        : `- ${status.label}: TUTUP sekarang.`;
    })
    .join("\n");
}
