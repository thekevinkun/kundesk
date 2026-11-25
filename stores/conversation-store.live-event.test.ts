import { beforeEach, describe, expect, it } from "vitest";
import { useConversationStore } from "./conversation-store";

describe("liveWorkspaceEvent", () => {
  beforeEach(() => {
    // Start every test with an empty slot
    useConversationStore.getState().clearLiveWorkspaceEvent();
  });

  it("gives events fired back-to-back different, increasing ids", () => {
    const { setLiveWorkspaceEvent } = useConversationStore.getState();

    // Two events in the same millisecond used to share an id
    setLiveWorkspaceEvent("customer-to-kun");
    const first = useConversationStore.getState().liveWorkspaceEvent;
    setLiveWorkspaceEvent("kun-to-customer");
    const second = useConversationStore.getState().liveWorkspaceEvent;

    expect(first?.id).toBeDefined();
    expect(second?.id).toBeDefined();
    expect((second?.id ?? 0) > (first?.id ?? 0)).toBe(true);
  });

  // CHARACTERIZATION: the store has one slot, so a newer event replaces the
  // older one. PR 3 replaces this with a queue and must update this test.
  it("keeps only the newest event", () => {
    const { setLiveWorkspaceEvent } = useConversationStore.getState();

    setLiveWorkspaceEvent("customer-to-kun");
    setLiveWorkspaceEvent("kun-to-customer");

    expect(useConversationStore.getState().liveWorkspaceEvent?.type).toBe(
      "kun-to-customer",
    );
  });

  it("clears the slot", () => {
    useConversationStore.getState().setLiveWorkspaceEvent("customer-to-kun");
    useConversationStore.getState().clearLiveWorkspaceEvent();

    expect(useConversationStore.getState().liveWorkspaceEvent).toBeNull();
  });
});
