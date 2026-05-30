// Plays notification sounds when Pusher events arrive on the dashboard
// Two sounds: new-message (soft) for new conversations + human mode customer messages
//             handoff-alert (urgent) for pending_handoff events
// Rules:
//   - Sound only plays when the tab is not focused (document.hidden) OR always — your call
//   - Audio is lazy-loaded on first play — no preload on mount to respect browser policies
//   - Browser blocks audio until user has interacted with the page — safe, fails silently
//   - Never throws — sound failure must never break the dashboard

"use client";

import { useRef, useCallback } from "react";

type SoundType = "new-message" | "handoff-alert";

export function useSoundNotification() {
  // Cache Audio instances — avoid recreating on every event
  const audioRefs = useRef<Partial<Record<SoundType, HTMLAudioElement>>>({});

  const play = useCallback((type: SoundType) => {
    try {
      // Reuse cached instance if already created
      if (!audioRefs.current[type]) {
        audioRefs.current[type] = new Audio(`/sounds/${type}.mp3`);
        // Lower volume slightly — dashboard sounds should be subtle
        audioRefs.current[type]!.volume = type === "handoff-alert" ? 0.8 : 0.5;
      }

      const audio = audioRefs.current[type]!;

      // Reset to start — allows rapid re-triggers without waiting for previous to finish
      audio.currentTime = 0;

      // play() returns a Promise — browser may reject if no user interaction yet
      audio.play().catch(() => {
        // Silently ignore — autoplay policy blocks sound until user interacts
        // After first click anywhere in the dashboard, sounds will work normally
      });
    } catch {
      // Silently ignore — sound failure must never crash the dashboard
    }
  }, []);

  const playNewMessage = useCallback(() => {
    play("new-message");
  }, [play]);

  const playHandoffAlert = useCallback(() => {
    play("handoff-alert");
  }, [play]);

  return { playNewMessage, playHandoffAlert };
}
