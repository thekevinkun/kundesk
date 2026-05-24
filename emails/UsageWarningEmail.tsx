// Usage warning — sent when org hits 80% of their monthly message quota

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

interface UsageWarningEmailProps {
  orgName: string;
  percentage: number; // e.g. 80
  used: number; // e.g. 800
  limit: number; // e.g. 1000
  billingUrl: string;
  logoUrl: string;
}

export default function UsageWarningEmail({
  orgName,
  percentage,
  used,
  limit,
  billingUrl,
  logoUrl,
}: UsageWarningEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Kuota pesan Kundesk kamu sudah ${percentage}% terpakai`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={logoUrl}
            alt="Kundesk"
            width={140}
            height="auto"
            style={{ marginBottom: "32px", display: "block" }}
          />

          <Heading style={styles.heading}>Peringatan Kuota Pesan</Heading>

          <Text style={styles.text}>Halo <strong>{orgName}</strong>,</Text>

          <Text style={styles.text}>
            Kuota pesan bulan ini sudah <strong>{percentage}%</strong> terpakai
            — {used} dari {limit} pesan. Jika kuota habis, chatbot kamu akan
            berhenti menjawab pelanggan hingga bulan depan.
          </Text>

          <Text style={styles.text}>
            Upgrade sekarang untuk mendapatkan lebih banyak kuota dan tidak
            kehilangan satu pun pertanyaan pelanggan.
          </Text>

          <Section style={styles.btnSection}>
            <Button style={styles.button} href={billingUrl}>
              Lihat Plan Upgrade →
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
  logoText: {
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#0f1117",
    margin: "0 0 32px 0",
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

UsageWarningEmail.PreviewProps = {
  orgName: "Kun Borneo",
  percentage: 80,
  used: 800,
  limit: 1000,
  billingUrl: "http://localhost:3000/dashboard/billing",
  logoUrl:
    "https://res.cloudinary.com/ddvmmonre/image/upload/v1779608718/logo_kundesk_meizty.png",
};
