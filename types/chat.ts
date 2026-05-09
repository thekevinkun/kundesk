// Chat, conversation, and message types
// Used by the RAG pipeline, SSE streaming, and dashboard conversations page

// Role of a message sender — "human_agent" is for human handoff replies
export type MessageRole = "user" | "assistant" | "human_agent";

// Status of AI vs human control for a conversation
export type HandoffStatus = "ai" | "human" | "pending_handoff";

// Channel the conversation came through — metadata only, not logic
export type DeliveryChannel = "web_widget" | "qr_link" | "whatsapp";

// A single chat message
export interface ChatMessage {
  id: number;
  orgId: string;
  conversationId: number;
  role: MessageRole;
  content: string;
  tokensUsed: number;
  createdAt: Date;
}

// A conversation session
export interface Conversation {
  id: number;
  orgId: string;
  sessionId: string;
  deliveryChannel: DeliveryChannel;
  handoffStatus: HandoffStatus;
  takenOverAt: Date | null;
  takenOverBy: string | null;
  createdAt: Date;
}

// Session stored in browser for anonymous customers
export interface ConversationSession {
  sessionId: string;
  conversationId: number;
  orgSlug: string;
  startedAt: number; // Unix timestamp
}

// Payload sent to the chat API route
export interface ChatRequestPayload {
  message: string;
  sessionId: string;
  conversationId: number;
  orgSlug: string;
}

// SSE streaming event types
export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "done"; conversationId: number }
  | { type: "error"; message: string }
  | { type: "limit"; message: string };
