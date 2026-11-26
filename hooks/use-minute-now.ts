"use client";

// A clock that ticks once per real minute, aligned to the minute boundary
// Pass the value into formatRelativeTime so every relative time on a card updates together (rule 100)

import { useEffect, useState } from "react";

export function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Wait for the next real minute, then tick every minute after that
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: number | null = null;

    const timeoutId = window.setTimeout(() => {
      setNow(Date.now());
      intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return now;
}
