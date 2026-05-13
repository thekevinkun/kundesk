// Shared formatting utilities — date, currency, labels
// Imported by billing components and any future dashboard components that need formatting

// Format Rupiah — "Rp 149.000" style, "Gratis" for zero
export function formatRupiah(amount: number): string {
  if (amount === 0) return "Gratis";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

// Format Date to Indonesian locale — "1 Juni 2026"
export function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Maps Midtrans payment_type to human-readable Indonesian label
export function formatPaymentMethod(method: string | null): string {
  if (!method) return "—";
  const map: Record<string, string> = {
    bank_transfer: "Transfer Bank",
    gopay: "GoPay",
    qris: "QRIS",
    ovo: "OVO",
    dana: "DANA",
    credit_card: "Kartu Kredit",
  };
  return map[method] ?? method;
}

// Relative time formatter — "2 mnt lalu", "1 jam lalu", "3 hari lalu"
// Used in ConversationRow and anywhere else timestamps need human-readable display
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return `${diffDays} hari lalu`;
}
