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
import { removeMember } from "@/lib/actions/team";
import type { TeamMember } from "@/lib/actions/team";
import { REMOVE_COPY } from "./constants";

interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  // Called after successful removal so parent can refresh list
  onRemoved: () => void;
}

const RemoveMemberDialog = ({
  open,
  onOpenChange,
  member,
  onRemoved,
}: RemoveMemberDialogProps) => {
  const [isPending, startTransition] = useTransition();

  if (!member) return null;

  const displayName =
    member.firstName || member.lastName
      ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
      : member.email;

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await removeMember({ userId: member.userId });

      if (result.success) {
        toast.success("Anggota dihapus", {
          description: `${displayName} telah dihapus dari tim.`,
        });
        onOpenChange(false);
        onRemoved();
      } else {
        toast.error("Gagal menghapus anggota", {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{REMOVE_COPY.title}</DialogTitle>
          <DialogDescription>
            Hapus{" "}
            <span className="font-600 text-(--color-text-900)">
              {displayName}
            </span>{" "}
            dari tim? Mereka tidak akan bisa mengakses dashboard ini lagi.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {REMOVE_COPY.cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-(--color-danger) text-white hover:bg-red-600"
            aria-busy={isPending}
          >
            {isPending ? "Menghapus..." : REMOVE_COPY.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveMemberDialog;
