// Pure helpers for catalog import — no DB, no network, fully unit testable

import { detectImportInjection } from "@/helpers/security";
import { MAX_IMPORT_EXTRACT_LINES } from "@/types/knowledge";
import type { ExtractedRow, ImportPrice, ReviewRow } from "@/types/knowledge";

// Key for duplicate detection: "Nasi  Goreng" and "nasi goreng" must count as the same item
export function normalizeTitleKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

// Splits pasted text into batches of at most `maxLines` lines for separate extraction calls.
// Prefers to break at blank lines, because WhatsApp catalogs often put one item over
// several lines (name, then price) and a cut in the middle would split an item in two.
export function splitIntoBatches(
  text: string,
  maxLines: number = MAX_IMPORT_EXTRACT_LINES,
): string[] {
  // Blocks = groups of lines separated by blank lines
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);

  const batches: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length > 0) batches.push(current.join("\n"));
    current = [];
  };

  for (const lines of blocks) {
    // A single block bigger than the limit has no blank line to break on — hard split it
    if (lines.length > maxLines) {
      flush();
      for (let i = 0; i < lines.length; i += maxLines) {
        batches.push(lines.slice(i, i + maxLines).join("\n"));
      }
      continue;
    }
    // This block would overflow the current batch — start a new one
    if (current.length + lines.length > maxLines) flush();
    current.push(...lines);
  }

  flush();
  return batches;
}

// Amounts outside this range are flagged in review — "25" is almost certainly a missing "k",
// and a ten-million-plus price is worth a second look. Tunable.
export const SUSPICIOUS_PRICE_MIN = 500;
export const SUSPICIOUS_PRICE_MAX = 50_000_000;

// Counts lines that contain something — blank lines don't count
export function countNonEmptyLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

// True when a price should get a second look. A missing price (null) is NOT "suspicious" —
// the review screen treats it separately, because it must be fixed before saving.
export function isSuspiciousPrice(price: ImportPrice | null): boolean {
  if (price === null || price.mode === "contact") return false;

  const amounts =
    price.mode === "fixed" ? [price.amount] : [price.min, price.max];
  return amounts.some(
    (amount) => amount < SUSPICIOUS_PRICE_MIN || amount > SUSPICIOUS_PRICE_MAX,
  );
}

// Adds review warnings to extracted rows. existingTitles = names already in the target section.
// The FIRST occurrence of a name in a batch is not a duplicate; later repeats are.
export function flagRows(
  rows: ExtractedRow[],
  existingTitles: string[],
): ReviewRow[] {
  const seen = new Set(existingTitles.map(normalizeTitleKey));

  return rows.map((row) => {
    const key = normalizeTitleKey(row.title);
    const duplicate = seen.has(key);
    seen.add(key);

    return {
      ...row,
      flags: {
        injection:
          detectImportInjection(row.title) ||
          detectImportInjection(row.description),
        suspiciousPrice: isSuspiciousPrice(row.price),
        duplicate,
      },
    };
  });
}

// Used by the save step: drops rows whose name already exists (or repeats earlier in the batch).
// Keeps the first occurrence and the original order.
export function dropDuplicates<T extends { title: string }>(
  rows: T[],
  existingTitles: string[],
): { fresh: T[]; skipped: number } {
  const seen = new Set(existingTitles.map(normalizeTitleKey));
  const fresh: T[] = [];

  for (const row of rows) {
    const key = normalizeTitleKey(row.title);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(row);
  }

  return { fresh, skipped: rows.length - fresh.length };
}
