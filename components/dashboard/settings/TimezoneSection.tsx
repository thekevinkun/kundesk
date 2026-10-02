"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigSection } from "@/components/dashboard/settings";
import { updateOrgTimezone } from "@/lib/actions/settings";
import {
  ID_TIMEZONE_LABELS,
  getCurrentDateTime,
  getUtcOffsetLabel,
} from "@/helpers/format";

interface TimezoneSectionProps {
  // The org's saved IANA zone, e.g. "Asia/Makassar"
  timezone: string;
}

// The three buttons owners actually use — Pontianak is also WIB, so it lights up the WIB button
const INDONESIAN_OPTIONS = [
  { name: "WIB", zone: "Asia/Jakarta", aliases: ["Asia/Pontianak"] },
  { name: "WITA", zone: "Asia/Makassar", aliases: [] as string[] },
  { name: "WIT", zone: "Asia/Jayapura", aliases: [] as string[] },
];

// Zones already covered by the buttons never repeat in the search list
const INDONESIAN_ZONES = Object.keys(ID_TIMEZONE_LABELS);

// Search results are capped so the list stays short and cheap to render
const MAX_RESULTS = 40;

// "Makassar — WITA (UTC+8)" for Indonesian zones, "New York (UTC-4)" for the rest
function buildLabel(zone: string, now: Date): string {
  const city = (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  const offset = getUtcOffsetLabel(now, zone);
  const name = ID_TIMEZONE_LABELS[zone];
  return name ? `${city} — ${name} (${offset})` : `${city} (${offset})`;
}

const TimezoneSection = ({ timezone }: TimezoneSectionProps) => {
  const queryClient = useQueryClient();

  const [value, setValue] = useState(timezone);
  const [isPending, startTransition] = useTransition();

  // Search panel for non-Indonesian zones — closed by default
  const [showOthers, setShowOthers] = useState(false);
  const [query, setQuery] = useState("");

  // The full IANA list differs between server and browser, so it loads after
  // mount only — rendering it during SSR would cause a hydration mismatch
  const [allZones, setAllZones] = useState<string[] | null>(null);

  useEffect(() => {
    setAllZones(
      Intl.supportedValuesOf("timeZone").filter(
        (zone) => !INDONESIAN_ZONES.includes(zone),
      ),
    );
  }, []);

  const now = new Date();

  // Filtered, capped results for the search list
  const { results, hasMore } = useMemo(() => {
    if (!allZones) return { results: [] as string[], hasMore: false };
    const needle = query.trim().toLowerCase().replace(/\s+/g, "_");
    const matches = needle
      ? allZones.filter((zone) => zone.toLowerCase().includes(needle))
      : allZones;
    return {
      results: matches.slice(0, MAX_RESULTS),
      hasMore: matches.length > MAX_RESULTS,
    };
  }, [allZones, query]);

  // True when the chosen zone is one of the three buttons (or a Pontianak alias)
  const isIndonesianChoice = INDONESIAN_OPTIONS.some(
    (opt) => opt.zone === value || opt.aliases.includes(value),
  );

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await updateOrgTimezone(value);
        if (result.success) {
          // Charts group by day in the org timezone — refetch them with the new zone
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });

          toast.success("Zona waktu disimpan", {
            description: "KUN akan memakai zona waktu ini mulai sekarang.",
          });
        } else {
          toast.error("Gagal menyimpan", { description: result.error });
        }
      } catch {
        // The action can throw (e.g. session expired, DB down) — never fail silently
        toast.error("Gagal menyimpan", {
          description: "Terjadi kesalahan saat menyimpan. Coba lagi.",
        });
      }
    });
  };

  return (
    <ConfigSection
      title="Zona Waktu"
      description="Dipakai KUN untuk menjawab hari, jam, dan status buka/tutup."
    >
      <div className="space-y-3">
        <div>
          <Label className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block">
            Zona waktu bisnis
          </Label>

          {/* Indonesian zones — one tap, no list to scroll */}
          <div
            className="grid grid-cols-3 gap-2"
            role="group"
            aria-label="Zona waktu Indonesia"
          >
            {INDONESIAN_OPTIONS.map((opt) => {
              const active = opt.zone === value || opt.aliases.includes(value);
              return (
                <button
                  key={opt.zone}
                  type="button"
                  aria-pressed={active}
                  disabled={isPending}
                  onClick={() => setValue(opt.zone)}
                  className={`rounded-[10px] border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-(--color-brand) bg-(--color-brand-light) text-(--color-brand-dark)"
                      : "border-(--color-border) bg-(--color-bg-card) text-(--color-text-700) hover:border-(--color-brand-mid)"
                  }`}
                >
                  <span className="block text-[13px] font-bold">
                    {opt.name}
                  </span>
                  <span className="block text-[11.5px] opacity-80">
                    {getUtcOffsetLabel(now, opt.zone)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected zone outside Indonesia — shown so the choice is never invisible */}
          {!isIndonesianChoice && (
            <p className="text-[12.5px] text-(--color-text-700) mt-2">
              Dipilih:{" "}
              <span className="font-semibold">{buildLabel(value, now)}</span>
            </p>
          )}

          {/* Toggle for the search panel */}
          <button
            type="button"
            aria-expanded={showOthers}
            onClick={() => setShowOthers((open) => !open)}
            className="text-[12.5px] font-semibold text-(--color-brand) mt-3 hover:underline"
          >
            {showOthers
              ? "Tutup"
              : "Bisnis di luar Indonesia? Cari zona waktu lain"}
          </button>

          {showOthers && (
            <div className="mt-2 space-y-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter must never submit the surrounding profile form
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Ketik nama kota, mis. Singapore"
                className="input-base no-zoom"
                aria-label="Cari zona waktu"
              />

              {/* Short scrollable list — never taller than ~190px */}
              <ul
                className="max-h-[190px] overflow-y-auto rounded-[10px] border border-(--color-border) divide-y divide-(--color-border)"
                aria-label="Hasil pencarian zona waktu"
              >
                {allZones === null && (
                  <li className="px-3 py-2 text-[12.5px] text-(--color-text-400)">
                    Memuat daftar zona waktu...
                  </li>
                )}
                {allZones !== null && results.length === 0 && (
                  <li className="px-3 py-2 text-[12.5px] text-(--color-text-400)">
                    Tidak ada zona waktu yang cocok.
                  </li>
                )}
                {results.map((zone) => (
                  <li key={zone}>
                    <button
                      type="button"
                      onClick={() => setValue(zone)}
                      aria-pressed={zone === value}
                      className={`w-full px-3 py-2 text-left text-[12.5px] transition-colors ${
                        zone === value
                          ? "bg-(--color-brand-light) text-(--color-brand-dark) font-semibold"
                          : "text-(--color-text-700) hover:bg-(--color-bg-page)"
                      }`}
                    >
                      {buildLabel(zone, now)}
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <p className="text-[11.5px] text-(--color-text-400)">
                  Menampilkan {MAX_RESULTS} pertama — ketik lebih spesifik untuk
                  mempersempit.
                </p>
              )}
            </div>
          )}

          <p className="text-[11.5px] text-(--color-text-400) mt-2">
            {/* Preview only after mount — a live clock would mismatch during SSR */}
            {allZones
              ? `Waktu bisnis kamu sekarang: ${getCurrentDateTime(value, now)}`
              : "Memuat..."}
          </p>
        </div>

        {/* type="button" so it never submits the surrounding profile form */}
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending || value === timezone}
          className="btn-brand"
          aria-busy={isPending}
        >
          {isPending ? "Menyimpan..." : "Simpan Zona Waktu"}
        </Button>
      </div>
    </ConfigSection>
  );
};

export default TimezoneSection;
