// Pure queue rules for scene moments — the hook only adds timers around these

import type { SceneMoment, SceneQueueState } from "@/types/live-scene";

// The same kind of event inside this window counts as one (e.g. conversation:new + conversation:message)
export const COALESCE_MS = 1200;
// A burst never queues more than this many moments — the newest win
export const MAX_QUEUE = 5;

export const EMPTY_QUEUE: SceneQueueState = { queue: [], last: null };

// Add a moment, or ignore it if it repeats the previous kind too quickly
export function enqueueMoment(
  state: SceneQueueState,
  moment: SceneMoment,
  now: number,
): SceneQueueState {
  // Compare with the last event received, whether or not it has played yet
  if (
    state.last &&
    state.last.kind === moment.kind &&
    now - state.last.at < COALESCE_MS
  ) {
    return state;
  }
  return {
    // Keep the newest MAX_QUEUE moments
    queue: [...state.queue, moment].slice(-MAX_QUEUE),
    last: { kind: moment.kind, at: now },
  };
}

// Take the next moment off the front — null when nothing is waiting
export function dequeueMoment(state: SceneQueueState): {
  next: SceneMoment | null;
  state: SceneQueueState;
} {
  const [next, ...rest] = state.queue;
  return { next: next ?? null, state: { ...state, queue: rest } };
}
