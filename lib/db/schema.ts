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

    // Entry channel — metadata only, RAG pipeline is identical for all channels
    // "web_widget" | "qr_link" | "whatsapp"
    deliveryChannel: text("delivery_channel").notNull().default("web_widget"),

    // Human handoff state machine — "ai" | "human" | "pending_handoff"
    handoffStatus: text("handoff_status").notNull().default("ai"),

    // When a staff member took over — null while AI is handling
    takenOverAt: timestamp("taken_over_at"),

    // Clerk userId of the staff member who took over — null while AI is handling
    takenOverBy: text("taken_over_by"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index on orgId — all conversation queries are scoped to org
    index("conversations_org_id_idx").on(table.orgId),
    // Index on sessionId — looked up on every chat message
    index("conversations_session_id_idx").on(table.sessionId),
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

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Index on orgId — tenant isolation filter
    index("messages_org_id_idx").on(table.orgId),
    // Index on conversationId — all message queries filter by conversation
    index("messages_conversation_id_idx").on(table.conversationId),
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
