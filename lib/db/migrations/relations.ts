import { relations } from "drizzle-orm/relations";
import { orgs, chunks, documents, messages, conversations, chatbots, notifications, payments } from "./schema";

export const chunksRelations = relations(chunks, ({one}) => ({
	org: one(orgs, {
		fields: [chunks.orgId],
		references: [orgs.id]
	}),
	document: one(documents, {
		fields: [chunks.documentId],
		references: [documents.id]
	}),
}));

export const orgsRelations = relations(orgs, ({many}) => ({
	chunks: many(chunks),
	documents: many(documents),
	messages: many(messages),
	chatbots: many(chatbots),
	conversations: many(conversations),
	notifications: many(notifications),
	payments: many(payments),
}));

export const documentsRelations = relations(documents, ({one, many}) => ({
	chunks: many(chunks),
	org: one(orgs, {
		fields: [documents.orgId],
		references: [orgs.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	org: one(orgs, {
		fields: [messages.orgId],
		references: [orgs.id]
	}),
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	messages: many(messages),
	org: one(orgs, {
		fields: [conversations.orgId],
		references: [orgs.id]
	}),
	notifications: many(notifications),
}));

export const chatbotsRelations = relations(chatbots, ({one}) => ({
	org: one(orgs, {
		fields: [chatbots.orgId],
		references: [orgs.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	org: one(orgs, {
		fields: [notifications.orgId],
		references: [orgs.id]
	}),
	conversation: one(conversations, {
		fields: [notifications.conversationId],
		references: [conversations.id]
	}),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	org: one(orgs, {
		fields: [payments.orgId],
		references: [orgs.id]
	}),
}));