// Full database schema — all 7 tables
// Multi-tenancy: every tenant table has orgId — never query without it
// pgvector: chunks table has embedding column for RAG similarity search
// Handoff fields: included from day one — adding later means migrating live data

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── CUSTOM TYPES ───

// pgvector column type — not natively in Drizzle yet, defined as custom
// 1536 dimensions matches text-embedding-3-small output
const vector = (name: string, dimensions: number) =>
  text(name)
    .notNull()
    .$type<string>()
    // stored as string in drizzle, cast to vector in raw SQL queries
    .$defaultFn(() => `[${Array(dimensions).fill("0").join(",")}]`);

// ─── ORGS ───
// Synced from Clerk webhooks — created when a Clerk Organization is created
// This is the root tenant record — everything else belongs to an org
export const orgs = pgTable("orgs", {
  // Clerk's org ID — used as PK so we never have a separate mapping table
  id: text("id").primaryKey(),

  // Used in /chat/[slug] — must be unique across all orgs
  slug: text("slug").notNull().unique(),

  // Display name — synced from Clerk org name
  name: text("name").notNull(),

  // Owner's email — synced from Clerk on org creation, used for transactional emails
  // Avoids Clerk API call on every usage check
  ownerEmail: text("owner_email"),

  // Clerk userId of the org creator — used to fetch owner email for transactional emails
  createdBy: text("created_by"),

  // Subscription plan — enforced server-side on every chat message
  plan: text("plan").notNull().default("free"),

  // Midtrans customer reference — nullable until first payment
  midtransCustomerId: text("midtrans_customer_id"),

  // Subscription state machine: free → active → past_due → suspended → cancelled
  subscriptionStatus: text("subscription_status").notNull().default("free"),

  // When the current billing period ends
  currentPeriodEnd: timestamp("current_period_end"),

  // When the next Midtrans charge will be created by cron
  nextBillingDate: timestamp("next_billing_date"),

  // Last payment method used — for display in billing dashboard
  lastPaymentMethod: text("last_payment_method"),

  // Message usage tracking — atomic increment on every chat message
  messagesUsed: integer("messages_used").notNull().default(0),

  // Message limit — set based on plan, updated on plan change
  messagesLimit: integer("messages_limit").notNull().default(100),

  // Tracks whether this org has ever completed a paid purchase
  // false = first-time discount still applies to both plans
  // true = discount consumed forever, regardless of which plan was bought first
  hasUsedFirstPurchase: boolean("has_used_first_purchase")
    .notNull()
    .default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── CHATBOTS ───
// One chatbot per org (Pro allows 3 — enforced at creation time)
// Stores all customization options the business owner configures
export const chatbots = pgTable(
  "chatbots",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Tenant isolation — every chatbot belongs to exactly one org
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Display name shown to customers in the chat widget
    name: text("name").notNull().default("Assistant"),

    // Custom system prompt — overrides default if set
    systemPrompt: text("system_prompt"),

    // Response language — "id" | "en" | "both"
    language: text("language").notNull().default("id"),

    // Conversation tone — "friendly" | "professional" | "formal"
    tone: text("tone").notNull().default("friendly"),

    // First message shown when customer opens the chat
    greetingMessage: text("greeting_message"),

    // Hex color — synced to chat widget and QR code foreground color
    accentColor: text("accent_color").notNull().default("#069494"),

    // Whether the chatbot is currently serving customers
    isActive: boolean("is_active").notNull().default(true),

    // Suggested question chips shown above input before first message
    // Stored as JSON array string — e.g. '["Jam buka?","Menu tersedia?"]'
    // Null = feature disabled, no chips shown
    quickReplies: text("quick_replies"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index on orgId — all chatbot queries are scoped to org
    index("chatbots_org_id_idx").on(table.orgId),
  ],
);

// ─── DOCUMENTS ───
// Files uploaded by business owners — PDFs, TXTs
// After upload: parsed → chunked → embedded → stored in chunks table
export const documents = pgTable(
  "documents",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Tenant isolation
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Original filename — displayed in dashboard documents list
    name: text("name").notNull(),

    // S3 object key — used to download file for processing
    s3Key: text("s3_key").notNull(),

    // Processing state — "processing" | "ready" | "failed"
    status: text("status").notNull().default("processing"),

    // Number of chunks created from this document — shown in dashboard
    chunkCount: integer("chunk_count").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index on orgId — all document queries are scoped to org
    index("documents_org_id_idx").on(table.orgId),
  ],
);

// ─── CHUNKS ───
// The RAG knowledge base — most queried table in the entire app
// HNSW index on embedding column for fast cosine similarity search
export const chunks = pgTable(
  "chunks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Tenant isolation — on EVERY chunk, queried first in every similarity search
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Parent document — used to delete chunks when document is deleted
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),

    // The actual text content retrieved and injected into the AI prompt
    content: text("content").notNull(),

    // 1536-dimensional vector from text-embedding-3-small
    // Stored as text, cast to vector in raw SQL similarity queries
    embedding: vector("embedding", 1536),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index on orgId — first filter in every similarity search
    index("chunks_org_id_idx").on(table.orgId),
    // Index on documentId — used when deleting all chunks for a document
    index("chunks_document_id_idx").on(table.documentId),
  ],
);

// ─── CONVERSATIONS ───
// One conversation per customer session
// Handoff fields included from day one — adding later = migrating live data
export const conversations = pgTable(
  "conversations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Tenant isolation
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Browser-generated UUID — identifies the customer's session anonymously
    sessionId: text("session_id").notNull(),

    // Random UUID — used as the public Pusher channel name for the customer widget
    // Unguessable — prevents enumeration of conversation channels by sequential ID
    channelToken: text("channel_token").notNull().default(""),

    // Entry channel — metadata only, RAG pipeline is identical for all channels
    // "web_widget" | "qr_link" | "whatsapp"
    deliveryChannel: text("delivery_channel").notNull().default("web_widget"),

    // Human handoff state machine — "ai" | "human" | "pending_handoff"
    handoffStatus: text("handoff_status").notNull().default("ai"),

    // When a staff member took over — null while AI is handling
    takenOverAt: timestamp("taken_over_at"),

    // Clerk userId of the staff member who took over — null while AI is handling
    takenOverBy: text("taken_over_by"),

    // Permanent analytics flag — set to true the moment any handoff occurs
    // Never reset to false — even if admin returns conversation to AI
    // handoffStatus is live operational state; wasHandedOff is permanent analytics truth
    wasHandedOff: boolean("was_handed_off").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("conversations_org_id_idx").on(table.orgId),
    index("conversations_session_id_idx").on(table.sessionId),
    // Composite — analytics queries filter wasHandedOff + createdAt scoped to org
    index("conversations_org_handoff_created_idx").on(
      table.orgId,
      table.wasHandedOff,
      table.createdAt,
    ),
    // Composite — delivery channel breakdown filter
    index("conversations_org_channel_idx").on(
      table.orgId,
      table.deliveryChannel,
    ),
    // Composite — live handoff status queries (sidebar badge, conversations page)
    // getPendingHandoffCount filters orgId + handoffStatus on every dashboard render
    index("conversations_org_handoff_status_idx").on(
      table.orgId,
      table.handoffStatus,
    ),
  ],
);

// ─── MESSAGES ───
// Every message in every conversation
// orgId stamped directly — avoids JOIN to conversations for tenant isolation
export const messages = pgTable(
  "messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Tenant isolation — stamped directly, no JOIN needed
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Parent conversation
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),

    // "user" = customer, "assistant" = AI, "human_agent" = staff during handoff
    role: text("role").notNull(),

    // The actual message text
    content: text("content").notNull(),

    // OpenAI tokens consumed — used for usage tracking and billing
    tokensUsed: integer("tokens_used").notNull().default(0),

    // How long the AI took to generate the response — null for user/human_agent messages
    // Recorded in milliseconds, displayed as seconds in dashboard
    responseTimeMs: integer("response_time_ms"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("messages_org_id_idx").on(table.orgId),
    index("messages_conversation_id_idx").on(table.conversationId),
    // Composite — answered rate + response time queries filter orgId + role
    index("messages_org_role_created_idx").on(
      table.orgId,
      table.role,
      table.createdAt,
    ),
  ],
);

// ─── PROCESSED WEBHOOKS ───
// Idempotency table — prevents double-processing on webhook retries
// Midtrans retries notifications multiple times — we check this before processing
export const processedWebhooks = pgTable(
  "processed_webhooks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Midtrans order_id or Clerk event_id
    // unique per provider — not globally, since providers can reuse IDs
    externalId: text("external_id").notNull(),

    // "midtrans" | "clerk" — typed, not free text
    source: text("source").notNull(),

    processedAt: timestamp("processed_at").notNull().defaultNow(),
  },
  (table) => [
    // Composite unique — same externalId can exist for different sources
    uniqueIndex("processed_webhooks_source_external_id_idx").on(
      table.source,
      table.externalId,
    ),
  ],
);

// ─── NOTIFICATIONS ───
// Dashboard notifications for business owners — new conversations, handoffs, etc.
// Scoped to org — each owner only sees their own notifications
// In-app only for now — email notifications handled separately
export const notifications = pgTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Tenant isolation — always filter by orgId first
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Notification type — drives icon and copy in the UI
    // "conversation_new" | "conversation_takeover" | "handoff_message"
    type: text("type").notNull(),

    // Short title shown in the notification panel
    title: text("title").notNull(),

    // Supporting detail — e.g. the first message or session ID
    body: text("body").notNull().default(""),

    // Reference to the related conversation — for "Lihat" link
    conversationId: integer("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),

    // Whether the owner has seen this notification
    isRead: boolean("is_read").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index on orgId — all notification queries are scoped to org
    index("notifications_org_id_idx").on(table.orgId),
    // Composite — notifications fetched by org, ordered newest first
    // Replaces standalone isRead index — orgId+createdAt covers the common fetch pattern
    index("notifications_org_created_idx").on(table.orgId, table.createdAt),
  ],
);

// ─── PAYMENTS ───
// Permanent record of every successful payment — source of truth for billing history
// Inserted by the Midtrans webhook handler after activateSubscription succeeds
// Never deleted — billing history must be immutable for accounting purposes
export const payments = pgTable(
  "payments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Tenant isolation — always filter by orgId first
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Full Midtrans order ID — e.g. KUNDESK-org_3DZH-STARTER-1234567890
    orderId: text("order_id").notNull().unique(),

    // Plan that was paid for — derived from order_id but stored explicitly for fast reads
    plan: text("plan").notNull(),

    // Amount paid in Rupiah — stored as integer (no decimals in IDR)
    amount: integer("amount").notNull(),

    // Midtrans payment_type — "bank_transfer" | "gopay" | "qris" | "ovo" | "dana"
    paymentMethod: text("payment_method").notNull(),

    // When Midtrans confirmed the payment — from webhook processedAt timestamp
    paidAt: timestamp("paid_at").notNull().defaultNow(),

    // Always "success" for now — we only insert on settlement + fraud_status=accept
    // "failed" reserved for future partial failure tracking
    status: text("status").notNull().default("success"),
  },
  (table) => [
    // Index on orgId — all payment history queries are scoped to org
    index("payments_org_id_idx").on(table.orgId),
    // Index on paidAt DESC — history is always shown newest first
    index("payments_paid_at_idx").on(table.paidAt),
  ],
);

// ─── PROMO CODES ───
// Time-limited discount codes — created manually via Neon console
// Percentage-based discount applied at checkout, validated server-side
// Never trust discounted price from client — always recalculate server-side
export const promoCodes = pgTable(
  "promo_codes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // The code customers type — stored uppercase, matched case-insensitively
    code: text("code").notNull().unique(),

    // Discount percentage — e.g. 50 means 50% off
    discountPercent: integer("discount_percent").notNull(),

    // Which plans this code applies to — JSON array string e.g. '["starter","pro"]'
    // null = applies to all paid plans
    applicablePlans: text("applicable_plans"),

    // Validity window — null validUntil means no expiry
    validFrom: timestamp("valid_from").notNull().defaultNow(),
    validUntil: timestamp("valid_until"),

    // Usage cap — null means unlimited
    maxUses: integer("max_uses"),

    // How many times this code has been successfully used
    usedCount: integer("used_count").notNull().default(0),

    // Manual kill switch — set false to disable without deleting
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index on code — lookup by code at checkout
    uniqueIndex("promo_codes_code_idx").on(table.code),
  ],
);
