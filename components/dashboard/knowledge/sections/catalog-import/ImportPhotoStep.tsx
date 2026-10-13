"use client";

// Step 1 for photos: pick one photo of a menu or price list. Nothing is read until "Baca foto".
// The real <input type="file"> is hidden; a button opens it (the native input cannot be styled).
// The photo is shrunk in the browser later — the owner may pick a big phone photo.

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/helpers/knowledge-import-labels";

interface ImportPhotoStepProps {
  file: File | null;
  onFileChange: (file: File) => void;
  error: string | null;
}

const ImportPhotoStep = ({
  file,
  onFileChange,
  error,
}: ImportPhotoStepProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    // Reset so picking the SAME file again still fires onChange
    event.target.value = "";
    // Cancelling the picker keeps the previous choice
    if (picked) onFileChange(picked);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePick}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="rounded-[10px] border border-dashed border-(--color-border) p-4 text-center space-y-2">
        <p
          aria-live="polite"
          className="text-[12.5px] text-(--color-text-700) break-all"
        >
          {file
            ? `${file.name} (${formatFileSize(file.size)})`
            : "Belum ada foto dipilih."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="btn-outline text-[12px]"
        >
          {file ? "Ganti foto" : "Pilih foto"}
        </Button>
      </div>

      <ul className="list-disc pl-4 space-y-1 text-[11.5px] text-(--color-text-500)">
        <li>
          Satu foto per impor. Menu panjang? Foto per halaman, lalu impor satu
          per satu.
        </li>
        <li>Pastikan terang, tidak miring, dan tulisan harga terbaca jelas.</li>
        <li>Foto dikirim ke OpenAI untuk dibaca dan tidak kami simpan.</li>
      </ul>

      {error && (
        <p role="alert" className="text-[12px] text-(--color-danger)">
          {error}
        </p>
      )}
    </div>
  );
};

export default ImportPhotoStep;
