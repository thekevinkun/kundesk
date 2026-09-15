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

interface OrgDeletionEmailProps {
  orgName: string;
  logoUrl: string;
  // Replaces signUpUrl — points back to Settings so the owner can cancel
  settingsUrl: string;
  // Human-readable purge date, e.g. "15 Oktober 2026" — formatted by the caller
  purgeDate: string;
}

export default function OrgDeletionEmail({
  orgName,
  logoUrl,
  settingsUrl,
  purgeDate,
}: OrgDeletionEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Penghapusan akun {orgName} dijadwalkan pada {purgeDate}.
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

          <Heading style={styles.heading}>Penghapusan akun dijadwalkan</Heading>

          <Text style={styles.text}>
            Kami menerima permintaan untuk menghapus akun bisnis{" "}
            <strong>{orgName}</strong> dari <strong>Kundesk</strong>. Akun kamu
            masih dapat digunakan seperti biasa selama masa tenggang ini.
          </Text>

          <Text style={styles.text}>
            Seluruh data — dokumen, percakapan, dan konfigurasi KUN — akan
            dihapus permanen pada <strong>{purgeDate}</strong>, kecuali kamu
            membatalkan penghapusan sebelum tanggal tersebut.
          </Text>

          <Text style={styles.text}>
            Berubah pikiran? Kamu bisa membatalkan permintaan ini kapan saja
            sebelum tanggal di atas.
          </Text>

          <Section style={styles.btnSection}>
            <Button style={styles.button} href={settingsUrl}>
              Batalkan Penghapusan →
            </Button>
          </Section>

          <Text style={styles.text}>
            Jika kamu tidak melakukan permintaan ini, kamu masih dapat masuk ke
            dashboard dan membatalkan penghapusan kapan saja sebelum{" "}{purgeDate}.
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
  logoUrl: EMAIL_PREVIEW_LOGO_URL,
  settingsUrl: "http://localhost:3000/dashboard/settings",
  purgeDate: "15 Oktober 2026",
};
