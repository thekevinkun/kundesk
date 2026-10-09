"use client";

// Last step: what happened, in plain words. Only mentions the things that actually apply.

interface ImportResultStepProps {
  saved: number;
  skippedDuplicates: number;
  leftOver: number; // rows that stayed unselected and were not saved
  anyStale: boolean;
}

const ImportResultStep = ({
  saved,
  skippedDuplicates,
  leftOver,
  anyStale,
}: ImportResultStepProps) => (
  <div className="space-y-2 py-2" aria-live="polite">
    <p className="text-[14px] font-semibold text-(--color-text-900)">
      {saved > 0
        ? `${saved} item tersimpan.`
        : "Tidak ada item baru yang disimpan."}
    </p>
    {skippedDuplicates > 0 && (
      <p className="text-[12.5px] text-(--color-text-500)">
        {skippedDuplicates} item dilewati karena namanya sudah ada.
      </p>
    )}
    {leftOver > 0 && (
      <p className="text-[12.5px] text-(--color-text-500)">
        {leftOver} item tidak dipilih, jadi tidak disimpan.
      </p>
    )}
    {anyStale && (
      <p className="text-[12.5px] text-(--color-text-500)">
        KUN belum selesai memproses sebagian item. Tekan &quot;Coba lagi&quot;
        di banner atas daftar bagian untuk menyelesaikannya.
      </p>
    )}
  </div>
);

export default ImportResultStep;
