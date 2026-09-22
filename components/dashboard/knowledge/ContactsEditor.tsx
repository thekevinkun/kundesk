"use client";

// Repeatable label/value rows — e.g. "WhatsApp Darurat" / "0821-4567-8902"

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ContactItem } from "@/types/knowledge";

interface ContactsEditorProps {
  contacts: ContactItem[];
  onChange: (next: ContactItem[]) => void;
  disabled: boolean;
}

const MAX_CONTACTS = 10; // matches contactSchema array max in helpers/knowledge-schemas.ts

const ContactsEditor = ({
  contacts,
  onChange,
  disabled,
}: ContactsEditorProps) => {
  const update = (index: number, patch: Partial<ContactItem>) => {
    onChange(contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const remove = (index: number) => {
    onChange(contacts.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...contacts, { label: "", value: "" }]);
  };

  return (
    <div className="space-y-3">
      {contacts.map((contact, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="w-[160px] flex-shrink-0">
            <Input
              value={contact.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder="Nama kontak"
              maxLength={40}
              disabled={disabled}
              className="input-base"
              aria-label={`Nama kontak ${index + 1}`}
            />
          </div>
          <div className="flex-1">
            <Input
              value={contact.value}
              onChange={(e) => update(index, { value: e.target.value })}
              placeholder="Contoh: 0821-4567-8902"
              maxLength={100}
              disabled={disabled}
              className="input-base"
              aria-label={`Isi kontak ${index + 1}`}
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Hapus kontak ${contact.label || index + 1}`}
              className="text-(--color-text-400) hover:text-(--color-danger) transition-colors px-2 py-2 leading-none"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {!disabled && contacts.length < MAX_CONTACTS && (
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="border-(--color-border) text-[12.5px]"
        >
          + Tambah kontak
        </Button>
      )}

      {contacts.length === 0 && disabled && (
        <p className="text-[12.5px] text-(--color-text-400)">
          Belum ada kontak.
        </p>
      )}
    </div>
  );
};

export default ContactsEditor;
