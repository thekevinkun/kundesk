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
    default: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
    template: "%s | Kundesk",
  },
  description:
    "Upload dokumen bisnis kamu, aktifkan chatbot AI, dan layani pelanggan 24/7 — tanpa coding. Dibangun untuk UMKM Indonesia.",
  keywords: [
    "AI chatbot Indonesia",
    "customer service otomatis",
    "chatbot UMKM",
    "chatbot WhatsApp",
    "AI customer service",
    "chatbot Bahasa Indonesia",
    "kundesk",
  ],
  authors: [{ name: "Kun Borneo", url: "https://kundesk.vercel.app" }],
  creator: "Kun Borneo",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://kundesk.vercel.app",
  ),

  // ── Favicon + PWA icons ──
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",

  // ── OpenGraph defaults — overridden per page ──
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Kundesk",
    title: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
    description:
      "Upload dokumen bisnis kamu, aktifkan chatbot AI, dan layani pelanggan 24/7 — tanpa coding. Dibangun untuk UMKM Indonesia.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
      },
    ],
  },

  // ── Twitter/X card ──
  twitter: {
    card: "summary_large_image",
    title: "Kundesk — AI Customer Service untuk Bisnis Indonesia",
    description:
      "Upload dokumen bisnis kamu, aktifkan chatbot AI, dan layani pelanggan 24/7 — tanpa coding.",
    images: ["/og-image.png"],
    creator: "@kunborneo",
  },

  // ── Robots ──
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
