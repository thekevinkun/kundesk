"use client";

// Repeatable label/detail rows — e.g. "QRIS" / "scan di kasir"

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { newEditorId } from "@/helpers/editor-id";
import type { EditablePaymentMethod } from "@/types/knowledge-editor";

interface PaymentMethodsEditorProps {
  methods: EditablePaymentMethod[];
  onChange: (next: EditablePaymentMethod[]) => void;
  disabled: boolean;
}

const MAX_METHODS = 12; // matches paymentMethodSchema array max

const PaymentMethodsEditor = ({
  methods,
  onChange,
  disabled,
}: PaymentMethodsEditorProps) => {
  const update = (index: number, patch: Partial<EditablePaymentMethod>) => {
    onChange(methods.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const remove = (index: number) => {
    onChange(methods.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([
      ...methods,
      { editorId: newEditorId(), label: "", detail: undefined },
    ]);
  };

  return (
    <div className="space-y-2.5">
      {methods.map((method, index) => (
        <div
          key={method.editorId}
          className="group grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-3 items-center rounded-(--radius-sm) border border-(--color-border) bg-(--color-bg-page) p-3 transition-colors hover:border-(--color-brand-mid) hover:bg-(--color-bg-card)"
        >
          <Input
            value={method.label}
            onChange={(e) => update(index, { label: e.target.value })}
            placeholder="Contoh: QRIS"
            maxLength={40}
            disabled={disabled}
            className="input-base"
            aria-label={`Metode pembayaran ${index + 1}`}
          />
          <Input
            value={method.detail ?? ""}
            onChange={(e) =>
              update(index, { detail: e.target.value || undefined })
            }
            placeholder="Detail (opsional) — contoh: scan di kasir"
            maxLength={120}
            disabled={disabled}
            className="input-base"
            aria-label={`Detail metode ${index + 1}`}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Hapus metode ${method.label || index + 1}`}
              className="justify-self-end rounded-full p-1.5 text-(--color-text-400) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {!disabled && methods.length < MAX_METHODS && (
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="border-(--color-border) text-[12.5px]"
        >
          + Tambah metode pembayaran
        </Button>
      )}

      {methods.length === 0 && disabled && (
        <p className="text-[12.5px] text-(--color-text-400)">
          Belum ada metode pembayaran.
        </p>
      )}
    </div>
  );
};

export default PaymentMethodsEditor;
