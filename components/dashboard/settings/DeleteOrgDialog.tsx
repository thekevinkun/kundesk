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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DELETE_ITEMS } from "@/components/dashboard/settings/constants";

interface DeleteOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  confirmText: string;
  setConfirmText: React.Dispatch<React.SetStateAction<string>>;
  isDeleting: boolean;
  isConfirmed: boolean;
  onConfirm: () => void;
}

const DeleteOrgDialog = ({
  open,
  onOpenChange,
  orgName,
  confirmText,
  setConfirmText,
  isDeleting,
  isConfirmed,
  onConfirm,
}: DeleteOrgDialogProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!isDeleting) {
          onOpenChange(open);

          if (!open) {
            setConfirmText("");
          }
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-bold text-red-600 dark:text-red-400">
            Hapus Akun Bisnis
          </DialogTitle>

          <DialogDescription className="text-[13px] text-(--color-text-500) mt-1">
            Tindakan ini permanen dan tidak dapat dibatalkan. Seluruh data
            bisnis kamu akan dihapus selamanya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-[10px] border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
            <p className="text-[12px] font-bold text-red-700 dark:text-red-400 mb-2">
              Yang akan dihapus permanen:
            </p>

            <ul className="space-y-1">
              {DELETE_ITEMS.map((item) => (
                <li
                  key={item}
                  className="text-[12px] text-red-600 dark:text-red-400 flex items-center gap-2"
                >
                  <span className="text-red-400">✕</span>

                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Label
              htmlFor="deleteConfirm"
              className="text-[13px] font-semibold text-(--color-text-700) mb-1.5 block"
            >
              Ketik{" "}
              <span className="font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                {orgName}
              </span>{" "}
              untuk konfirmasi
            </Label>

            <Input
              id="deleteConfirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={orgName}
              className="input-base"
              aria-describedby="delete-confirm-hint"
              disabled={isDeleting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isConfirmed && !isDeleting) {
                  onConfirm();
                }
              }}
            />

            <p
              id="delete-confirm-hint"
              className="text-[11.5px] text-(--color-text-400) mt-1"
            >
              Penghapusan tidak dapat dibatalkan setelah dikonfirmasi.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setConfirmText("");
            }}
            disabled={isDeleting}
            className="border-(--color-border) text-(--color-text-700)"
          >
            Batal
          </Button>

          <Button
            onClick={onConfirm}
            disabled={!isConfirmed || isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white border-0 min-w-[120px]"
            aria-busy={isDeleting}
          >
            {isDeleting ? "Menghapus..." : "Hapus Permanen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteOrgDialog;
