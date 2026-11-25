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
    setLiveWorkspaceEvent("customer-message-ai");
    const first = useConversationStore.getState().liveWorkspaceEvent;
    setLiveWorkspaceEvent("kun-reply");
    const second = useConversationStore.getState().liveWorkspaceEvent;

    expect(first?.id).toBeDefined();
    expect(second?.id).toBeDefined();
    expect((second?.id ?? 0) > (first?.id ?? 0)).toBe(true);
  });

  // CHARACTERIZATION: the store still has one slot, so a newer event replaces the
  // older one. The workspace subscribes to every change, so nothing is lost on stage.
  it("keeps only the newest event in the slot", () => {
    const { setLiveWorkspaceEvent } = useConversationStore.getState();

    setLiveWorkspaceEvent("customer-message-ai");
    setLiveWorkspaceEvent("kun-reply");

    expect(useConversationStore.getState().liveWorkspaceEvent?.type).toBe(
      "kun-reply",
    );
  });

  it("notifies subscribers of every event, even back-to-back ones", () => {
    const seen: string[] = [];
    const unsubscribe = useConversationStore.subscribe((state) => {
      if (state.liveWorkspaceEvent) seen.push(state.liveWorkspaceEvent.type);
    });

    useConversationStore
      .getState()
      .setLiveWorkspaceEvent("customer-message-ai");
    useConversationStore.getState().setLiveWorkspaceEvent("kun-reply");
    unsubscribe();

    expect(seen).toEqual(["customer-message-ai", "kun-reply"]);
  });

  it("clears the slot", () => {
    useConversationStore
      .getState()
      .setLiveWorkspaceEvent("customer-message-ai");
    useConversationStore.getState().clearLiveWorkspaceEvent();

    expect(useConversationStore.getState().liveWorkspaceEvent).toBeNull();
  });
});
