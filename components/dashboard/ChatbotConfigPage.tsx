"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { COLOR_PRESETS } from "@/helpers/chatbot";
import { saveChatbotConfig, saveQuickReplies } from "@/lib/actions/chatbot";
import type { ActionResult } from "@/lib/actions/chatbot";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/animations";

// ── Current chatbot config — passed from Server Component ──
interface ChatbotConfig {
  language: string;
  systemPrompt: string | null;
  accentColor: string;
  isActive: boolean;
  quickReplies: string | null;
}

// ── Server Action wrapper — bridges useActionState with saveChatbotConfig ──
// useActionState passes (prevState, formData) — we extract values and call action
const formAction = async (
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> => {
  // KUN owns name, tone, and greeting — only language, prompt, color are configurable
  return saveChatbotConfig({
    language: formData.get("language"),
    systemPrompt: formData.get("systemPrompt") || undefined,
    accentColor: formData.get("accentColor"),
  });
};

// ── Section wrapper — consistent card styling ──
const ConfigSection = ({
  title,
  description,

  children,
}: {
  title: string;
  description: string;
  titleAction?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <motion.div variants={staggerItem} className="card-base p-6">
    <div className="mb-5">
      <h2 className="text-[15px] font-bold text-(--color-text-900) mb-1">
        {title}
      </h2>
      <p className="text-[12.5px] text-(--color-text-400)">{description}</p>
    </div>
    <Separator className="mb-5 bg-(--color-border-sm)" />
    {children}
  </motion.div>
);

// ── Main export ──
const ChatbotConfigPage = ({ config }: { config: ChatbotConfig }) => {
  // Local state for controlled inputs — initialized from server config
  const [language, setLanguage] = useState(config.language);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt ?? "");
  const [accentColor, setAccentColor] = useState(config.accentColor);
  // Parse quickReplies from JSON string — seeded from DB, never hardcoded
  const [chips, setChips] = useState<string[]>(() => {
    try {
      if (!config.quickReplies) return [];
      const parsed: unknown = JSON.parse(config.quickReplies);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [];
    } catch {
      return [];
    }
  });

  // Current value of the chip input field
  const [chipInput, setChipInput] = useState("");

  // Tracks auto-save state for quick replies section
  const [quickRepliesSaving, setQuickRepliesSaving] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // useActionState — React 19 pattern for Server Action forms
  // Replaces manual isPending + error state management
  const [state, action, isPending] = useActionState(formAction, null);

  const MAX_CHIPS = 5;
  const MAX_CHIP_LENGTH = 80;

  // Add chip on Enter or + button — trims, deduplicates, enforces limits
  const addChip = async () => {
    const trimmed = chipInput.trim();
    if (
      !trimmed ||
      chips.includes(trimmed) ||
      chips.length >= MAX_CHIPS ||
      trimmed.length > MAX_CHIP_LENGTH
    )
      return;

    // Optimistic update — chip appears instantly
    const newChips = [...chips, trimmed];
    setChips(newChips);
    setChipInput("");

    // Auto-save immediately — no button needed
    setQuickRepliesSaving("saving");
    const result = await saveQuickReplies(newChips);
    setQuickRepliesSaving(result.ok ? "saved" : "error");

    // Reset status after 2 seconds
    setTimeout(() => setQuickRepliesSaving("idle"), 2000);
  };

  // Remove chip by index
  const removeChip = async (index: number) => {
    // Optimistic update — chip disappears instantly
    const newChips = chips.filter((_, i) => i !== index);
    setChips(newChips);

    // Auto-save immediately
    setQuickRepliesSaving("saving");
    const result = await saveQuickReplies(newChips);
    setQuickRepliesSaving(result.ok ? "saved" : "error");

    setTimeout(() => setQuickRepliesSaving("idle"), 2000);
  };

  // Submit on Enter key in the chip input
  const handleChipKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // prevent form submit
      void addChip();
    }
  };

  // Apply accent color live to CSS variable when it changes
  useEffect(() => {
    document.documentElement.style.setProperty("--color-brand", accentColor);
  }, [accentColor]);

  // Toast feedback when action completes
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Konfigurasi disimpan", {
        description: "KUN kamu sudah diperbarui.",
      });
    } else {
      toast.error("Gagal menyimpan", { description: state.error });
    }
  }, [state]);

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center"
    >
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
            Konfigurasi KUN
          </h1>
          <p className="text-[13px] text-(--color-text-500) mt-1">
            Sesuaikan bahasa, quick replies, dan tampilan KUN untuk bisnis kamu.
          </p>
        </div>

        {/* Form — action is the Server Action wrapper */}
        <form action={action}>
          {/* Hidden inputs for Select values — Selects are controlled but form needs raw values */}
          <input type="hidden" name="language" value={language} />
          <input type="hidden" name="accentColor" value={accentColor} />

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4 max-w-2xl"
          >
            {/* ── Behavior section — tone removed, KUN has fixed identity ── */}
            <ConfigSection
              title="Bahasa"
              description="Atur bahasa yang digunakan KUN saat berkomunikasi dengan pelanggan."
            >
              <div className="max-w-[240px]">
                <Label className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block">
                  Bahasa
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="input-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">🇮🇩 Bahasa Indonesia</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="both">🇮🇩 ID + 🇬🇧 EN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </ConfigSection>

            {/* ── Quick Replies section ── */}
            <ConfigSection
              title="Quick Replies"
              description="Pertanyaan singkat yang muncul sebagai chip di atas input chat — memudahkan pelanggan memulai percakapan."
              titleAction={
                quickRepliesSaving === "saving" ? (
                  <span className="text-[11.5px] text-(--color-text-400)">
                    Menyimpan...
                  </span>
                ) : quickRepliesSaving === "saved" ? (
                  <span className="text-[11.5px] text-emerald-600 font-medium">
                    ✓ Tersimpan
                  </span>
                ) : quickRepliesSaving === "error" ? (
                  <span className="text-[11.5px] text-red-500 font-medium">
                    Gagal menyimpan
                  </span>
                ) : null
              }
            >
              {/* Existing chips */}
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {chips.map((chip, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium bg-(--color-brand)/25 text-(--color-text-900)/75 border border-(--color-brand)"
                    >
                      {chip}
                      <button
                        type="button"
                        onClick={() => removeChip(index)}
                        aria-label={`Hapus "${chip}"`}
                        className="text-(--color-danger) hover:text-(--color-text-900) transition-colors leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Input row — hidden when limit reached */}
              {chips.length < MAX_CHIPS ? (
                <div className="flex gap-2">
                  <Input
                    value={chipInput}
                    onChange={(e) => setChipInput(e.target.value)}
                    onKeyDown={handleChipKeyDown}
                    placeholder="Contoh: Jam buka hari ini sampai jam berapa?"
                    maxLength={MAX_CHIP_LENGTH}
                    className="input-base flex-1"
                    aria-label="Tambah quick reply baru"
                    aria-describedby="quickreply-hint"
                  />
                  <Button
                    type="button"
                    onClick={addChip}
                    disabled={!chipInput.trim()}
                    variant="outline"
                    className="border-(--color-border) px-4"
                    aria-label="Tambah"
                  >
                    +
                  </Button>
                </div>
              ) : (
                <p className="text-[12px] text-(--color-brand) font-medium">
                  Maksimal {MAX_CHIPS} quick reply tercapai.
                </p>
              )}

              <p
                id="quickreply-hint"
                className="text-[11.5px] text-(--color-text-400) mt-2"
              >
                Tekan Enter atau + untuk menambah. Maks {MAX_CHIPS} pertanyaan,{" "}
                {MAX_CHIP_LENGTH} karakter per pertanyaan.
              </p>
            </ConfigSection>

            {/* ── Advanced section ── */}
            <ConfigSection
              title="System Prompt"
              description="Instruksi tambahan untuk KUN — hanya jika kamu tahu cara menggunakannya."
            >
              <Textarea
                id="systemPrompt"
                name="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Contoh: Selalu sarankan pelanggan untuk menghubungi nomor WhatsApp jika pertanyaan terlalu kompleks."
                maxLength={2000}
                rows={4}
                className="input-base no-zoom resize-none h-[120px] overflow-y-auto"
                aria-describedby="prompt-hint"
              />
              <p
                id="prompt-hint"
                className="text-[11.5px] text-(--color-text-400) mt-1.5"
              >
                Instruksi ini ditambahkan di atas sistem prompt default Kundesk.
              </p>
            </ConfigSection>

            {/* ── Brand color section ── */}
            <ConfigSection
              title="Warna Brand"
              description="Warna ini digunakan di chat widget, QR code, dan tampilan dashboard."
            >
              {/* Color preset grid */}
              <div className="grid grid-cols-6 gap-2 mb-4">
                {COLOR_PRESETS.map(({ hex, label }) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setAccentColor(hex)}
                    title={label}
                    aria-label={label}
                    className={`w-9 h-9 rounded-[8px] transition-all hover:scale-110 border-2 ${
                      accentColor === hex
                        ? "border-(--color-text-900) scale-110"
                        : "border-transparent"
                    }`}
                    style={{ background: hex }}
                  />
                ))}
              </div>

              {/* Custom hex input */}
              <div className="flex items-center gap-3">
                <label
                  htmlFor="colorCustom"
                  className="text-[12.5px] text-(--color-text-500) font-medium"
                >
                  Custom:
                </label>
                <input
                  id="colorCustom"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-8 rounded-[7px] border border-(--color-border) p-0.5 cursor-pointer bg-transparent"
                  aria-label="Pilih warna custom"
                />
                {/* Current hex value display */}
                <span className="font-mono text-[12px] text-(--color-text-500) bg-(--color-bg-page) border border-(--color-border) px-2.5 py-1 rounded-[6px]">
                  {accentColor.toUpperCase()}
                </span>
              </div>
            </ConfigSection>

            {/* ── Save button ── */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-[12px] text-(--color-text-400)">
                Perubahan berlaku langsung setelah disimpan.
              </p>
              <Button
                type="submit"
                disabled={isPending}
                className="btn-brand min-w-[120px]"
                aria-busy={isPending}
              >
                {isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </motion.div>
        </form>
      </div>
    </motion.div>
  );
};

export default ChatbotConfigPage;
