"use client";

// Discriminated-union price editor for catalog entries — none / fixed /
// range / variants / contact. Variant rows use the same client-only
// editorId pattern as the profile form's repeatable rows (same shape of
// problem: a removable list keyed on array index — see
// types/knowledge-editor.ts).

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { newEditorId } from "@/helpers/editor-id";
import type { EditablePrice } from "@/types/knowledge-editor";

interface PriceEditorProps {
  price: EditablePrice | null;
  onChange: (next: EditablePrice | null) => void;
  disabled: boolean;
}

type PriceMode = "none" | EditablePrice["mode"];

const MAX_VARIANTS = 20; // matches entryPriceSchema's variants.options max

const PriceEditor = ({ price, onChange, disabled }: PriceEditorProps) => {
  const mode: PriceMode = price?.mode ?? "none";

  const handleModeChange = (next: PriceMode) => {
    if (next === "none") return onChange(null);
    if (next === "fixed") return onChange({ mode: "fixed", amount: 0 });
    if (next === "range") return onChange({ mode: "range", min: 0, max: 0 });
    if (next === "variants") return onChange({ mode: "variants", options: [] });
    onChange({ mode: "contact" });
  };

  return (
    <div className="space-y-3">
      <div className="max-w-[280px]">
        <Label className="text-[12.5px] font-semibold text-(--color-text-700) mb-1.5 block">
          Harga
        </Label>
        <Select
          value={mode}
          onValueChange={handleModeChange}
          disabled={disabled}
        >
          <SelectTrigger className="input-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Tanpa harga</SelectItem>
            <SelectItem value="fixed">Harga tetap</SelectItem>
            <SelectItem value="range">Rentang harga</SelectItem>
            <SelectItem value="variants">Beberapa pilihan (varian)</SelectItem>
            <SelectItem value="contact">Hubungi kami</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {price?.mode === "fixed" && (
        <div className="max-w-[200px]">
          <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
            Jumlah (Rp)
          </Label>
          <Input
            type="number"
            min={0}
            step={500}
            value={price.amount}
            onChange={(e) =>
              onChange({ mode: "fixed", amount: Number(e.target.value) || 0 })
            }
            disabled={disabled}
            className="input-base"
            aria-label="Harga tetap"
          />
        </div>
      )}

      {price?.mode === "range" && (
        <div className="flex gap-3">
          <div className="max-w-[160px]">
            <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
              Minimum (Rp)
            </Label>
            <Input
              type="number"
              min={0}
              step={500}
              value={price.min}
              onChange={(e) =>
                onChange({ ...price, min: Number(e.target.value) || 0 })
              }
              disabled={disabled}
              className="input-base"
              aria-label="Harga minimum"
            />
          </div>
          <div className="max-w-[160px]">
            <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
              Maksimum (Rp)
            </Label>
            <Input
              type="number"
              min={0}
              step={500}
              value={price.max}
              onChange={(e) =>
                onChange({ ...price, max: Number(e.target.value) || 0 })
              }
              disabled={disabled}
              className="input-base"
              aria-label="Harga maksimum"
            />
          </div>
        </div>
      )}

      {price?.mode === "variants" && (
        <div className="space-y-2">
          {price.options.map((option, index) => (
            <div key={option.editorId} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  value={option.label}
                  onChange={(e) =>
                    onChange({
                      ...price,
                      options: price.options.map((o, i) =>
                        i === index ? { ...o, label: e.target.value } : o,
                      ),
                    })
                  }
                  placeholder="Contoh: Di bawah 3 kg"
                  maxLength={60}
                  disabled={disabled}
                  className="input-base"
                  aria-label={`Nama pilihan ${index + 1}`}
                />
              </div>
              <div className="w-[140px]">
                <Input
                  type="number"
                  min={0}
                  step={500}
                  value={option.amount}
                  onChange={(e) =>
                    onChange({
                      ...price,
                      options: price.options.map((o, i) =>
                        i === index
                          ? { ...o, amount: Number(e.target.value) || 0 }
                          : o,
                      ),
                    })
                  }
                  disabled={disabled}
                  className="input-base"
                  aria-label={`Harga pilihan ${index + 1}`}
                />
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...price,
                      options: price.options.filter((_, i) => i !== index),
                    })
                  }
                  aria-label={`Hapus pilihan ${option.label || index + 1}`}
                  className="text-(--color-text-400) hover:text-(--color-danger) transition-colors px-2 py-2 leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {!disabled && price.options.length < MAX_VARIANTS && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onChange({
                  ...price,
                  options: [
                    ...price.options,
                    { editorId: newEditorId(), label: "", amount: 0 },
                  ],
                })
              }
              className="border-(--color-border) text-[12px]"
            >
              + Tambah pilihan
            </Button>
          )}

          {price.options.length === 0 && (
            <p className="text-[12px] text-(--color-text-400)">
              Tanpa pilihan, KUN akan bilang &quot;hubungi kami&quot; untuk
              harga ini.
            </p>
          )}
        </div>
      )}

      {price?.mode === "contact" && (
        <p className="text-[12.5px] text-(--color-text-400)">
          KUN akan mengarahkan pelanggan untuk menghubungi bisnis langsung,
          tanpa menyebutkan angka harga.
        </p>
      )}
    </div>
  );
};

export default PriceEditor;
