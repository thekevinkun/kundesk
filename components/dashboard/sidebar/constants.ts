// Nav configuration — sections, items, badge styles
// Shared between NavItemRow and SidebarContent

// ── Nav item type ──
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: { text: string; variant: "brand" | "red" | "gray" };
}

// ── Nav sections — drives the entire sidebar nav ──
export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "🏠" },
      { href: "/dashboard/conversations", label: "Percakapan", icon: "💬" },
      {
        href: "/dashboard/analytics",
        label: "Analytics",
        icon: "📊",
        badge: { text: "Live", variant: "brand" },
      },
    ],
  },
  {
    label: "Chatbot",
    items: [
      { href: "/dashboard/chatbot", label: "Konfigurasi", icon: "⚙️" },
      { href: "/dashboard/documents", label: "Dokumen", icon: "📄" },
      { href: "/dashboard/widget", label: "Widget Embed", icon: "🔗" },
    ],
  },
  {
    label: "Akun",
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: "💳" },
      { href: "/dashboard/settings", label: "Pengaturan", icon: "🛡️" },
      { href: "/dashboard/team", label: "Tim", icon: "👥" },
    ],
  },
];

// ── Badge variant classes — maps variant name to Tailwind classes ──
export const BADGE_CLASS: Record<string, string> = {
  brand: "bg-(--color-brand-light) text-(--color-brand)",
  red: "bg-red-100 text-red-500",
  gray: "bg-(--color-bg-page) text-(--color-text-400) border border-(--color-border)",
};
