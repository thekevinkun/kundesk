// UI-only editor types for the business profile form. Domain types in
// types/knowledge.ts describe what gets persisted; these add an editorId
// solely so React has a stable key across add/remove (CodeRabbit finding —
// array-index keys reused a removed row's DOM node, leaving stale focus and
// handlers pointed at the wrong entry after a mid-list delete). editorId is
// generated client-side, never sent to saveBusinessProfile, and never
// appears in ContactItem/PaymentMethod/HoursSchedule/HoursLine.

import type {
  ContactItem,
  HoursLine,
  HoursSchedule,
  PaymentMethod,
} from "@/types/knowledge";

export interface EditableContact extends ContactItem {
  editorId: string;
}

export interface EditablePaymentMethod extends PaymentMethod {
  editorId: string;
}

export interface EditableHoursLine extends HoursLine {
  editorId: string;
}

export interface EditableHoursSchedule extends Omit<HoursSchedule, "lines"> {
  editorId: string;
  lines: EditableHoursLine[];
}

// One priced variant row in the editor — same editorId pattern as the
// profile form's repeatable rows (CodeRabbit finding on that PR)
export interface EditableVariantOption {
  editorId: string;
  label: string;
  amount: number;
}

// Editor-only mirror of EntryPrice — "variants" carries EditableVariantOption
// instead of the plain {label, amount} the server expects
export type EditablePrice =
  | { mode: "fixed"; amount: number }
  | { mode: "range"; min: number; max: number }
  | { mode: "variants"; options: EditableVariantOption[] }
  | { mode: "contact" };
