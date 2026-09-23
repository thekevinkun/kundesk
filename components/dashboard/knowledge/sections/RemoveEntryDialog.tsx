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
import { deleteEntry } from "@/lib/actions/knowledge";
import { REMOVE_ENTRY_COPY } from "./constants";
import type { KnowledgeEntryRow } from "@/types/knowledge";

interface RemoveEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: KnowledgeEntryRow | null;
  onRemoved: () => void;
}

const RemoveEntryDialog = ({
  open,
  onOpenChange,
  entry,
  onRemoved,
}: RemoveEntryDialogProps) => {
  const [isPending, startTransition] = useTransition();

  if (!entry) return null;

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteEntry({ id: entry.id });
      if (result.success) {
        toast.success("Entri dihapus");
        onOpenChange(false);
        onRemoved();
        return;
      }
      toast.error("Gagal menghapus entri", { description: result.error });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{REMOVE_ENTRY_COPY.title}</DialogTitle>
          <DialogDescription>
            Hapus{" "}
            <span className="font-semibold text-(--color-text-900)">
              {entry.title}
            </span>
            ? KUN tidak akan lagi menggunakan info ini.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {REMOVE_ENTRY_COPY.cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-(--color-danger) text-white hover:bg-red-600"
            aria-busy={isPending}
          >
            {isPending ? "Menghapus..." : REMOVE_ENTRY_COPY.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveEntryDialog;
