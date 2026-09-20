// Compiles structured business knowledge (form data) into plain text for the RAG pipeline
// Pure functions — no DB, no network — fully unit testable
// Output feeds the same embed → pgvector path that document chunks use

import { chunkText } from "@/helpers/chunk";
import { formatRupiah } from "@/helpers/format";
import type {
  CompileEntry,
  CompileProfile,
  CompileSection,
  EntryPrice,
  HoursSchedule,
  SyncItem,
  SyncResult,
  SyncStatus,
} from "@/types/knowledge";

// An entry at or under this size stays ONE chunk — a bit above chunkText's own 900 target
// because header lines (path, price, note) are added on top of the body
const MAX_SINGLE_CHUNK_CHARS = 1200;

// Summary chunks stay smaller so a long list never crowds out other chunks in the top-5 retrieval
const MAX_SUMMARY_CHUNK_CHARS = 800;

// Turns a price into customer-facing text
// compact = true is for list summaries: variants collapse to "mulai Rp X"
export function formatEntryPrice(price: EntryPrice, compact = false): string {
  switch (price.mode) {
    case "fixed":
      // Single price — "Rp 25.000"
      return formatRupiah(price.amount);
    case "range":
      // Min–max — "Rp 45.000 – Rp 65.000"
      return `${formatRupiah(price.min)} – ${formatRupiah(price.max)}`;
    case "variants": {
      // No options entered — same wording as "contact" so KUN never invents a price
      if (price.options.length === 0) return "Hubungi kami untuk harga";
      if (compact) {
        // Lists show only the lowest price to stay short
        const lowest = Math.min(...price.options.map((o) => o.amount));
        return `mulai ${formatRupiah(lowest)}`;
      }
      // Full detail — "Di bawah 3 kg: Rp 500.000; 3–5 kg: Rp 600.000"
      return price.options
        .map((o) => `${o.label}: ${formatRupiah(o.amount)}`)
        .join("; ");
    }
    case "contact":
      // Owner chose "depends / ask us"
      return "Hubungi kami untuk harga";
  }
}

// Joins head lines + body into chunk(s); every piece repeats the head so it stays self-contained
// bodyPrefix is "Jawaban: " for FAQs, "" for everything else
function buildChunks(head: string, bodyPrefix: string, body: string): string[] {
  // Try the simple case first — one chunk with everything
  const single = [head, body ? `${bodyPrefix}${body}` : ""]
    .filter(Boolean)
    .join("\n");

  // Short enough, or nothing to split — done
  if (single.length <= MAX_SINGLE_CHUNK_CHARS || !body) return [single];

  // Long body — split it with the shared chunker, then re-attach the head to every piece
  // (chunkText adds no headers itself, so a continuation chunk would lose its context)
  return chunkText(body).map((piece) =>
    [head, `${bodyPrefix}${piece.content}`].join("\n"),
  );
}

// Compiles ONE entry into chunk text(s) — a pinpoint chunk for questions like "harga X?"
// Returns [] when the entry is disabled (non-catalog kinds with isAvailable = false)
export function compileEntryChunks(
  section: CompileSection,
  entry: CompileEntry,
): string[] {
  // Trim once so stray spaces from the form never reach the embedding
  const title = entry.title.trim();
  const body = entry.body.trim();

  // Non-catalog entries switched off (e.g. an ended promo) are simply unknown to KUN
  if (section.kind !== "catalog" && !entry.isAvailable) return [];

  // FAQ has its own question / answer shape
  if (section.kind === "faq") {
    return buildChunks(`Pertanyaan: ${title}`, "Jawaban: ", body);
  }

  // Head lines shared by catalog, policy, promo, and note entries
  const headLines: string[] = [`${section.title} › ${title}`];

  // Price line only when the entry has a price
  if (entry.price) headLines.push(`Harga: ${formatEntryPrice(entry.price)}`);

  // Catalog items marked "habis" stay searchable so KUN can say so instead of "tidak ada"
  if (section.kind === "catalog" && !entry.isAvailable) {
    headLines.push("Status: sedang tidak tersedia");
  }

  // Section note travels with every item, e.g. "Tersedia 07.00 – 10.00"
  if (section.note?.trim()) headLines.push(`Catatan: ${section.note.trim()}`);

  return buildChunks(headLines.join("\n"), "", body);
}

// Builds the header of a summary chunk — part 1 is plain, later parts say "lanjutan"
function buildSummaryHead(section: CompileSection, part: number): string {
  const titleLine = `Daftar lengkap ${section.title}${part > 1 ? ` (lanjutan ${part})` : ""}`;
  // Section note repeats on every part
  return section.note?.trim()
    ? `${titleLine}\nCatatan: ${section.note.trim()}`
    : titleLine;
}

// Compiles a whole catalog section into list chunk(s) — for questions like "apa saja menu sarapan?"
// Returns [] for non-catalog sections and for sections with fewer than 2 entries
// (a one-item list would just duplicate that item's own chunk)
export function compileSectionSummaryChunks(
  section: CompileSection,
  entries: CompileEntry[],
): string[] {
  if (section.kind !== "catalog" || entries.length < 2) return [];

  // One compact line per entry — name, short price, "habis" marker when unavailable
  const lines = entries.map((entry) => {
    const price = entry.price ? `: ${formatEntryPrice(entry.price, true)}` : "";
    const status = entry.isAvailable ? "" : " (sedang tidak tersedia)";
    return `- ${entry.title.trim()}${price}${status}`;
  });

  const result: string[] = [];
  let part = 1;
  let head = buildSummaryHead(section, part);
  let current: string[] = [head];
  // Running length equals the final joined length: head + ("\n" + line) for each line
  let currentLength = head.length;

  for (const line of lines) {
    // Start a new chunk when this line would overflow — but never emit a chunk with zero lines
    if (
      currentLength + line.length + 1 > MAX_SUMMARY_CHUNK_CHARS &&
      current.length > 1
    ) {
      result.push(current.join("\n"));
      part += 1;
      head = buildSummaryHead(section, part);
      current = [head];
      currentLength = head.length;
    }
    current.push(line);
    currentLength += line.length + 1;
  }

  // Flush the last chunk
  result.push(current.join("\n"));
  return result;
}

// One schedule block — label first, then one indented line per day range
function formatSchedule(schedule: HoursSchedule): string {
  const title = `- ${schedule.label}${schedule.note ? ` — ${schedule.note}` : ""}`;
  const lines = schedule.lines.map(
    (line) =>
      `  ${line.days}: ${line.time}${line.note ? ` (${line.note})` : ""}`,
  );
  return [title, ...lines].join("\n");
}

// Compiles the business profile into the block injected into the system prompt on every message
// Returns null when the owner filled in nothing — the prompt then stays exactly as it is today
// The "PROFIL BISNIS" heading is added by the caller (buildSystemPrompt), not here
export function compileProfileBlock(profile: CompileProfile): string | null {
  const parts: string[] = [];

  // Free-text intro — skipped if empty or whitespace only
  if (profile.about?.trim()) parts.push(`Tentang: ${profile.about.trim()}`);

  // Address as one line
  if (profile.address?.trim()) parts.push(`Alamat: ${profile.address.trim()}`);

  // Labeled contacts — a business can have several numbers with different purposes
  if (profile.contacts.length > 0) {
    parts.push(
      [
        "Kontak:",
        ...profile.contacts.map((c) => `- ${c.label}: ${c.value}`),
      ].join("\n"),
    );
  }

  // Named schedules — e.g. Klinik, Pet Shop, Darurat
  if (profile.hours.length > 0) {
    parts.push(
      ["Jam operasional:", ...profile.hours.map(formatSchedule)].join("\n"),
    );
  }

  // Payment methods with optional detail such as an account number
  if (profile.paymentMethods.length > 0) {
    parts.push(
      [
        "Metode pembayaran:",
        ...profile.paymentMethods.map(
          (p) => `- ${p.label}${p.detail ? `: ${p.detail}` : ""}`,
        ),
      ].join("\n"),
    );
  }

  // Nothing filled in — caller skips the whole block
  return parts.length > 0 ? parts.join("\n\n") : null;
}

// Decides exactly which chunks a sync writes: chunks for the target entries + the section summary
// The summary always covers ALL entries (the list changed even if only one entry did)
export function buildSyncItems(
  section: CompileSection,
  entries: (CompileEntry & { id: number })[],
  targetIds: number[],
  sectionId: number,
): SyncItem[] {
  const targets = new Set(targetIds);
  const items: SyncItem[] = [];

  // Per-item chunks — only for the entries being rebuilt, owned by the entry
  for (const entry of entries) {
    if (!targets.has(entry.id)) continue;
    for (const content of compileEntryChunks(section, entry)) {
      items.push({ content, entryId: entry.id, sectionId: null });
    }
  }

  // Summary chunks — owned by the section, built from every entry
  for (const content of compileSectionSummaryChunks(section, entries)) {
    items.push({ content, entryId: null, sectionId });
  }

  return items;
}

// Fingerprint of a section's data — the sync compares it before and after embedding
// A different fingerprint means someone saved something in between
export function buildSectionSnapshot(
  section: { updatedAt: Date },
  entries: { id: number; updatedAt: Date }[],
): string {
  const entryPart = [...entries]
    .sort((a, b) => a.id - b.id) // stable order — row order from the DB must not matter
    .map((entry) => `${entry.id}:${entry.updatedAt.getTime()}`)
    .join(",");
  return `${section.updatedAt.getTime()}|${entryPart}`;
}

// Maps a sync outcome to what the UI shows on the entry
// Anything except a finished sync counts as "stale" — including "superseded",
// because the newer save's own sync will flip it to "synced" a moment later
export function toSyncStatus(result: SyncResult): SyncStatus {
  return result.status === "synced" ? "synced" : "stale";
}
