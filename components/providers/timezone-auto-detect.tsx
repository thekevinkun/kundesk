"use client";

import { useEffect, useRef } from "react";
import { autoDetectTimezone } from "@/lib/actions/settings";

// Renders nothing — reports the browser's timezone to the server exactly once
// Mounted by the layout only for admins whose org has never been detected
export function TimezoneAutoDetect() {
  // Survives React strict-mode's double effect run, so the action fires once
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Read Intl directly: getLocalTimezone() returns "Asia/Jakarta" on failure,
    // and a fallback must never be submitted (the server would stamp it as detected)
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Browser can't report a zone — leave the marker null so detection retries later
    }
    if (!zone) return;

    // Fire-and-forget: a failure here must never disturb the dashboard
    autoDetectTimezone(zone).catch((err) => {
      console.error("[TimezoneAutoDetect] Failed:", err);
    });
  }, []);

  return null;
}
