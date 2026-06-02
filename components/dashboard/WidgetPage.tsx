"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fadeUp } from "@/lib/animations";

interface WidgetPageProps {
  data: {
    orgSlug: string;
    accentColor: string;
  } | null;
}

// Copy text to clipboard with toast feedback
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} disalin!`);
  } catch {
    toast.error("Gagal menyalin. Coba manual.");
  }
};

const WidgetPage = ({ data }: WidgetPageProps) => {
  const [activeTab, setActiveTab] = useState<"qr" | "link" | "embed">("qr");

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <div className="text-[14px] font-semibold text-(--color-text-500)">
            KUN belum dikonfigurasi
          </div>
          <div className="text-[12px] text-(--color-text-400) mt-1">
            Aktifkan KUN dulu di halaman Konfigurasi
          </div>
        </div>
      </div>
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
  const chatUrl = `${appUrl}/chat/${data.orgSlug}`;

  // Script loads widget.js with org + color as query params
  // data-* attributes shown for readability but actual values passed via src params
  const embedCode = `
    <script
      src="${appUrl}/api/widget?org=${data.orgSlug}&color=${encodeURIComponent(data.accentColor)}"
      async>
    </script>
  `;

  const tabs = [
    { id: "qr" as const, label: "QR Code", icon: "📱" },
    { id: "link" as const, label: "Shareable Link", icon: "🔗" },
    { id: "embed" as const, label: "Embed Widget", icon: "🧩" },
  ];

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-(--color-text-900) leading-tight">
          Widget & Embed
        </h1>
        <p className="text-[13px] text-(--color-text-500) mt-1">
          Bagikan KUN ke pelanggan lewat QR code, link, atau embed di website.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left — delivery channels */}
        <div className="space-y-5">
          {/* Tab selector */}
          <div className="card-base p-1.5 flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[10px] text-[13px] font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-(--color-brand) text-white shadow-sm"
                    : "text-(--color-text-500) hover:text-(--color-text-900) hover:bg-(--color-bg-page)"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* QR Code tab */}
          {activeTab === "qr" && (
            <div className="card-base p-6">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                {/* QR preview */}
                <div className="flex-shrink-0 self-center">
                  <div
                    className="w-[180px] h-[180px] rounded-[14px] border-2 border-(--color-border) 
                    overflow-hidden bg-white flex items-center justify-center"
                  >
                    {/* QR image from our API route */}
                    <Image
                      src={`/api/qr/${data.orgSlug}?format=svg`}
                      alt={`QR Code untuk KUN`}
                      width={160}
                      height={160}
                      className="w-full h-full object-contain p-2"
                      unoptimized
                    />
                  </div>
                  {/* Download PNG button */}
                  <Link
                    href={`/api/qr/${data.orgSlug}?format=png`}
                    download={`qr-${data.orgSlug}.png`}
                    className="mt-3 flex items-center justify-center gap-2 w-full py-2 px-4 rounded-[10px] bg-(--color-bg-page) border border-(--color-border) text-[12.5px] font-semibold text-(--color-text-500) hover:border-(--color-brand) hover:text-(--color-brand) transition-all"
                  >
                    ⬇ Download PNG
                  </Link>
                </div>

                {/* Instructions */}
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-(--color-text-900) mb-2">
                    QR Code KUN
                  </div>
                  <p className="text-[13px] text-(--color-text-500) leading-relaxed mb-4">
                    Cetak dan tempel di konter, menu, atau packaging. Pelanggan
                    scan kamera — langsung terbuka chat dengan{" "}
                    <strong>KUN</strong>.
                  </p>

                  {/* Use cases */}
                  <div className="space-y-2">
                    {[
                      "Print di struk atau packaging",
                      "Pasang di meja atau etalase toko",
                      "Tambahkan ke brosur atau banner",
                      "Share di WhatsApp atau Instagram",
                    ].map((tip) => (
                      <div
                        key={tip}
                        className="flex items-center gap-2 text-[12.5px] text-(--color-text-500)"
                      >
                        <span className="text-(--color-brand)">✓</span>
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shareable Link tab */}
          {activeTab === "link" && (
            <div className="card-base p-6">
              <div className="text-[15px] font-bold text-(--color-text-900) mb-2">
                Link Publik KUN
              </div>
              <p className="text-[13px] text-(--color-text-500) leading-relaxed mb-5">
                Bagikan link ini ke pelanggan lewat WhatsApp, Instagram bio,
                atau Google Maps. Tidak perlu website.
              </p>

              {/* Link display */}
              <div className="flex items-center gap-2 p-3 bg-(--color-bg-page) border border-(--color-border) rounded-[10px]">
                <span className="text-[13px] text-(--color-brand) font-mono flex-1 truncate">
                  {chatUrl}
                </span>
                <button
                  onClick={() => copyToClipboard(chatUrl, "Link")}
                  className="flex-shrink-0 px-3 py-1.5 bg-(--color-brand) text-white text-[12px] font-semibold rounded-[7px] hover:bg-(--color-brand-dark) transition-colors"
                >
                  Salin
                </button>
              </div>

              {/* Channel tips */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  {
                    icon: "💬",
                    channel: "WhatsApp Broadcast",
                    tip: "Kirim ke semua kontak pelanggan",
                  },
                  {
                    icon: "📸",
                    channel: "Instagram Bio",
                    tip: "Satu link di bio untuk semua pertanyaan",
                  },
                  {
                    icon: "🗺️",
                    channel: "Google Maps",
                    tip: "Tambahkan ke deskripsi bisnis",
                  },
                  {
                    icon: "🛒",
                    channel: "Tokopedia / Shopee",
                    tip: "Link di deskripsi produk atau toko",
                  },
                ].map(({ icon, channel, tip }) => (
                  <div
                    key={channel}
                    className="p-3 bg-(--color-bg-page) border border-(--color-border) rounded-[10px]"
                  >
                    <div className="text-xl mb-1.5">{icon}</div>
                    <div className="text-[12.5px] font-semibold text-(--color-text-900) mb-0.5">
                      {channel}
                    </div>
                    <div className="text-[11.5px] text-(--color-text-400)">
                      {tip}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Embed Widget tab */}
          {activeTab === "embed" && (
            <div className="card-base p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="text-[15px] font-bold text-(--color-text-900)">
                  Embed di Website
                </div>
                <span className="text-[11px] font-bold bg-(--color-brand-light) text-(--color-brand) px-2.5 py-1 rounded-full border border-(--color-brand-mid)">
                  Starter & Pro
                </span>
              </div>
              <p className="text-[13px] text-(--color-text-500) leading-relaxed mb-5">
                Copy satu baris kode ini ke website kamu — chat bubble muncul di
                pojok kanan bawah.
              </p>

              {/* Code block */}
              <div className="relative">
                <pre className="bg-(--color-text-900) text-green-400 text-[12px] font-mono p-4 rounded-[10px] overflow-x-auto leading-relaxed whitespace-pre">
                  {embedCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(embedCode, "Kode embed")}
                  className="absolute top-3 right-3 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold rounded-[6px] transition-colors"
                >
                  Salin
                </button>
              </div>

              {/* Install instructions */}
              <div className="mt-5 space-y-3">
                <div className="text-[12px] font-bold text-(--color-text-400) uppercase tracking-[0.08em]">
                  Cara pasang
                </div>
                {[
                  {
                    step: "1",
                    text: "Copy kode di atas",
                  },
                  {
                    step: "2",
                    text: "Paste sebelum tag </body> di website kamu",
                  },
                  {
                    step: "3",
                    text: "Chat bubble langsung muncul — tidak perlu restart",
                  },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-(--color-brand) text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div className="text-[13px] text-(--color-text-500) leading-relaxed">
                      {text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — live chat preview */}
        <div className="space-y-5">
          {/* Preview card */}
          <div className="card-base overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-(--color-border-sm)">
              <div className="text-[13px] font-bold text-(--color-text-900)">
                Preview KUN
              </div>
              <div className="text-[11.5px] text-(--color-text-400) mt-0.5">
                Tampilan yang dilihat pelanggan
              </div>
            </div>

            {/* Mini chat preview */}
            <div className="p-4">
              <div
                className="rounded-[14px] overflow-hidden border border-(--color-border)"
                style={{ height: "380px" }}
              >
                {/* Chat header */}
                <div
                  className="px-4 py-3 flex items-center gap-3"
                  style={{ background: data.accentColor }}
                >
                  {/* KUN avatar in preview */}
                  <Image
                    src="/images/kun_logo.png"
                    alt="KUN"
                    width={34}
                    height={34}
                    className="object-contain brightness-[.90]"
                  />
                  <div>
                    <div className="text-white font-semibold text-[13px]">
                      Talk with KUN
                    </div>
                    <div className="text-white/70 text-[11px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block" />
                      Online
                    </div>
                  </div>
                </div>

                {/* Chat body */}
                <div
                  className="bg-gray-50 h-full p-3 space-y-2 overflow-y-auto
                  [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar]:h-[5px]
                  [&::-webkit-scrollbar-thumb]:bg-(--color-border-sm)
                  hover:[&::-webkit-scrollbar-thumb]:bg-(--color-border)"
                >
                  {/* KUN greeting preview — hardcoded since greeting is now fixed */}
                  <div className="flex items-end gap-2">
                    <Image
                      src="/images/kun_logo.png"
                      alt="KUN"
                      width={22}
                      height={22}
                      className="object-contain brightness-[.85]"
                    />

                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 text-[12px] text-gray-700 max-w-[80%] leading-relaxed shadow-sm">
                      Halo! Aku KUN, asisten virtual bisnis ini. Ada yang bisa
                      aku bantu?
                    </div>
                  </div>

                  {/* Sample exchange */}
                  <div className="flex justify-end">
                    <div
                      className="rounded-2xl rounded-br-sm px-3 py-2 text-[12px] text-white max-w-[80%]"
                      style={{ background: data.accentColor }}
                    >
                      Jam buka sampai kapan?
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <Image
                      src="/images/kun_logo.png"
                      alt="KUN"
                      width={22}
                      height={22}
                      className="object-contain brightness-[.85]"
                    />

                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 text-[12px] text-gray-700 max-w-[80%] leading-relaxed shadow-sm">
                      Kami buka setiap hari dari jam 08.00 hingga 22.00 WIB. Ada
                      lagi yang bisa saya bantu? 😊
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="card-base p-5">
            <div className="text-[13px] font-bold text-(--color-text-900) mb-3">
              Info KUN
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Asisten AI", value: "KUN" },
                { label: "URL Publik", value: `/${data.orgSlug}`, mono: true },
                {
                  label: "Warna Brand",
                  value: data.accentColor,
                  color: data.accentColor,
                },
              ].map(({ label, value, mono, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2 border-b border-(--color-border-sm) last:border-0"
                >
                  <span className="text-[12.5px] text-(--color-text-500)">
                    {label}
                  </span>
                  <div className="flex items-center gap-2">
                    {color && (
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/10"
                        style={{ background: color }}
                      />
                    )}
                    <span
                      className={`text-[12.5px] font-semibold text-(--color-text-900) ${
                        mono ? "font-mono" : ""
                      }`}
                    >
                      {value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WidgetPage;
