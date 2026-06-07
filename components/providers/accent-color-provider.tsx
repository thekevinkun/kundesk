"use client";

import { useEffect } from "react";

interface AccentColorProviderProps {
  accentColor: string;
}

export function AccentColorProvider({ accentColor }: AccentColorProviderProps) {
  useEffect(() => {
    document.documentElement.style.setProperty("--color-brand", accentColor);

    return () => {
      // Remove inline style on unmount — CSS falls back to globals.css default (#069494)
      // Prevents dashboard accent color bleeding into landing page on back navigation
      document.documentElement.style.removeProperty("--color-brand");
    };
  }, [accentColor]);

  return null;
}
