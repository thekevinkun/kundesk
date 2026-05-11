import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { orgs, chatbots } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await params;

  // Validate slug format — alphanumeric, hyphens, underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(orgSlug)) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch org — same 404 for missing or inactive (no enumeration)
  const [org] = await db
    .select({ id: orgs.id, slug: orgs.slug })
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  if (!org) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch active chatbot to get the accent color for the QR code foreground
  const [chatbot] = await db
    .select({ accentColor: chatbots.accentColor })
    .from(chatbots)
    .where(and(eq(chatbots.orgId, org.id), eq(chatbots.isActive, true)))
    .limit(1);

  // No chatbot or inactive — same 404, no enumeration
  if (!chatbot) {
    return new Response("Not found", { status: 404 });
  }

  // The URL the QR code encodes — what the customer's camera opens
  const chatUrl = `${env.appUrl}/chat/${org.slug}`;

  // Check if caller wants PNG or SVG — default to PNG for broader compatibility
  const format =
    request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";

  if (format === "svg") {
    // SVG — smaller file, scales infinitely, good for dashboard preview
    const svg = await QRCode.toString(chatUrl, {
      type: "svg",
      color: {
        // Use the org's accent color as the QR foreground
        dark: chatbot.accentColor,
        light: "#ffffff",
      },
      // Quiet zone — white border around QR, required for scanners to work
      margin: 2,
      width: 256,
      errorCorrectionLevel: "M",
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        // Cache for 1 hour — accent color or slug changes invalidate on next request
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  // PNG — better for printing, download button in dashboard
  // toBuffer() doesn't exist in qrcode v1.5.4 — use toDataURL() and decode from base64
  const dataUrl = await QRCode.toDataURL(chatUrl, {
    type: "image/png",
    color: {
      dark: chatbot.accentColor,
      light: "#ffffff",
    },
    margin: 2,
    // 512px — high enough for print quality
    width: 512,
    errorCorrectionLevel: "M",
  });

  // Strip the data URL prefix to get raw base64, then decode to bytes
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const pngBytes = new Uint8Array(Buffer.from(base64, "base64"));

  return new Response(pngBytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Disposition": `inline; filename="qr-${org.slug}.png"`,
    },
  });
}
