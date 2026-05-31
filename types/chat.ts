// Chat, conversation, and message types
// Used by the RAG pipeline, SSE streaming, and dashboard conversations page

// Role of a message sender — "human_agent" is for human handoff replies
export type MessageRole = "user" | "assistant" | "human_agent";

// Status of AI vs human control for a conversation
export type HandoffStatus = "ai" | "human" | "pending_handoff";

// Channel the conversation came through — metadata only, not logic
export type DeliveryChannel = "web_widget" | "qr_link" | "whatsapp";

// Error type for chat store
export type ChatErrorType = "quota_exceeded" | "rate_limit" | "generic";

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

// Shape of chatbot configuration used when building the system prompt and rendering the chat UI
export type ChatbotConfig = {
  language: "id" | "en" | "both";
  accentColor: string;
  systemPrompt: string | null;
  quickReplies: string[] | null;
};

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

// Lean message shape for OpenAI conversation history — role + content only
// ChatMessage has the full DB shape — this is what we pass to the API
export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

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

// Shape of a message as rendered in the chat UI — extends ConversationTurn with a local id
export interface ChatUIMessage {
  // Local-only id for React key — not the DB id
  localId: string;
  // human_agent added for staff replies during handoff
  role: MessageRole;
  content: string;
  // True while the assistant is still streaming this message
  isStreaming?: boolean;
}

export interface ChatStore {
  // All messages rendered in the chat UI
  messages: ChatUIMessage[];
  // True while waiting for the first token of a new assistant response
  isLoading: boolean;
  // The session ID for this browser session — generated once on first load
  sessionId: string;
  // conversationId — set after first message, used to filter Pusher events by session
  conversationId: number | null;
  // channel token for chat widget
  channelToken: string | null;
  // Whether the input should be disabled (streaming in progress)
  isStreaming: boolean;
  // Error message to show in the UI — null when no error
  error: string | null;
  // Error type — distinguishes quota exhausted from generic errors for different UI treatment
  errorType: ChatErrorType | null;
  // Status control of conversation
  handoffStatus: HandoffStatus;

  // Actions
  setSessionId: (id: string) => void;
  setConversationId: (id: number) => void;
  setChannelToken: (token: string) => void;
  setHandoffStatus: (status: HandoffStatus) => void;
  addUserMessage: (content: string) => void;
  addHumanAgentMessage: (content: string) => void; // Appends a staff reply directly — called when Pusher fires conversation:message with role human_agent
  startAssistantMessage: () => string; // returns localId of the new message
  appendToken: (localId: string, token: string) => void;
  finalizeAssistantMessage: (localId: string) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  setErrorWithType: (error: string, errorType: ChatErrorType | null) => void;
}
