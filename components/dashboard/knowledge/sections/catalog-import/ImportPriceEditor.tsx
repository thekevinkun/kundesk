"use client";

// Price editor for the import review screen: fixed / range / contact only ("variants" stay manual in v1).
// Same Select pattern as PriceEditor, but amounts are typed as digits: "25.000" and "Rp 25.000" both
// become 25000. A number input would read the Indonesian thousands dot as a decimal point ("25.000" → 25).

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRupiah } from "@/helpers/format";
import type { ImportPrice } from "@/types/knowledge";

interface ImportPriceEditorProps {
  price: ImportPrice | null;
  onChange: (next: ImportPrice | null) => void;
  disabled: boolean;
  itemName: string; // used in aria-labels so a screen reader can tell the rows apart
}

// 10 digits is just above the schema's Rp 1 miliar cap; the schema message handles anything over it
const MAX_DIGITS = 10;

// Keeps digits only: "Rp 25.000" → 25000, "" → 0
function parseDigits(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, MAX_DIGITS);
  return digits ? Number(digits) : 0;
}

interface AmountFieldProps {
  label: string;
  ariaLabel: string;
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
}

const AmountField = ({
  label,
  ariaLabel,
  value,
  onChange,
  disabled,
}: AmountFieldProps) => (
  <div className="min-w-0 flex-1">
    <Label className="text-[11.5px] text-(--color-text-400) mb-1 block">
      {label}
    </Label>
    <Input
      inputMode="numeric"
      value={String(value)}
      onChange={(e) => onChange(parseDigits(e.target.value))}
      // Select everything on focus so typing replaces the placeholder "0"
      onFocus={(e) => e.target.select()}
      disabled={disabled}
      className="input-base"
      aria-label={ariaLabel}
    />
    {/* Live preview — shows exactly what was read from the typed digits */}
    <p className="mt-1 text-[11px] text-(--color-text-400)">
      {formatRupiah(value)}
    </p>
  </div>
);

const ImportPriceEditor = ({
  price,
  onChange,
  disabled,
  itemName,
}: ImportPriceEditorProps) => {
  // Carries a sensible starting value across modes instead of resetting to 0
  const handleModeChange = (next: string) => {
    if (next === "fixed") {
      onChange({
        mode: "fixed",
        amount: price?.mode === "range" ? price.min : 0,
      });
    } else if (next === "range") {
      const base = price?.mode === "fixed" ? price.amount : 0;
      onChange({ mode: "range", min: base, max: base });
    } else if (next === "contact") {
      onChange({ mode: "contact" });
    }
  };

  return (
    <div className="space-y-2">
      <div className="max-w-[240px]">
        <Select
          value={price?.mode ?? ""}
          onValueChange={handleModeChange}
          disabled={disabled}
        >
          <SelectTrigger
            className="input-base"
            aria-label={`Jenis harga ${itemName}`}
          >
            <SelectValue placeholder="Pilih jenis harga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Harga tetap</SelectItem>
            <SelectItem value="range">Rentang harga</SelectItem>
            <SelectItem value="contact">Hubungi kami</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {price?.mode === "fixed" && (
        <div className="max-w-[200px]">
          <AmountField
            label="Jumlah (Rp)"
            ariaLabel={`Harga ${itemName}`}
            value={price.amount}
            onChange={(amount) => onChange({ mode: "fixed", amount })}
            disabled={disabled}
          />
        </div>
      )}

      {price?.mode === "range" && (
        <div className="flex gap-3 max-w-[360px]">
          <AmountField
            label="Minimum (Rp)"
            ariaLabel={`Harga minimum ${itemName}`}
            value={price.min}
            onChange={(min) => onChange({ ...price, min })}
            disabled={disabled}
          />
          <AmountField
            label="Maksimum (Rp)"
            ariaLabel={`Harga maksimum ${itemName}`}
            value={price.max}
            onChange={(max) => onChange({ ...price, max })}
            disabled={disabled}
          />
        </div>
      )}

      {price?.mode === "contact" && (
        <p className="text-[12px] text-(--color-text-400)">
          KUN akan mengarahkan pelanggan untuk menghubungi bisnis, tanpa
          menyebut angka harga.
        </p>
      )}
    </div>
  );
};

export default ImportPriceEditor;
