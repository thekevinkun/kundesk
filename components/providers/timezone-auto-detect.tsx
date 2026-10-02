"use client";

import { useEffect, useRef } from "react";
import { getLocalTimezone } from "@/helpers/format";
import { autoDetectTimezone } from "@/lib/actions/settings";

// Renders nothing — reports the browser's timezone to the server exactly once
// Mounted by the layout only for admins whose org has never been detected
export function TimezoneAutoDetect() {
  // Survives React strict-mode's double effect run, so the action fires once
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Fire-and-forget: a failure here must never disturb the dashboard
    autoDetectTimezone(getLocalTimezone()).catch((err) => {
      console.error("[TimezoneAutoDetect] Failed:", err);
    });
  }, []);

  return null;
}
