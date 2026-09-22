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
