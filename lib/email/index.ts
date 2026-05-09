// Resend email client — transactional emails
// Mock mode logs email content to console — nothing actually sent
// Real mode sends via Resend API

import { env } from "@/lib/env"

// Email payload — same shape for mock and real
interface EmailPayload {
  to:      string
  subject: string
  html:    string
  from?:   string
}

// Default sender — override per email if needed
const DEFAULT_FROM = "Kundesk <noreply@kundesk.app>"

// Sends an email — mock logs to console, real sends via Resend
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const from = payload.from ?? DEFAULT_FROM

  // Mock mode — log full email to console so content is visible during dev
  if (env.emailMode === "mock") {
    console.log("\n📧 [MOCK EMAIL]")
    console.log(`From:    ${from}`)
    console.log(`To:      ${payload.to}`)
    console.log(`Subject: ${payload.subject}`)
    console.log(`Body:\n${payload.html}`)
    console.log("─".repeat(60) + "\n")
    return
  }

  // Real mode — send via Resend
  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is required when KUNDESK_EMAIL_MODE=resend")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to:      [payload.to],
      subject: payload.subject,
      html:    payload.html,
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend error: ${response.statusText}`)
  }
}

// Sends welcome email after org creation
export async function sendWelcomeEmail(
  to: string,
  orgName: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Selamat datang di Kundesk, ${orgName}! 🎉`,
    html: `
      <h1>Selamat datang di Kundesk!</h1>
      <p>Halo ${orgName},</p>
      <p>Akun Kundesk kamu sudah aktif. Mulai upload dokumen bisnis kamu dan chatbot AI kamu akan siap dalam hitungan menit.</p>
      <p><a href="${env.appUrl}/dashboard">Buka Dashboard →</a></p>
      <p>Salam,<br>Tim Kundesk</p>
    `,
  })
}

// Sends billing reminder when next payment is approaching
export async function sendBillingReminderEmail(
  to: string,
  orgName: string,
  dueDate: Date,
  amount: number
): Promise<void> {
  const formattedDate = dueDate.toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  })
  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR"
  }).format(amount)

  await sendEmail({
    to,
    subject: `Tagihan Kundesk kamu jatuh tempo ${formattedDate}`,
    html: `
      <h1>Pengingat Tagihan</h1>
      <p>Halo ${orgName},</p>
      <p>Tagihan Kundesk kamu sebesar <strong>${formattedAmount}</strong> jatuh tempo pada <strong>${formattedDate}</strong>.</p>
      <p><a href="${env.appUrl}/dashboard/billing">Bayar Sekarang →</a></p>
      <p>Salam,<br>Tim Kundesk</p>
    `,
  })
}

// Sends usage warning when org approaches their message limit
export async function sendUsageWarningEmail(
  to: string,
  orgName: string,
  used: number,
  limit: number
): Promise<void> {
  const percentage = Math.round((used / limit) * 100)

  await sendEmail({
    to,
    subject: `Peringatan: Kuota pesan Kundesk kamu sudah ${percentage}% terpakai`,
    html: `
      <h1>Peringatan Kuota</h1>
      <p>Halo ${orgName},</p>
      <p>Kuota pesan bulan ini sudah <strong>${percentage}%</strong> terpakai (${used} dari ${limit} pesan).</p>
      <p>Upgrade plan kamu untuk mendapatkan lebih banyak kuota.</p>
      <p><a href="${env.appUrl}/dashboard/billing">Lihat Plan →</a></p>
      <p>Salam,<br>Tim Kundesk</p>
    `,
  })
}
