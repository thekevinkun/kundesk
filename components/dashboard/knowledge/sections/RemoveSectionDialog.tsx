"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteSection } from "@/lib/actions/knowledge";
import { REMOVE_SECTION_COPY } from "./constants";
import type { KnowledgeSectionRow } from "@/types/knowledge";

interface RemoveSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: KnowledgeSectionRow | null;
  onRemoved: () => void;
}

const RemoveSectionDialog = ({
  open,
  onOpenChange,
  section,
  onRemoved,
}: RemoveSectionDialogProps) => {
  const [isPending, startTransition] = useTransition();

  if (!section) return null;

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteSection({ id: section.id });
      if (result.success) {
        toast.success("Bagian dihapus");
        onOpenChange(false);
        onRemoved();
        return;
      }
      toast.error("Gagal menghapus bagian", { description: result.error });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{REMOVE_SECTION_COPY.title}</DialogTitle>
          <DialogDescription>
            Hapus{" "}
            <span className="font-semibold text-(--color-text-900)">
              {section.title}
            </span>
            {section.entries.length > 0
              ? ` beserta ${section.entries.length} entri di dalamnya`
              : ""}
            ? KUN tidak akan lagi menggunakan info ini.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {REMOVE_SECTION_COPY.cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-(--color-danger) text-white hover:bg-red-600"
            aria-busy={isPending}
          >
            {isPending ? "Menghapus..." : REMOVE_SECTION_COPY.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveSectionDialog;
