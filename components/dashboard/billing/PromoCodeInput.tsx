"use client";

import { useState } from "react";
import { toast } from "sonner";

interface PromoCodeInputProps {
  // Called with the code string when user applies, null when cleared
  onApply: (code: string | null) => void;
}

const PromoCodeInput = ({ onApply }: PromoCodeInputProps) => {
  const [value, setValue] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  const handleApply = () => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;

    // Store the code — real validation happens at checkout server-side
    setApplied(trimmed);
    onApply(trimmed);
    toast.success(
      `Kode "${trimmed}" diterapkan. Diskon akan dihitung saat checkout.`,
    );
  };

  const handleClear = () => {
    setValue("");
    setApplied(null);
    onApply(null);
    toast.info("Kode promo dihapus.");
  };

  return (
    <div className="mb-6 p-4 rounded-(--radius-sm) bg-(--color-bg-page) border border-(--color-border)">
      <p className="text-xs font-semibold text-(--color-text-700) mb-2">
        🎟 Punya kode promo?
      </p>

      {applied ? (
        // Applied state — show the code with a clear button
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-(--radius-sm) bg-(--color-brand-light) border border-(--color-brand-mid) text-sm font-bold text-(--color-brand)">
            {applied}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 rounded-(--radius-sm) text-xs font-semibold text-(--color-text-500) hover:text-(--color-danger) border border-(--color-border) bg-white transition-colors cursor-pointer"
            aria-label="Hapus kode promo"
          >
            Hapus
          </button>
        </div>
      ) : (
        // Input state — text field + apply button
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
            placeholder="CONTOH: CHRISTMAS50"
            maxLength={50}
            className="input-base flex-1 text-sm uppercase tracking-widest"
            aria-label="Masukkan kode promo"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={!value.trim()}
            className="px-4 py-2 rounded-(--radius-sm) text-xs font-bold bg-(--color-brand) text-white hover:bg-(--color-brand-dark) disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Terapkan
          </button>
        </div>
      )}
    </div>
  );
};

export default PromoCodeInput;
