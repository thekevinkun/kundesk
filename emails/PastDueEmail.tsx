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

interface PastDueEmailProps {
  orgName: string;
  amount: string; // pre-formatted: "Rp 149.000"
  billingUrl: string;
  logoUrl: string;
}

export function PastDueEmail({
  orgName,
  amount,
  billingUrl,
  logoUrl,
}: PastDueEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Pembayaran Kundesk kamu tertunggak — segera selesaikan</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={logoUrl}
            alt="Kundesk"
            width={120}
            height="auto"
            style={{ marginBottom: "32px", display: "block" }}
          />

          <Heading style={styles.heading}>Pembayaran Tertunggak</Heading>

          <Text style={styles.text}>Halo {orgName},</Text>

          <Text style={styles.text}>
            Pembayaran Kundesk sebesar <strong>{amount}</strong> belum kami
            terima. Fitur chatbot kamu saat ini dibatasi hingga pembayaran
            diselesaikan.
          </Text>

          <Text style={styles.text}>
            Selesaikan pembayaran sekarang untuk memulihkan akses penuh dan
            memastikan pelanggan kamu tetap terlayani 24/7.
          </Text>

          <Section style={styles.btnSection}>
            <Button style={styles.buttonUrgent} href={billingUrl}>
              Selesaikan Pembayaran →
            </Button>
          </Section>

          <Text style={styles.text}>
            Jika kamu mengalami kendala pembayaran, balas email ini dan kami
            akan membantu.
          </Text>

          <Text style={styles.text}>
            Salam,
            <br />
            Tim Kundesk
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
  logoText: {
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#0f1117",
    margin: "0 0 32px 0",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#0f1117",
    letterSpacing: "-0.02em",
    margin: "0 0 16px 0",
    lineHeight: "1.3",
  },
  text: {
    fontSize: "15px",
    color: "#2d3748",
    lineHeight: "1.7",
    margin: "0 0 16px 0",
  },
  btnSection: { margin: "28px 0" },
  // Urgent CTA uses darker teal to signal importance without being alarming
  buttonUrgent: {
    backgroundColor: "#045f5f",
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
