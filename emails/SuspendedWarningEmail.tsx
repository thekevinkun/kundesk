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
import { EMAIL_PREVIEW_LOGO_URL } from "./constants";

interface SuspendedWarningEmailProps {
  orgName: string;
  logoUrl: string;
  billingUrl: string;
  purgeDate: string;
}

export default function SuspendedWarningEmail({
  orgName,
  logoUrl,
  billingUrl,
  purgeDate,
}: SuspendedWarningEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Akun {orgName} akan dihapus pada {purgeDate} karena tidak aktif.
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={logoUrl}
            alt="Kundesk"
            width={148}
            height="auto"
            style={{ marginBottom: "32px", display: "block" }}
          />

          <Heading style={styles.heading}>
            Akun kamu akan segera dihapus
          </Heading>

          <Text style={styles.text}>
            Akun bisnis <strong>{orgName}</strong> telah nonaktif selama 90 hari
            karena pembayaran yang belum diselesaikan. Untuk menjaga privasi
            data, seluruh data — dokumen, percakapan, dan konfigurasi KUN — akan
            dihapus permanen pada <strong>{purgeDate}</strong>.
          </Text>

          <Text style={styles.text}>
            Ingin menyimpan data kamu? Selesaikan pembayaran sebelum tanggal di
            atas untuk mengaktifkan kembali akun kamu sepenuhnya.
          </Text>

          <Section style={styles.btnSection}>
            <Button style={styles.button} href={billingUrl}>
              Selesaikan Pembayaran →
            </Button>
          </Section>

          <Text style={styles.text}>
            Jika kamu tidak berencana melanjutkan penggunaan Kundesk, tidak ada
            tindakan lebih lanjut yang diperlukan — data akan dihapus secara
            otomatis pada tanggal tersebut.
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

SuspendedWarningEmail.PreviewProps = {
  orgName: "Kun Borneo",
  logoUrl: EMAIL_PREVIEW_LOGO_URL,
  billingUrl: "http://localhost:3000/dashboard/billing",
  purgeDate: "15 Oktober 2026",
};
