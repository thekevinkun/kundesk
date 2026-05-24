import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Img,
  Button,
} from "@react-email/components";

interface OrgDeletionEmailProps {
  orgName: string;
  logoUrl: string;
  signUpUrl: string;
}

export default function OrgDeletionEmail({
  orgName,
  logoUrl,
  signUpUrl,
}: OrgDeletionEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Akun {orgName} telah dihapus dari Kundesk.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={logoUrl}
            alt="Kundesk"
            width={140}
            height="auto"
            style={{ marginBottom: "32px", display: "block" }}
          />

          <Heading style={styles.heading}>Akun telah dihapus</Heading>

          <Text style={styles.text}>
            Kami mengkonfirmasi bahwa akun bisnis <strong>{orgName}</strong> dan
            seluruh data dokumen, percakapan, serta konfigurasi chatbot, telah
            dihapus secara permanen dari sistem <strong>Kundesk</strong>.
          </Text>

          <Text style={styles.text}>
            Jika penghapusan ini tidak kamu lakukan, atau kamu merasa ini adalah
            kesalahan, segera hubungi tim kami dengan membalas email ini.
          </Text>

          <Text style={styles.text}>
            Ingin mulai lagi dari awal? Kamu bisa membuat akun baru kapan saja.
            Gratis, tanpa kartu kredit.
          </Text>

          <Section style={styles.btnSection}>
            <Button style={styles.button} href={signUpUrl}>
              Daftar Akun Baru →
            </Button>
          </Section>

          <Text style={styles.text}>
            Terima kasih sudah menggunakan <strong>Kundesk</strong>. Semoga bisnis kamu terus
            berkembang. 🙏
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

OrgDeletionEmail.PreviewProps = {
  orgName: "Kun Borneo",
  logoUrl:
    "https://res.cloudinary.com/ddvmmonre/image/upload/v1779608718/logo_kundesk_meizty.png",
  signUpUrl: "http://localhost:3000/signup",
};
