"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TipPanel = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-5 mt-4 mb-1 rounded-[10px] border border-(--color-brand-mid) bg-(--color-brand-light) overflow-hidden">
      {/* Header — always visible, click to expand */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls="tip-panel-content"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">💡</span>
          <span className="text-[13px] font-semibold text-(--color-brand-dark)">
            Tips dokumen terbaik
          </span>
        </div>
        {/* Chevron — rotates when open */}
        <span
          className={`text-[11px] text-(--color-brand) transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="tip-panel-content"
            key="tip-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-(--color-brand-mid)">
              <p className="text-[12.5px] text-(--color-brand-dark) mt-3 leading-relaxed">
                AI kamu hanya sebaik dokumen yang kamu upload. Berikut struktur
                terbaik:
              </p>

              <ul className="space-y-2">
                {[
                  {
                    icon: "✅",
                    text: "Satu topik per bagian — misahkan menu, harga, dan FAQ ke bagian yang jelas",
                  },
                  {
                    icon: "✅",
                    text: 'Tulis harga secara eksplisit — "Nasi Goreng: Rp 25.000" bukan hanya "25rb"',
                  },
                  {
                    icon: "✅",
                    text: 'Jam operasional lengkap dengan pengecualian — "Buka 08.00–22.00, tutup hari Senin"',
                  },
                  {
                    icon: "✅",
                    text: "Gunakan kalimat pendek dan langsung — hindari paragraf panjang tanpa struktur",
                  },
                  {
                    icon: "❌",
                    text: "Hindari tabel dari PDF scan — teks tidak terbaca dengan baik oleh AI",
                  },
                ].map(({ icon, text }) => (
                  <li
                    key={text}
                    className="flex items-start gap-2 text-[12px] text-(--color-brand-dark)"
                  >
                    <span className="flex-shrink-0 mt-0.5">{icon}</span>
                    <span className="leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>

              {/* Gold standard example */}
              <div className="mt-3 p-3 bg-white/60 rounded-[8px] border border-(--color-brand-mid)">
                <p className="text-[11.5px] font-semibold text-(--color-brand-dark) mb-1.5">
                  Contoh struktur ideal (kedai-bu-sari.txt):
                </p>
                <pre className="text-[11px] text-(--color-brand-dark) font-mono leading-relaxed whitespace-pre-wrap">
                  {`MENU MAKANAN\nNasi Goreng Spesial — Rp 25.000\nGado-gado — Rp 22.000\n\nJAM BUKA\nSenin–Sabtu: 08.00–22.00\nMinggu: 10.00–20.00\n\nFAQ\nQ: Apakah ada parkir?\nA: Ya, parkir gratis untuk 2 jam pertama.`}
                </pre>
              </div>

              {/* Download sample */}
              <Link
                href="/samples/kedai-bu-sari.txt"
                download="kedai-bu-sari.txt"
                className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold text-(--color-brand) hover:text-(--color-brand-dark) transition-colors group/dl"
              >
                <span className="w-7 h-7 rounded-[7px] bg-white/60 border border-(--color-brand-mid) flex items-center justify-center text-sm group-hover/dl:bg-(--color-brand-light) transition-colors">
                  ⬇️
                </span>
                Download contoh dokumen bisnis lengkap (.txt)
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TipPanel;
