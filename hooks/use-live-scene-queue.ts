"use client";

// Plays real scene events one at a time: listens to every store change, queues them, returns the one on stage
// The store holds a single slot, so subscribing (not selecting) is what keeps back-to-back events from being lost

import { useEffect, useState } from "react";
import { SCENE_MOMENTS } from "@/helpers/live-scene-moments";
import {
  EMPTY_QUEUE,
  dequeueMoment,
  enqueueMoment,
} from "@/helpers/live-scene-queue";
import { useConversationStore } from "@/stores/conversation-store";
import type { SceneMoment } from "@/types/live-scene";

export function useLiveSceneQueue(): SceneMoment | null {
  // The moment currently on stage
  const [active, setActive] = useState<SceneMoment | null>(null);

  useEffect(() => {
    // Queue state lives inside the effect — timers and subscription share it
    let state = EMPTY_QUEUE;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Start the next waiting moment, or clear the stage when none is left
    const playNext = () => {
      const result = dequeueMoment(state);
      state = result.state;
      if (!result.next) {
        busy = false;
        setActive(null);
        return;
      }
      busy = true;
      setActive(result.next);
      timer = setTimeout(playNext, SCENE_MOMENTS[result.next.kind].durationMs);
    };

    // Called for every store change, so two events in one tick both arrive
    const unsubscribe = useConversationStore.subscribe((current, previous) => {
      const event = current.liveWorkspaceEvent;
      // Ignore unrelated store updates and the clear on org change
      if (!event || event === previous.liveWorkspaceEvent) return;
      // A hidden tab would replay stale moments when the visitor comes back
      if (typeof document !== "undefined" && document.hidden) return;
      state = enqueueMoment(
        state,
        { id: event.id, kind: event.type },
        Date.now(),
      );
      if (!busy) playNext();
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return active;
}
