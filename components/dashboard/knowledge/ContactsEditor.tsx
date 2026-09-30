"use client";

// Repeatable label/value rows — e.g. "WhatsApp Darurat" / "0821-4567-8902"

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { newEditorId } from "@/helpers/editor-id";
import type { EditableContact } from "@/types/knowledge-editor";

interface ContactsEditorProps {
  contacts: EditableContact[];
  onChange: (next: EditableContact[]) => void;
  disabled: boolean;
}

const MAX_CONTACTS = 10; // matches contactSchema array max in helpers/knowledge-schemas.ts

const ContactsEditor = ({
  contacts,
  onChange,
  disabled,
}: ContactsEditorProps) => {
  const update = (index: number, patch: Partial<EditableContact>) => {
    onChange(contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const remove = (index: number) => {
    onChange(contacts.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...contacts, { editorId: newEditorId(), label: "", value: "" }]);
  };

  return (
    <div className="space-y-2.5">
      {contacts.map((contact, index) => (
        <div
          key={contact.editorId}
          // Row is now a real hoverable unit, not bare stacked inputs —
          // grid gives the label column a consistent, wider berth
          // ("Telepon Darurat (24 Jam)"-length labels need room) instead
          // of a hardcoded 160px flex-shrink guess
          className="group grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-3 items-center rounded-(--radius-sm) border border-(--color-border) bg-(--color-bg-page) p-3 transition-colors hover:border-(--color-brand-mid) hover:bg-(--color-bg-card)"
        >
          <Input
            value={contact.label}
            onChange={(e) => update(index, { label: e.target.value })}
            placeholder="Nama kontak"
            maxLength={40}
            disabled={disabled}
            className="input-base"
            aria-label={`Nama kontak ${index + 1}`}
          />
          <Input
            value={contact.value}
            onChange={(e) => update(index, { value: e.target.value })}
            placeholder="Contoh: 0821-4567-8902"
            maxLength={100}
            disabled={disabled}
            className="input-base"
            aria-label={`Isi kontak ${index + 1}`}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Hapus kontak ${contact.label || index + 1}`}
              className="justify-self-end rounded-full p-1.5 text-(--color-text-400) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {!disabled && contacts.length < MAX_CONTACTS && (
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="btn-outline hover:!bg-brand/75 text-[12.5px]"
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
