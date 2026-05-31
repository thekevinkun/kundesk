"use client";

import { Button } from "@/components/ui/button";
import { ConfigSection } from "@/components/dashboard/settings";

interface DangerZoneSectionProps {
  onDeleteClick: () => void;
}

const DangerZoneSection = ({ onDeleteClick }: DangerZoneSectionProps) => {
  return (
    <ConfigSection
      title="Zona Berbahaya"
      description="Tindakan ini tidak dapat dibatalkan. Harap baca dengan teliti."
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[13.5px] font-semibold text-(--color-text-900) mb-1">
            Hapus Akun Bisnis
          </p>

          <p className="text-[12.5px] text-(--color-text-500) leading-relaxed">
            Menghapus akun akan menghapus semua dokumen, percakapan, konfigurasi
            KUN, dan data bisnis kamu secara permanen. Tindakan ini tidak
            dapat dibatalkan.
          </p>
        </div>

        <Button
          type="button"
          variant="destructive"
          onClick={onDeleteClick}
          className="shrink-0 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all dark:bg-red-950/30 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-600 dark:hover:text-white"
        >
          Hapus Akun
        </Button>
      </div>
    </ConfigSection>
  );
};

export default DangerZoneSection;
