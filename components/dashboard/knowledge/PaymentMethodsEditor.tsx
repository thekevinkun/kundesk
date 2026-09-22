"use client";

// Repeatable label/detail rows — e.g. "QRIS" / "scan di kasir"

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
    <div className="space-y-3">
      {methods.map((method, index) => (
        <div key={method.editorId} className="flex items-start gap-2">
          <div className="w-[160px] flex-shrink-0">
            <Input
              value={method.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder="Contoh: QRIS"
              maxLength={40}
              disabled={disabled}
              className="input-base"
              aria-label={`Metode pembayaran ${index + 1}`}
            />
          </div>
          <div className="flex-1">
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
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Hapus metode ${method.label || index + 1}`}
              className="text-(--color-text-400) hover:text-(--color-danger) transition-colors px-2 py-2 leading-none"
            >
              ×
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
