// Root layout — wraps every page in the app
// Loads fonts via next/font (never <link> tags — causes FOUT)
// ThemeProvider from next-themes lives here so dark mode works from day one
// TooltipProvider from shadcn — required for all Tooltip components to work

import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Primary font — used for everything except mono and serif accent
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

// Monospace font — used for code, session IDs, URL chips
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

// Serif italic accent — landing page hero headlines only
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kundesk - AI Customer Service untuk Bisnis Indonesia",
    template: "%s | Kundesk",
  },
  description:
    "Upload dokumen bisnis kamu, aktifkan chatbot AI, dan layani pelanggan 24/7 — tanpa coding. Dibangun untuk UMKM Indonesia.",
  keywords: [
    "AI chatbot",
    "customer service",
    "UMKM Indonesia",
    "chatbot Indonesia",
  ],
  authors: [{ name: "Kun Borneo" }],
  creator: "Kun Borneo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    // suppressHydrationWarning prevents next-themes SSR mismatch warning
    // lang="id" — this is an Indonesian product
    <html
      lang="id"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`
        ${plusJakartaSans.variable}
        ${dmMono.variable}
        ${instrumentSerif.variable}
      `}
    >
      <body className={plusJakartaSans.className}>
        <ClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {/* TooltipProvider must wrap the entire app — required by shadcn Tooltip */}
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
