"use client";

// Step 1: paste the text. Shows live counts and refuses nothing silently — over the limit,
// the owner sees why and the "Baca teks" button stays disabled.

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { countNonEmptyLines } from "@/helpers/knowledge-import";
import { MAX_IMPORT_INPUT_CHARS } from "@/types/knowledge";

interface ImportPasteStepProps {
  text: string;
  onTextChange: (value: string) => void;
  overLimit: boolean;
  error: string | null;
}

const PLACEHOLDER = `Contoh:
Nasi Goreng Spesial 25k
Es Teh Manis 5rb
Royal Canin Kitten 400g - Rp 95.000`;

const ImportPasteStep = ({
  text,
  onTextChange,
  overLimit,
  error,
}: ImportPasteStepProps) => (
  <div className="space-y-2">
    <Label
      htmlFor="import-text"
      className="text-[12.5px] font-semibold text-(--color-text-700) block"
    >
      Daftar item
    </Label>
    <Textarea
      id="import-text"
      value={text}
      onChange={(e) => onTextChange(e.target.value)}
      placeholder={PLACEHOLDER}
      aria-describedby="import-text-count"
      aria-invalid={overLimit}
      className="input-base no-zoom resize-none h-[220px] overflow-y-auto"
    />
    <div
      id="import-text-count"
      className="flex items-center justify-between text-[11.5px]"
    >
      <span className="text-(--color-text-400)">
        {countNonEmptyLines(text)} baris
      </span>
      <span
        className={
          overLimit ? "text-(--color-danger)" : "text-(--color-text-400)"
        }
      >
        {text.length.toLocaleString("id-ID")} /{" "}
        {MAX_IMPORT_INPUT_CHARS.toLocaleString("id-ID")} karakter
      </span>
    </div>

    {overLimit && (
      <p className="text-[12px] text-(--color-danger)">
        Teks terlalu panjang. Impor dalam dua bagian, atau kurangi teksnya.
      </p>
    )}
    {error && (
      <p role="alert" className="text-[12px] text-(--color-danger)">
        {error}
      </p>
    )}
  </div>
);

export default ImportPasteStep;
