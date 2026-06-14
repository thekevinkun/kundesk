import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Img,
} from "@react-email/components";
import { EMAIL_PREVIEW_LOGO_URL } from "./constants";

interface PlanUpgradedEmailProps {
  orgName: string;
  planLabel: string; // "Starter" | "Pro"
  amount: string; // pre-formatted Rupiah
  paymentMethod: string; // human-readable, e.g. "Transfer Bank"
  orderId: string;
  paidAt: string; // pre-formatted date
  periodEnd: string; // pre-formatted date — "berlaku hingga"
  dashboardUrl: string;
  logoUrl: string;
}

export default function PlanUpgradedEmail({
  orgName,
  planLabel,
  amount,
  paymentMethod,
  orderId,
  paidAt,
  periodEnd,
  dashboardUrl,
  logoUrl,
}: PlanUpgradedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Pembayaran plan ${planLabel} kamu telah berhasil dan kini sudah aktif`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={logoUrl}
            alt="Kundesk"
            width={148}
            height="auto"
            style={{ marginBottom: "32px", display: "block" }}
          />

          <Heading style={styles.heading}>Pembayaran Berhasil 🎉</Heading>

          <Text style={styles.text}>
            Halo <strong>{orgName}</strong>,
          </Text>

          <Text style={styles.text}>
            Terima kasih! Pembayaran kamu telah kami terima dan plan{" "}
            <strong>{planLabel}</strong> sudah aktif sekarang. KUN siap melayani
            pelanggan dengan kuota dan fitur baru.
          </Text>

          {/* Receipt details */}
          <Section style={styles.receiptBox}>
            <table width="100%" cellPadding="0" cellSpacing="0">
              <tr>
                <td style={styles.receiptLabel}>Plan</td>
                <td style={styles.receiptValue}>{planLabel}</td>
              </tr>
              <tr>
                <td style={styles.receiptLabel}>Jumlah</td>
                <td style={styles.receiptValue}>{amount}</td>
              </tr>
              <tr>
                <td style={styles.receiptLabel}>Metode Pembayaran</td>
                <td style={styles.receiptValue}>{paymentMethod}</td>
              </tr>
              <tr>
                <td style={styles.receiptLabel}>Tanggal</td>
                <td style={styles.receiptValue}>{paidAt}</td>
              </tr>
              <tr>
                <td style={styles.receiptLabel}>Berlaku Hingga</td>
                <td style={styles.receiptValue}>{periodEnd}</td>
              </tr>
              <tr>
                <td style={styles.receiptLabel}>ID Transaksi</td>
                <td style={styles.receiptValueMono}>{orderId}</td>
              </tr>
            </table>
          </Section>

          <Section style={styles.btnSection}>
            <Button style={styles.button} href={dashboardUrl}>
              Buka Dashboard →
            </Button>
          </Section>

          <Text style={styles.text}>
            Salam,
            <br />
            <strong>Tim Kundesk</strong>
          </Text>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            © {new Date().getFullYear()} Kundesk · Bagian dari Kun Borneo ·
            Samarinda, Indonesia
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f8f9fa",
    fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "40px auto",
    padding: "40px",
    borderRadius: "12px",
    maxWidth: "520px",
    border: "1px solid #e8ecf0",
  },
  heading: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#0f1117",
    letterSpacing: "-0.02em",
    margin: "0 0 20px 0",
    lineHeight: "1.3",
  },
  text: {
    fontSize: "15px",
    color: "#2d3748",
    lineHeight: "1.7",
    margin: "0 0 12px 0",
  },
  receiptBox: {
    backgroundColor: "#f8f9fa",
    border: "1px solid #e8ecf0",
    borderRadius: "10px",
    padding: "16px 20px",
    margin: "20px 0",
  },
  receiptLabel: {
    fontSize: "13px",
    color: "#718096",
    padding: "6px 0",
    width: "50%",
  },
  receiptValue: {
    fontSize: "13px",
    color: "#0f1117",
    fontWeight: 600,
    padding: "6px 0",
    textAlign: "right" as const,
  },
  receiptValueMono: {
    fontSize: "12px",
    color: "#718096",
    fontFamily: "'DM Mono', monospace",
    padding: "6px 0",
    textAlign: "right" as const,
    wordBreak: "break-all" as const,
  },
  btnSection: { margin: "28px 0" },
  button: {
    backgroundColor: "#069494",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    padding: "13px 28px",
    borderRadius: "100px",
    textDecoration: "none",
    display: "inline-block",
  },
  hr: { borderColor: "#e8ecf0", margin: "32px 0 20px 0" },
  footer: { fontSize: "12px", color: "#a0aec0", margin: 0, lineHeight: "1.6" },
} as const;

PlanUpgradedEmail.PreviewProps = {
  orgName: "Kun Borneo",
  planLabel: "Starter",
  amount: "Rp 99.000",
  paymentMethod: "Transfer Bank",
  orderId: "KUNDESK-org_3ELK-STARTER-1781251199903",
  paidAt: "12 Juni 2026",
  periodEnd: "12 Juli 2026",
  dashboardUrl: "https://kundesk.vercel.app/dashboard",
  logoUrl: EMAIL_PREVIEW_LOGO_URL,
};
