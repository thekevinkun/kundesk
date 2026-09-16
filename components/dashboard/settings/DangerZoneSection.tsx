"use client";

import { Button } from "@/components/ui/button";
import { ConfigSection } from "@/components/dashboard/settings";

interface DangerZoneSectionProps {
  onDeleteClick: () => void;
  onCancelClick: () => void;
  isCancelling: boolean;
  // Formatted purge date string, e.g. "15 Oktober 2026" — null when no deletion pending
  pendingPurgeDate: string | null;
}

const DangerZoneSection = ({
  onDeleteClick,
  onCancelClick,
  isCancelling,
  pendingPurgeDate,
}: DangerZoneSectionProps) => {
  return (
    <ConfigSection
      title="Zona Berbahaya"
      description={
        pendingPurgeDate
          ? "Penghapusan akun sedang dijadwalkan."
          : "Tindakan ini memiliki masa tenggang 30 hari. Harap baca dengan teliti."
      }
    >
      {pendingPurgeDate ? (
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13.5px] font-semibold text-amber-600 mb-1">
              Akun dijadwalkan dihapus pada {pendingPurgeDate}
            </p>

            <p className="text-[12.5px] text-(--color-text-500) leading-relaxed">
              Akun kamu masih dapat digunakan seperti biasa sampai tanggal
              tersebut. Batalkan kapan saja sebelum tanggal ini untuk menyimpan
              seluruh data.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onCancelClick}
            disabled={isCancelling}
            aria-busy={isCancelling}
            className="shrink-0 border-(--color-brand) text-(--color-brand) hover:bg-(--color-brand-light)"
          >
            {isCancelling ? "Membatalkan..." : "Batalkan Penghapusan"}
          </Button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13.5px] font-semibold text-(--color-text-900) mb-1">
              Hapus Akun Bisnis
            </p>

            <p className="text-[12.5px] text-(--color-text-500) leading-relaxed">
              Menghapus akun akan menjadwalkan penghapusan seluruh dokumen,
              percakapan, konfigurasi KUN, dan data bisnis kamu dalam 30 hari.
              Kamu tetap dapat membatalkan selama masa tersebut.
            </p>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={onDeleteClick}
            className="shrink-0 bg-red-50 text-red-600 border border-red-200 
              hover:bg-red-600 hover:text-white hover:border-red-600 transition-all dark:bg-red-950/30 
              dark:text-red-400 dark:border-red-900 dark:hover:bg-red-600 dark:hover:text-white"
          >
            Hapus Akun
          </Button>
        </div>
      )}
    </ConfigSection>
  );
};

export default DangerZoneSection;
