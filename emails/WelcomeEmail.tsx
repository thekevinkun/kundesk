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

interface WelcomeEmailProps {
  orgName: string;
  dashboardUrl: string;
  logoUrl: string;
}

export default function WelcomeEmail({
  orgName,
  dashboardUrl,
  logoUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Selamat datang di Kundesk, {orgName}!</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={logoUrl}
            alt="Kundesk"
            width={140}
            height="auto"
            style={{ marginBottom: "32px", display: "block" }}
          />

          <Heading style={styles.heading}>
            Selamat datang di Kundesk, {orgName}!
          </Heading>

          <Text style={styles.text}>
            Akun bisnis kamu sudah aktif. Sekarang kamu bisa mulai upload dokumen 
            seperti <strong>menu,</strong> <strong>FAQ,</strong> dan <strong>daftar harga. </strong> 
            Chatbot AI kamu akan siap membantu menjawab pelanggan dalam hitungan menit.
          </Text>

          <Text style={styles.text}>
            Tidak perlu coding. Setup selesai dalam 5 menit.
          </Text>

          <Section style={styles.btnSection}>
            <Button style={styles.button} href={dashboardUrl}>
              Buka Dashboard →
            </Button>
          </Section>

          <Text style={styles.text}>
            Ada pertanyaan? Balas email ini dan tim kami akan membantu.
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

// ── Inline styles — React Email renders to static HTML, Tailwind doesn't work here ──
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
    margin: "0 0 16px 0",
    lineHeight: "1.3",
  },
  text: {
    fontSize: "15px",
    color: "#2d3748",
    lineHeight: "1.7",
    margin: "0 0 16px 0",
  },
  btnSection: {
    margin: "28px 0",
  },
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
  hr: {
    borderColor: "#e8ecf0",
    margin: "32px 0 20px 0",
  },
  footer: {
    fontSize: "12px",
    color: "#a0aec0",
    margin: 0,
    lineHeight: "1.6",
  },
} as const;

WelcomeEmail.PreviewProps = {
  orgName: "Kun Borneo",
  dashboardUrl: "http://localhost:3000/dashboard",
  logoUrl:
    "https://res.cloudinary.com/ddvmmonre/image/upload/v1779608718/logo_kundesk_meizty.png",
};
