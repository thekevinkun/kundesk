// Nav configuration — sections, items, badge styles
// Shared between NavItemRow and SidebarContent

// ── Nav item type ──
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: { text: string; variant: "brand" | "red" | "gray" };
  // true = hidden from org:member entirely, admin sees it as normal.
  // Documents is NOT flagged here — members can view it, only upload/delete
  // are gated at the action level (see lib/actions/documents.ts, api/documents/[id])
  adminOnly?: boolean;
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
        adminOnly: true,
      },
    ],
  },
  {
    label: "Chatbot",
    items: [
      {
        href: "/dashboard/chatbot",
        label: "Konfigurasi",
        icon: "⚙️",
        adminOnly: true,
      },
      { href: "/dashboard/knowledge", label: "Dokumen", icon: "📄" },
      { href: "/dashboard/widget", label: "Widget Embed", icon: "🔗" },
    ],
  },
  {
    label: "Akun",
    items: [
      {
        href: "/dashboard/billing",
        label: "Billing",
        icon: "💳",
        adminOnly: true,
      },
      {
        href: "/dashboard/settings",
        label: "Pengaturan",
        icon: "🛡️",
        adminOnly: true,
      },
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
