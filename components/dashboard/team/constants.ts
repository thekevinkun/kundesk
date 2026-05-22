// Static config for the Team page — all labels, colors, and copy live here
// Import from this file in all team components — never hardcode inline

// ── Role config — drives badges and role selector ──
export interface RoleConfig {
  label: string;
  // Short description shown in role change dialog
  description: string;
  // Badge classes matching globals.css badge pattern
  badgeClass: string;
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  "org:admin": {
    label: "Admin",
    description:
      "Dapat mengundang anggota, mengubah role, dan mengelola semua pengaturan.",
    badgeClass: "badge-base badge-brand",
  },
  "org:member": {
    label: "Anggota",
    description: "Dapat melihat dashboard dan mengelola percakapan.",
    badgeClass: "badge-base badge-neutral",
  },
};

// ── Role options for invite and role change selectors ──
export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "org:member", label: "Anggota" },
  { value: "org:admin", label: "Admin" },
];

// ── Avatar color palette — assigned by index for members without photo ──
// Cycles through when member count exceeds palette length
export const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "var(--color-brand-light)", text: "var(--color-brand-dark)" },
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#fee2e2", text: "#991b1b" },
  { bg: "#f3e8ff", text: "#6b21a8" },
  { bg: "#d1fae5", text: "#065f46" },
];

// ── Empty state copy ──
export const EMPTY_STATE = {
  title: "Belum ada anggota tim",
  description:
    "Undang anggota tim untuk mengelola percakapan dan chatbot bersama.",
} as const;

// ── Page header copy ──
export const PAGE_HEADER = {
  title: "Tim",
  description: "Kelola anggota tim dan atur akses mereka ke dashboard.",
} as const;

// ── Invite card copy ──
export const INVITE_COPY = {
  title: "Undang Anggota",
  description:
    "Kirim undangan melalui email. Anggota baru akan mendapat link untuk bergabung.",
  emailPlaceholder: "nama@email.com",
  submitLabel: "Kirim Undangan",
  pendingLabel: "Mengirim...",
} as const;

// ── Remove dialog copy ──
export const REMOVE_COPY = {
  title: "Hapus Anggota",
  confirmLabel: "Ya, Hapus",
  cancelLabel: "Batal",
} as const;

// ── Role change dialog copy ──
export const ROLE_CHANGE_COPY = {
  title: "Ubah Role",
  confirmLabel: "Simpan Perubahan",
  cancelLabel: "Batal",
} as const;

// ── Helper — get initials from name for avatar fallback ──
export function getInitials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  if (firstName && lastName) {
    // First letter of each name — "Kevin Mahendra" → "KM"
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }

  // Fall back to first two chars of email prefix
  return (email.split("@")[0] ?? email.slice(0, 2)).toUpperCase();
}

// ── Helper — get avatar color by member index ──
export function getAvatarColor(index: number): { bg: string; text: string } {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]!;
}
