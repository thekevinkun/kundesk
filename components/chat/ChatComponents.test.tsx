// Component tests for chat UI leaf components
// Tests: ChatHeader, ChatInput, MessageBubble, GenericErrorBanner,
//        QuotaExceededState, PendingHandoffState
// All are pure presentational — props in, UI out, no store or hooks needed

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  ChatHeader,
  ChatInput,
  MessageBubble,
  QuotaExceededState,
  GenericErrorBanner,
  PendingHandoffState,
} from "@/components/chat";

// ─── ChatHeader ───

describe("ChatHeader", () => {
  // name prop removed — KUN is always the name
  const defaultProps = {
    orgName: "Kedai Bu Sari",
    accentColor: "#069494",
  };

  it("renders KUN as the bot name", () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByText("KUN")).toBeInTheDocument();
  });

  it("renders the org name", () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByText("Kedai Bu Sari")).toBeInTheDocument();
  });

  it("shows KUN logo image as avatar", () => {
    render(<ChatHeader {...defaultProps} />);
    const img = screen.getByAltText("KUN");
    expect(img).toBeInTheDocument();
  });

  it("shows Online indicator", () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("applies accentColor as background style", () => {
    render(<ChatHeader {...defaultProps} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveStyle({ background: "#069494" });
  });
});

// ─── ChatInput ───

describe("ChatInput", () => {
  const defaultProps = {
    value: "",
    disabled: false,
    accentColor: "#069494",
    isHumanMode: false,
    handoffStatus: "ai",
    onChange: vi.fn(),
    onSend: vi.fn(),
  };

  it("renders the textarea", () => {
    render(<ChatInput {...defaultProps} />);
    expect(
      screen.getByRole("textbox", { name: "Input pesan" }),
    ).toBeInTheDocument();
  });

  it("renders the send button", () => {
    render(<ChatInput {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Kirim pesan" }),
    ).toBeInTheDocument();
  });

  it("shows default placeholder when not disabled", () => {
    render(<ChatInput {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("Ketik pesan kamu..."),
    ).toBeInTheDocument();
  });

  it("shows waiting placeholder when disabled in AI mode", () => {
    render(<ChatInput {...defaultProps} disabled={true} />);
    expect(
      screen.getByPlaceholderText("Menunggu respons..."),
    ).toBeInTheDocument();
  });

  it("calls onChange when typing", () => {
    const onChange = vi.fn();
    render(<ChatInput {...defaultProps} onChange={onChange} />);
    const textarea = screen.getByRole("textbox", { name: "Input pesan" });
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(onChange).toHaveBeenCalledWith("Hello");
  });

  it("calls onSend when send button clicked", () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Kirim pesan" }));
    expect(onSend).toHaveBeenCalled();
  });

  it("send button is disabled when value is empty", () => {
    render(<ChatInput {...defaultProps} value="" />);
    expect(screen.getByRole("button", { name: "Kirim pesan" })).toBeDisabled();
  });

  it("send button is enabled when value has content", () => {
    render(<ChatInput {...defaultProps} value="Hello" />);
    expect(
      screen.getByRole("button", { name: "Kirim pesan" }),
    ).not.toBeDisabled();
  });

  // ── AI mode footer hint ──

  it("shows AI mode hint footer in normal mode", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByText("hubungi admin")).toBeInTheDocument();
  });

  // ── Human mode ──

  it("shows 'Menunggu staff kami' in pending_handoff status", () => {
    render(
      <ChatInput
        {...defaultProps}
        isHumanMode={true}
        handoffStatus="pending_handoff"
      />,
    );
    expect(screen.getByText(/Menunggu staff kami/)).toBeInTheDocument();
  });

  it("shows connected message in human handoff status", () => {
    render(
      <ChatInput {...defaultProps} isHumanMode={true} handoffStatus="human" />,
    );
    expect(
      screen.getByText(/Kamu sedang terhubung dengan staff kami/),
    ).toBeInTheDocument();
  });

  it("textarea is NOT disabled in human mode even when disabled prop is true", () => {
    render(
      <ChatInput
        {...defaultProps}
        disabled={true}
        isHumanMode={true}
        handoffStatus="human"
      />,
    );
    // In human mode the textarea ignores the disabled prop
    const textarea = screen.getByRole("textbox", { name: "Input pesan" });
    expect(textarea).not.toBeDisabled();
  });
});

// ─── MessageBubble ───

describe("MessageBubble", () => {
  // botName prop removed — KUN is always the assistant name
  const defaultProps = {
    accentColor: "#069494",
    isStreaming: false,
  };

  it("renders user message content", () => {
    render(
      <MessageBubble
        {...defaultProps}
        role="user"
        content="Halo, ada menu vegetarian?"
      />,
    );
    expect(screen.getByText("Halo, ada menu vegetarian?")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    render(
      <MessageBubble
        {...defaultProps}
        role="assistant"
        content="Tentu! Kami punya Nasi Goreng Sayur."
      />,
    );
    expect(
      screen.getByText("Tentu! Kami punya Nasi Goreng Sayur."),
    ).toBeInTheDocument();
  });

  it("renders human_agent message content", () => {
    render(
      <MessageBubble
        {...defaultProps}
        role="human_agent"
        content="Halo, saya staff Bu Sari."
      />,
    );
    expect(screen.getByText("Halo, saya staff Bu Sari.")).toBeInTheDocument();
  });

  it("shows KUN logo image as avatar for assistant messages", () => {
    render(
      <MessageBubble {...defaultProps} role="assistant" content="Hello" />,
    );
    // KUN logo replaces the old "AI" text avatar
    const img = screen.getByAltText("KUN");
    expect(img).toBeInTheDocument();
  });

  it("shows human avatar emoji for human_agent messages", () => {
    render(
      <MessageBubble {...defaultProps} role="human_agent" content="Hello" />,
    );
    expect(screen.getByText("👤")).toBeInTheDocument();
  });

  it("does not show avatar for user messages", () => {
    render(<MessageBubble {...defaultProps} role="user" content="Hello" />);
    // No AI or human_agent avatar — user messages have no avatar
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
    expect(screen.queryByText("👤")).not.toBeInTheDocument();
  });

  it("aria-label includes role and content for user message", () => {
    render(<MessageBubble {...defaultProps} role="user" content="Halo" />);
    expect(screen.getByLabelText("Kamu: Halo")).toBeInTheDocument();
  });

  it("aria-label uses KUN for assistant message", () => {
    render(<MessageBubble {...defaultProps} role="assistant" content="Halo" />);
    expect(screen.getByLabelText("KUN: Halo")).toBeInTheDocument();
  });

  it("aria-label uses Staff for human_agent message", () => {
    render(
      <MessageBubble {...defaultProps} role="human_agent" content="Halo" />,
    );
    expect(screen.getByLabelText("Staff: Halo")).toBeInTheDocument();
  });
});

// ─── GenericErrorBanner ───

describe("GenericErrorBanner", () => {
  it("renders the error message", () => {
    render(
      <GenericErrorBanner
        error="Terlalu banyak permintaan"
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Terlalu banyak permintaan")).toBeInTheDocument();
  });

  it("renders dismiss button", () => {
    render(<GenericErrorBanner error="Error" onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Tutup pesan error" }),
    ).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button clicked", () => {
    const onDismiss = vi.fn();
    render(<GenericErrorBanner error="Error" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Tutup pesan error" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("has role=alert for screen readers", () => {
    render(<GenericErrorBanner error="Error" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ─── QuotaExceededState ───

describe("QuotaExceededState", () => {
  it("renders the error message", () => {
    render(
      <QuotaExceededState
        error="Batas pesan bulanan telah tercapai"
        accentColor="#069494"
      />,
    );
    expect(
      screen.getByText("Batas pesan bulanan telah tercapai"),
    ).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(<QuotaExceededState error="Some error" accentColor="#069494" />);
    expect(screen.getByText("Batas pesan telah tercapai")).toBeInTheDocument();
  });

  it("has role=status for screen readers", () => {
    render(<QuotaExceededState error="Error" accentColor="#069494" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ─── PendingHandoffState ───

describe("PendingHandoffState", () => {
  it("renders the waiting title", () => {
    render(<PendingHandoffState accentColor="#069494" />);
    expect(screen.getByText("Menunggu staff kami")).toBeInTheDocument();
  });

  it("renders the waiting description", () => {
    render(<PendingHandoffState accentColor="#069494" />);
    expect(screen.getByText(/Permintaanmu sudah diterima/)).toBeInTheDocument();
  });

  it("has role=status for screen readers", () => {
    render(<PendingHandoffState accentColor="#069494" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
