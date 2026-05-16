// Resend email client — transactional emails via React Email templates
// Mock mode logs to console. Real mode sends via Resend API using onboarding@resend.dev

import { render } from "@react-email/render";
import { env } from "@/lib/env";
import { WelcomeEmail } from "@/emails/WelcomeEmail";
import { BillingReminderEmail } from "@/emails/BillingReminderEmail";
import { UsageWarningEmail } from "@/emails/UsageWarningEmail";
import { PastDueEmail } from "@/emails/PastDueEmail";
import { HandoffEmail } from "@/emails/HandoffEmail";

// onboarding@resend.dev — Resend's free sender, no custom domain needed
// Switch to "Kundesk <noreply@kundesk.app>" once domain is verified
const DEFAULT_FROM = "Kundesk <onboarding@resend.dev>";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

// Core send function — mock logs, real calls Resend API
async function sendEmail(payload: EmailPayload): Promise<void> {
  const from = payload.from ?? DEFAULT_FROM;

  // Resend free plan restriction — can only send to verified email until domain is added
  // Change RESEND_TO_EMAIL in .env once custom domain is verified
  const to = process.env.RESEND_TO_EMAIL ?? payload.to;

  if (env.emailMode === "mock") {
    console.log("\n📧 [MOCK EMAIL]");
    console.log(`From:    ${from}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log("─".repeat(60) + "\n");
    return;
  }

  if (!env.resendApiKey) {
    throw new Error(
      "RESEND_API_KEY is required when KUNDESK_EMAIL_MODE=resend",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${response.statusText} — ${error}`);
  }
}

// ── Typed email senders — one per template ──

export async function sendWelcomeEmail(
  to: string,
  orgName: string,
  logoUrl: string,
): Promise<void> {
  const html = await render(
    WelcomeEmail({
      orgName,
      logoUrl,
      dashboardUrl: `${env.appUrl}/dashboard`,
    }),
  );

  await sendEmail({
    to,
    subject: `Selamat datang di Kundesk, ${orgName}! 🎉`,
    html,
  });
}

export async function sendBillingReminderEmail(
  to: string,
  orgName: string,
  dueDate: Date,
  amount: number,
  redirectUrl: string,
  logoUrl: string,
): Promise<void> {
  // Format values here — keeps templates free of formatting logic
  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

  const formattedDate = dueDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = await render(
    BillingReminderEmail({
      orgName,
      logoUrl,
      redirectUrl,
      amount: formattedAmount,
      dueDate: formattedDate,
    }),
  );

  await sendEmail({
    to,
    subject: `Tagihan Kundesk kamu jatuh tempo ${formattedDate}`,
    html,
  });
}

export async function sendUsageWarningEmail(
  to: string,
  orgName: string,
  used: number,
  limit: number,
  logoUrl: string,
): Promise<void> {
  const percentage = Math.round((used / limit) * 100);

  const html = await render(
    UsageWarningEmail({
      orgName,
      logoUrl,
      percentage,
      used,
      limit,
      billingUrl: `${env.appUrl}/dashboard/billing`,
    }),
  );

  await sendEmail({
    to,
    subject: `Peringatan: Kuota pesan Kundesk kamu sudah ${percentage}% terpakai`,
    html,
  });
}

export async function sendPastDueEmail(
  to: string,
  orgName: string,
  amount: number,
  logoUrl: string,
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

  const html = await render(
    PastDueEmail({
      orgName,
      logoUrl,
      amount: formattedAmount,
      billingUrl: `${env.appUrl}/dashboard/billing`,
    }),
  );

  await sendEmail({
    to,
    subject: `Pembayaran Kundesk kamu tertunggak — segera selesaikan`,
    html,
  });
}

export async function sendHandoffEmail(
  to: string,
  orgName: string,
  sessionId: string,
  lastMessage: string,
  conversationId: number,
  logoUrl: string,
): Promise<void> {
  const html = await render(
    HandoffEmail({
      orgName,
      logoUrl,
      sessionId,
      lastMessage,
      // Links directly to conversations page — staff clicks and sees the takeover button
      conversationUrl: `${env.appUrl}/dashboard/conversations`,
    }),
  );

  await sendEmail({
    to,
    subject: `🙋 Pelanggan ${orgName} meminta bantuan langsung`,
    html,
  });
}
