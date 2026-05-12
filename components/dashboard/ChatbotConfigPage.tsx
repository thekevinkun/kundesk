"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/animations";
import { saveChatbotConfig } from "@/lib/actions/chatbot";
import type { ActionResult } from "@/lib/actions/chatbot";
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

// ── Color presets — same 12 as Topbar ──
const COLOR_PRESETS = [
  { hex: "#069494", label: "Teal (Default)" },
  { hex: "#3b82f6", label: "Biru" },
  { hex: "#8b5cf6", label: "Ungu" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#ef4444", label: "Merah" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#14b8a6", label: "Teal Alt" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#84cc16", label: "Lime" },
  { hex: "#64748b", label: "Slate" },
];

// ── Current chatbot config — passed from Server Component ──
interface ChatbotConfig {
  name: string;
  language: string;
  tone: string;
  greetingMessage: string | null;
  systemPrompt: string | null;
  accentColor: string;
  isActive: boolean;
}

// ── Server Action wrapper — bridges useActionState with saveChatbotConfig ──
// useActionState passes (prevState, formData) — we extract values and call action
async function formAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return saveChatbotConfig({
    name: formData.get("name"),
    language: formData.get("language"),
    tone: formData.get("tone"),
    greetingMessage: formData.get("greetingMessage") || undefined,
    systemPrompt: formData.get("systemPrompt") || undefined,
    accentColor: formData.get("accentColor"),
  });
}

// ── Section wrapper — consistent card styling ──
const ConfigSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
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
  const [name, setName] = useState(config.name);
  const [language, setLanguage] = useState(config.language);
  const [tone, setTone] = useState(config.tone);
  const [greetingMessage, setGreetingMessage] = useState(
    config.greetingMessage ?? "",
  );
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt ?? "");
  const [accentColor, setAccentColor] = useState(config.accentColor);

  // useActionState — React 19 pattern for Server Action forms
  // Replaces manual isPending + error state management
  const [state, action, isPending] = useActionState(formAction, null);

  // Apply accent color live to CSS variable when it changes
  useEffect(() => {
    document.documentElement.style.setProperty("--color-brand", accentColor);
  }, [accentColor]);

  // Toast feedback when action completes
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Konfigurasi disimpan", {
        description: "Chatbot kamu sudah diperbarui.",
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
      className="max-w-3xl mx-auto"
    >
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Konfigurasi Chatbot
        </h1>
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Sesuaikan nama, bahasa, nada bicara, dan tampilan chatbot kamu.
        </p>
      </div>

      {/* Form — action is the Server Action wrapper */}
      <form action={action}>
        {/* Hidden inputs for Select values — Selects are controlled but form needs raw values */}
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="tone" value={tone} />
        <input type="hidden" name="accentColor" value={accentColor} />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-4 max-w-2xl"
        >
          {/* ── Identity section ── */}
          <ConfigSection
            title="Identitas Bot"
            description="Nama dan cara bot memperkenalkan diri ke pelanggan."
          >
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="name"
                  className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block"
                >
                  Nama Bot
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Sari Assistant"
                  maxLength={50}
                  className="input-base"
                  aria-describedby="name-hint"
                />
                <p
                  id="name-hint"
                  className="text-[11.5px] text-(--color-text-400) mt-1"
                >
                  Nama ini ditampilkan di header chat widget.
                </p>
              </div>

              <div>
                <Label
                  htmlFor="greetingMessage"
                  className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block"
                >
                  Pesan Sambutan{" "}
                  <span className="text-(--color-text-400) font-normal">
                    (opsional)
                  </span>
                </Label>
                <Textarea
                  id="greetingMessage"
                  name="greetingMessage"
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  placeholder="Halo! Ada yang bisa saya bantu hari ini? 😊"
                  maxLength={300}
                  rows={2}
                  className="input-base resize-none"
                  aria-describedby="greeting-hint"
                />
                <p
                  id="greeting-hint"
                  className="text-[11.5px] text-(--color-text-400) mt-1"
                >
                  Pesan pertama yang dilihat pelanggan saat membuka chat.
                </p>
              </div>
            </div>
          </ConfigSection>

          {/* ── Behavior section ── */}
          <ConfigSection
            title="Bahasa & Nada Bicara"
            description="Atur bagaimana bot berkomunikasi dengan pelanggan."
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
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

              <div>
                <Label className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block">
                  Nada Bicara
                </Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="input-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">😊 Ramah</SelectItem>
                    <SelectItem value="professional">💼 Profesional</SelectItem>
                    <SelectItem value="formal">🎩 Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ConfigSection>

          {/* ── Advanced section ── */}
          <ConfigSection
            title="System Prompt"
            description="Instruksi tambahan untuk AI — hanya jika kamu tahu cara menggunakannya."
          >
            <Textarea
              id="systemPrompt"
              name="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Contoh: Selalu sarankan pelanggan untuk menghubungi nomor WhatsApp jika pertanyaan terlalu kompleks."
              maxLength={2000}
              rows={4}
              className="input-base resize-none"
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
    </motion.div>
  );
};

export default ChatbotConfigPage;
