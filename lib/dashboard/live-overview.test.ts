import { describe, expect, it } from "vitest";
import { createLiveOverviewSnapshot } from "./live-overview";

describe("createLiveOverviewSnapshot", () => {
  it("preserves valid zero states without inventing operational activity", () => {
    expect(
      createLiveOverviewSnapshot({
        totalMessages: 0,
        messagesToday: 0,
        answeredRate: 0,
        uniqueVisitors: 0,
        avgResponseTime: null,
        totalHandoffCount: 0,
        totalConversationCount: 0,
        activeConversationCount: 0,
        pendingHandoffCount: 0,
        bot: null,
        organization: null,
        knowledgeHealth: { failedDocumentCount: 0, staleEntryCount: 0 },
      }),
    ).toEqual({
      stats: {
        totalMessages: 0,
        messagesToday: 0,
        answeredRate: 0,
        uniqueVisitors: 0,
        avgResponseTime: null,
        totalHandoffCount: 0,
        totalConversationCount: 0,
      },
      queue: {
        activeConversationCount: 0,
        pendingHandoffCount: 0,
      },
      bot: null,
      organization: {
        slug: "",
        messagesUsed: 0,
        messagesLimit: 100,
        plan: "free",
        subscriptionStatus: "free",
      },
      knowledgeHealth: { failedDocumentCount: 0, staleEntryCount: 0 },
    });
  });

  it("passes the payment status and knowledge health through unchanged", () => {
    const snapshot = createLiveOverviewSnapshot({
      totalMessages: 10,
      messagesToday: 2,
      answeredRate: 90,
      uniqueVisitors: 4,
      avgResponseTime: "1.4s",
      totalHandoffCount: 1,
      totalConversationCount: 12,
      activeConversationCount: 2,
      pendingHandoffCount: 1,
      bot: null,
      organization: {
        slug: "warung-paco",
        messagesUsed: 10,
        messagesLimit: 100,
        plan: "pro",
        subscriptionStatus: "past_due",
      },
      knowledgeHealth: { failedDocumentCount: 2, staleEntryCount: 5 },
    });

    expect(snapshot.organization.subscriptionStatus).toBe("past_due");
    expect(snapshot.stats.totalConversationCount).toBe(12);
    expect(snapshot.knowledgeHealth).toEqual({
      failedDocumentCount: 2,
      staleEntryCount: 5,
    });
  });
});
