// Email sent to business owner when a customer requests human support
// Triggered when conversation:takeover fires — gives owner the dashboard link

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface HandoffEmailProps {
  orgName: string;
  logoUrl: string;
  sessionId: string;
  lastMessage: string;
  conversationUrl: string;
}

export function HandoffEmail({
  orgName,
  logoUrl,
  sessionId,
  lastMessage,
  conversationUrl,
}: HandoffEmailProps) {
  return (
    <Html lang="id">
      <Head />
      <Body style={body}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img src={logoUrl} width={120} height={32} alt="Kundesk" />
          </Section>

          <Hr style={divider} />

          {/* Alert header */}
          <Section style={content}>
            <Text style={alertBadge}>🙋 Butuh Bantuan</Text>
            <Text style={heading}>Pelanggan meminta bantuan langsung</Text>
            <Text style={body_text}>
              Hai <strong>{orgName}</strong>, pelanggan pada sesi{" "}
              <strong>#{sessionId}</strong> meminta untuk berbicara dengan
              staff.
            </Text>

            {/* Last message preview */}
            <Section style={messagePreview}>
              <Text style={messageLabel}>Pesan terakhir:</Text>
              <Text style={messageText}>"{lastMessage}"</Text>
            </Section>

            <Text style={body_text}>
              Buka dashboard untuk mengambil alih percakapan dan membalas
              langsung.
            </Text>

            <Button style={button} href={conversationUrl}>
              Buka Percakapan →
            </Button>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footer_text}>
              © 2026 Kundesk · Bagian dari Kun Borneo
            </Text>
            <Text style={footer_text}>
              Kamu menerima email ini karena ada permintaan handoff di akun
              Kundesk kamu.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──
const body = {
  backgroundColor: "#f4f5f7",
  fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
};
const container = {
  backgroundColor: "#ffffff",
  maxWidth: "600px",
  margin: "32px auto",
  borderRadius: "16px",
  overflow: "hidden" as const,
  border: "1px solid #e8ecf0",
};
const logoSection = { padding: "24px 32px 16px" };
const divider = { borderColor: "#e8ecf0", margin: "0" };
const content = { padding: "32px" };
const alertBadge = {
  display: "inline-block",
  backgroundColor: "#fef3c7",
  color: "#d97706",
  fontSize: "12px",
  fontWeight: "700" as const,
  padding: "4px 12px",
  borderRadius: "100px",
  marginBottom: "12px",
};
const heading = {
  fontSize: "22px",
  fontWeight: "800" as const,
  color: "#0f1117",
  letterSpacing: "-0.03em",
  margin: "0 0 12px",
};
const body_text = {
  fontSize: "14px",
  color: "#718096",
  lineHeight: "1.7",
  margin: "0 0 16px",
};
const messagePreview = {
  backgroundColor: "#f4f5f7",
  borderLeft: "3px solid #069494",
  borderRadius: "0 8px 8px 0",
  padding: "12px 16px",
  margin: "0 0 20px",
};
const messageLabel = {
  fontSize: "11px",
  fontWeight: "700" as const,
  color: "#a0aec0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  margin: "0 0 4px",
};
const messageText = {
  fontSize: "14px",
  color: "#2d3748",
  fontStyle: "italic" as const,
  margin: "0",
};
const button = {
  backgroundColor: "#069494",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700" as const,
  padding: "12px 28px",
  borderRadius: "100px",
  textDecoration: "none",
  display: "inline-block",
};
const footer = { padding: "20px 32px 24px" };
const footer_text = {
  fontSize: "12px",
  color: "#a0aec0",
  margin: "0 0 4px",
  textAlign: "center" as const,
};
