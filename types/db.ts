// Drizzle inferred types — generated from schema, not written manually
// InferSelectModel = shape of a row returned from SELECT
// InferInsertModel = shape required for INSERT

import type { InferSelectModel, InferInsertModel } from "drizzle-orm"
import type {
  orgs,
  chatbots,
  documents,
  chunks,
  conversations,
  messages,
  processedWebhooks,
} from "@/lib/db/schema"

// Org
export type OrgSelect = InferSelectModel<typeof orgs>
export type OrgInsert = InferInsertModel<typeof orgs>

// Chatbot
export type ChatbotSelect = InferSelectModel<typeof chatbots>
export type ChatbotInsert = InferInsertModel<typeof chatbots>

// Document
export type DocumentSelect = InferSelectModel<typeof documents>
export type DocumentInsert = InferInsertModel<typeof documents>

// Chunk
export type ChunkSelect = InferSelectModel<typeof chunks>
export type ChunkInsert = InferInsertModel<typeof chunks>

// Conversation
export type ConversationSelect = InferSelectModel<typeof conversations>
export type ConversationInsert = InferInsertModel<typeof conversations>

// Message
export type MessageSelect = InferSelectModel<typeof messages>
export type MessageInsert = InferInsertModel<typeof messages>

// ProcessedWebhook
export type ProcessedWebhookSelect = InferSelectModel<typeof processedWebhooks>
export type ProcessedWebhookInsert = InferInsertModel<typeof processedWebhooks>
