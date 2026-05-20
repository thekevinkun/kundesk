export interface PlanBadge {
  label: string;
  className: string;
}

export const PLAN_BADGE: Record<string, PlanBadge> = {
  free: {
    label: "Free",
    className:
      "bg-(--color-bg-page) text-(--color-text-500) border border-(--color-border)",
  },

  starter: {
    label: "Starter",
    className: "badge-brand",
  },

  pro: {
    label: "Pro",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

export const DELETE_ITEMS = [
  "Semua dokumen yang diupload",
  "Seluruh riwayat percakapan",
  "Konfigurasi chatbot",
  "Data billing dan langganan",
  "Akses ke dashboard ini",
];
