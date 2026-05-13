// Shared chatbot UI helpers — color presets, tone labels, language labels
// Imported by Topbar, ChatbotConfigPage, and any future component that needs these

// ── Accent color presets — shown in color picker in Topbar and ChatbotConfigPage ──
export interface ColorPreset {
  hex: string;
  label: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { hex: "#069494", label: "Teal" },
  { hex: "#3b82f6", label: "Biru" },
  { hex: "#8b5cf6", label: "Ungu" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#ef4444", label: "Merah" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#14b8a6", label: "Teal 2" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#84cc16", label: "Lime" },
  { hex: "#64748b", label: "Slate" },
];
