// Sidebar open/close state — shared between topbar (trigger) and sidebar (drawer)
// Zustand avoids prop drilling between two sibling components in the layout

import { create } from "zustand";

interface SidebarStore {
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  mobileOpen: false,
  openMobile: () => set({ mobileOpen: true }),
  closeMobile: () => set({ mobileOpen: false }),
  toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
}));
