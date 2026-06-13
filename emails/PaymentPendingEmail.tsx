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

interface PaymentPendingEmailProps {
  orgName: string;
  planLabel: string; // "Starter" | "Pro"
  amount: string; // pre-formatted Rupiah
  redirectUrl: string;
  logoUrl: string;
}

export default function PaymentPendingEmail({
  orgName,
  planLabel,
  amount,
  redirectUrl,
  logoUrl,
}: PaymentPendingEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Selesaikan pembayaran plan ${planLabel} kamu`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={logoUrl}
            alt="Kundesk"
            width={148}
            height="auto"
            style={{ marginBottom: "32px", display: "block" }}
          />

          <Heading style={styles.heading}>Selesaikan Pembayaran Kamu</Heading>

          <Text style={styles.text}>
            Halo <strong>{orgName}</strong>,
          </Text>

          <Text style={styles.text}>
            Kamu memilih upgrade ke plan <strong>{planLabel}</strong> seharga{" "}
            <strong>{amount}</strong>. Selesaikan pembayaran dalam 24 jam untuk
            mengaktifkan plan ini — link di bawah tetap berlaku selama itu, jadi
            kamu bisa kembali kapan saja.
          </Text>

          <Section style={styles.btnSection}>
            <Button style={styles.button} href={redirectUrl}>
              Lanjutkan Pembayaran →
            </Button>
          </Section>

          <Text style={styles.smallText}>
            Atau salin link ini:{" "}
            <a href={redirectUrl} style={styles.link}>
              {redirectUrl}
            </a>
          </Text>

          <Text style={styles.text}>
            Jika kamu tidak menyelesaikan pembayaran, plan kamu tidak akan
            berubah dan tidak ada biaya yang dikenakan.
          </Text>

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
  smallText: {
    fontSize: "12px",
    color: "#a0aec0",
    lineHeight: "1.6",
    margin: "0 0 16px 0",
    wordBreak: "break-all" as const,
  },
  link: { color: "#069494" },
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

PaymentPendingEmail.PreviewProps = {
  orgName: "Kun Borneo",
  planLabel: "Starter",
  amount: "Rp 99.000",
  redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/example",
  logoUrl: EMAIL_PREVIEW_LOGO_URL,
};
