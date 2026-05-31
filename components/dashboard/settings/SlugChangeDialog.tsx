"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SlugChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSlug: string;
  newSlug: string;
  isPending: boolean;
  onConfirm: () => void;
}

const SlugChangeDialog = ({
  open,
  onOpenChange,
  currentSlug,
  newSlug,
  isPending,
  onConfirm,
}: SlugChangeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-bold text-(--color-text-900)">
            Konfirmasi Perubahan URL
          </DialogTitle>

          <DialogDescription className="text-[13px] text-(--color-text-500) mt-1">
            URL publik KUN kamu akan berubah. Semua QR code dan link lama
            tidak akan berfungsi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-[10px] border border-(--color-border) bg-(--color-bg-page) p-3">
            <p className="text-[10.5px] font-bold text-(--color-text-400) uppercase tracking-wider mb-1">
              URL Lama
            </p>

            <p className="font-mono text-[12.5px] text-(--color-text-500) line-through">
              kundesk.vercel.app/chat/{currentSlug}
            </p>
          </div>

          <div className="rounded-[10px] border border-(--color-brand-mid) bg-(--color-brand-light) p-3">
            <p className="text-[10.5px] font-bold text-(--color-brand-dark) uppercase tracking-wider mb-1">
              URL Baru
            </p>

            <p className="font-mono text-[12.5px] text-(--color-brand-dark) font-semibold">
              kundesk.vercel.app/chat/{newSlug}
            </p>
          </div>

          <p className="text-[12px] text-(--color-text-400) leading-relaxed">
            Pastikan kamu sudah memperbarui QR code, link di Instagram bio, dan
            semua tempat lain yang menyebarkan link lama.
          </p>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="border-(--color-border) text-(--color-text-700)"
          >
            Batal
          </Button>

          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="btn-brand"
          >
            {isPending ? "Menyimpan..." : "Ya, Ubah URL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SlugChangeDialog;
