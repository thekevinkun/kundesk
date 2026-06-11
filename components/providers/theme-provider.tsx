// Thin wrapper around next-themes ThemeProvider
// Needed because next-themes requires "use client" but our root layout is a Server Component
// We wrap it here so the layout stays a Server Component

"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
