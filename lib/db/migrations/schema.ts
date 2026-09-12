import {
  pgTable,
  uniqueIndex,
  integer,
  text,
  timestamp,
  index,
  foreignKey,
  boolean,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const processedWebhooks = pgTable(
  "processed_webhooks",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "processed_webhooks_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    externalId: text("external_id").notNull(),
    source: text().notNull(),
    processedAt: timestamp("processed_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("processed_webhooks_source_external_id_idx").using(
      "btree",
      table.source.asc().nullsLast().op("text_ops"),
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const chunks = pgTable(
  "chunks",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "chunks_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    orgId: text("org_id").notNull(),
    documentId: integer("document_id").notNull(),
    content: text().notNull(),
    embedding: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chunks_document_id_idx").using(
      "btree",
      table.documentId.asc().nullsLast().op("int4_ops"),
    ),
    index("chunks_embedding_idx")
      .using("hnsw", sql`((embedding)::vector(1536))`)
      .with({ m: "16", ef_construction: "128" }),
    index("chunks_org_id_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: "chunks_org_id_orgs_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documents.id],
      name: "chunks_document_id_documents_id_fk",
    }).onDelete("cascade"),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "documents_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    orgId: text("org_id").notNull(),
    name: text().notNull(),
    s3Key: text("s3_key").notNull(),
    status: text().default("processing").notNull(),
    chunkCount: integer("chunk_count").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("documents_org_id_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: "documents_org_id_orgs_id_fk",
    }).onDelete("cascade"),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "messages_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    orgId: text("org_id").notNull(),
    conversationId: integer("conversation_id").notNull(),
    role: text().notNull(),
    content: text().notNull(),
    tokensUsed: integer("tokens_used").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    responseTimeMs: integer("response_time_ms"),
  },
  (table) => [
    index("messages_conversation_id_idx").using(
      "btree",
      table.conversationId.asc().nullsLast().op("int4_ops"),
    ),
    index("messages_org_id_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
    ),
    index("messages_org_role_created_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
      table.role.asc().nullsLast().op("timestamp_ops"),
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: "messages_org_id_orgs_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.conversationId],
      foreignColumns: [conversations.id],
      name: "messages_conversation_id_conversations_id_fk",
    }).onDelete("cascade"),
  ],
);

export const chatbots = pgTable(
  "chatbots",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "chatbots_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    orgId: text("org_id").notNull(),
    systemPrompt: text("system_prompt"),
    language: text().default("id").notNull(),
    accentColor: text("accent_color").default("#069494").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    quickReplies: text("quick_replies"),
  },
  (table) => [
    index("chatbots_org_id_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: "chatbots_org_id_orgs_id_fk",
    }).onDelete("cascade"),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "conversations_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    orgId: text("org_id").notNull(),
    sessionId: text("session_id").notNull(),
    deliveryChannel: text("delivery_channel").default("web_widget").notNull(),
    handoffStatus: text("handoff_status").default("ai").notNull(),
    takenOverAt: timestamp("taken_over_at", { mode: "string" }),
    takenOverBy: text("taken_over_by"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    channelToken: text("channel_token").default("").notNull(),
    wasHandedOff: boolean("was_handed_off").default(false).notNull(),
  },
  (table) => [
    index("conversations_org_channel_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
      table.deliveryChannel.asc().nullsLast().op("text_ops"),
    ),
    index("conversations_org_handoff_created_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("bool_ops"),
      table.wasHandedOff.asc().nullsLast().op("text_ops"),
      table.createdAt.asc().nullsLast().op("bool_ops"),
    ),
    index("conversations_org_handoff_status_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
      table.handoffStatus.asc().nullsLast().op("text_ops"),
    ),
    index("conversations_org_id_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
    ),
    index("conversations_session_id_idx").using(
      "btree",
      table.sessionId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: "conversations_org_id_orgs_id_fk",
    }).onDelete("cascade"),
  ],
);

export const orgs = pgTable(
  "orgs",
  {
    id: text().primaryKey().notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    plan: text().default("free").notNull(),
    midtransCustomerId: text("midtrans_customer_id"),
    subscriptionStatus: text("subscription_status").default("free").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { mode: "string" }),
    nextBillingDate: timestamp("next_billing_date", { mode: "string" }),
    lastPaymentMethod: text("last_payment_method"),
    messagesUsed: integer("messages_used").default(0).notNull(),
    messagesLimit: integer("messages_limit").default(100).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    ownerEmail: text("owner_email"),
    createdBy: text("created_by"),
    hasUsedFirstPurchase: boolean("has_used_first_purchase")
      .default(false)
      .notNull(),
  },
  (table) => [unique("orgs_slug_unique").on(table.slug)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "notifications_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    orgId: text("org_id").notNull(),
    type: text().notNull(),
    title: text().notNull(),
    body: text().default("").notNull(),
    conversationId: integer("conversation_id"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_org_created_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
      table.createdAt.desc().nullsFirst().op("text_ops"),
    ),
    index("notifications_org_id_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: "notifications_org_id_orgs_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.conversationId],
      foreignColumns: [conversations.id],
      name: "notifications_conversation_id_conversations_id_fk",
    }).onDelete("set null"),
  ],
);

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "promo_codes_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    code: text().notNull(),
    discountPercent: integer("discount_percent").notNull(),
    applicablePlans: text("applicable_plans"),
    validFrom: timestamp("valid_from", { mode: "string" })
      .defaultNow()
      .notNull(),
    validUntil: timestamp("valid_until", { mode: "string" }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("promo_codes_code_lower_idx").using("btree", sql`lower(code)`),
    unique("promo_codes_code_unique").on(table.code),
    check(
      "chk_discount_percent",
      sql`(discount_percent >= 1) AND (discount_percent <= 100)`,
    ),
    check("chk_max_uses", sql`(max_uses IS NULL) OR (max_uses >= 0)`),
    check("chk_used_count", sql`used_count >= 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: integer()
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "payments_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    orgId: text("org_id").notNull(),
    orderId: text("order_id").notNull(),
    plan: text().notNull(),
    amount: integer().notNull(),
    paymentMethod: text("payment_method"),
    paidAt: timestamp("paid_at", { mode: "string" }),
    status: text().default("pending").notNull(),
    redirectUrl: text("redirect_url"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payments_org_id_idx").using(
      "btree",
      table.orgId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("payments_org_pending_unique_idx")
      .using("btree", table.orgId.asc().nullsLast().op("text_ops"))
      .where(sql`(status = 'pending'::text)`),
    index("payments_paid_at_idx").using(
      "btree",
      table.paidAt.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [orgs.id],
      name: "payments_org_id_fkey",
    }).onDelete("cascade"),
    unique("payments_order_id_key").on(table.orderId),
  ],
);
