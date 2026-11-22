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
        activeConversationCount: 0,
        pendingHandoffCount: 0,
        bot: null,
        organization: null,
      }),
    ).toEqual({
      stats: {
        totalMessages: 0,
        messagesToday: 0,
        answeredRate: 0,
        uniqueVisitors: 0,
        avgResponseTime: null,
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
      },
    });
  });
});
