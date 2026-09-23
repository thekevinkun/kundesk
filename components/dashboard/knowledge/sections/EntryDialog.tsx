"use client";

// Create/edit dialog for one entry. Price editor only renders for catalog
// sections — FAQ/policy/promo/note entries never carry a price (matches
// saveEntryChanges's own FAQ price-stripping rule server-side).

import { useEffect, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PriceEditor } from "@/components/dashboard/knowledge/sections";
import { availabilityLabel } from "./constants";
import { createEntry, updateEntry } from "@/lib/actions/knowledge";
import { newEditorId } from "@/helpers/editor-id";
import type { KnowledgeEntryRow, SectionKind } from "@/types/knowledge";
import type { EditablePrice } from "@/types/knowledge-editor";

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: number;
  sectionKind: SectionKind;
  entry: KnowledgeEntryRow | null; // null = create, present = edit
  onSaved: () => void;
}

// Adds editorId to each variant option — see PriceEditor's own comment
function toEditablePrice(
  price: KnowledgeEntryRow["price"],
): EditablePrice | null {
  if (!price) return null;
  if (price.mode === "variants") {
    return {
      mode: "variants",
      options: price.options.map((o) => ({ ...o, editorId: newEditorId() })),
    };
  }
  return price;
}

// Strips editorId right before the value reaches the Server Action — same
// boundary rule as the profile form
function stripPrice(price: EditablePrice | null): KnowledgeEntryRow["price"] {
  if (!price) return null;
  if (price.mode === "variants") {
    return {
      mode: "variants",
      options: price.options.map(({ label, amount }) => ({ label, amount })),
    };
  }
  return price;
}

const EntryDialog = ({
  open,
  onOpenChange,
  sectionId,
  sectionKind,
  entry,
  onSaved,
}: EntryDialogProps) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState<EditablePrice | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Re-seed on every open — covers both "edit X" and "create new" (entry=null)
  useEffect(() => {
    if (!open) return;
    setTitle(entry?.title ?? "");
    setBody(entry?.body ?? "");
    setPrice(toEditablePrice(entry?.price ?? null));
    setIsAvailable(entry?.isAvailable ?? true);
  }, [open, entry]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Judul wajib diisi");
      return;
    }

    startTransition(async () => {
      const payload = {
        title: trimmedTitle,
        body: body.trim(),
        price: sectionKind === "catalog" ? stripPrice(price) : null,
        isAvailable,
      };

      const result = entry
        ? await updateEntry({ id: entry.id, ...payload })
        : await createEntry({ sectionId, ...payload });

      if (result.success) {
        toast.success(entry ? "Entri diperbarui" : "Entri ditambahkan");
        onOpenChange(false);
        onSaved();
        return;
      }
      toast.error("Gagal menyimpan", { description: result.error });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entri" : "Tambah entri"}</DialogTitle>
          <DialogDescription>
            {sectionKind === "faq"
              ? "Pertanyaan dan jawaban yang akan digunakan KUN."
              : "Detail item ini — KUN akan menjawab berdasarkan info di sini."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[12.5px] font-semibold text-(--color-text-700) mb-1.5 block">
              {sectionKind === "faq" ? "Pertanyaan" : "Judul"}
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              disabled={isPending}
              className="input-base"
              aria-label="Judul entri"
            />
          </div>

          <div>
            <Label className="text-[12.5px] font-semibold text-(--color-text-700) mb-1.5 block">
              {sectionKind === "faq" ? "Jawaban" : "Deskripsi"}
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={4}
              disabled={isPending}
              className="input-base no-zoom resize-none h-[100px] overflow-y-auto"
              aria-label="Isi entri"
            />
          </div>

          {sectionKind === "catalog" && (
            <PriceEditor
              price={price}
              onChange={setPrice}
              disabled={isPending}
            />
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={isAvailable}
              onCheckedChange={setIsAvailable}
              disabled={isPending}
              aria-label={availabilityLabel(sectionKind, isAvailable)}
            />
            <span className="text-[12.5px] text-(--color-text-700)">
              {availabilityLabel(sectionKind, isAvailable)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="btn-brand"
            aria-busy={isPending}
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EntryDialog;
