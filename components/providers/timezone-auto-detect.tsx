"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { autoDetectTimezone } from "@/lib/actions/settings";

// Renders nothing — reports the browser's timezone to the server exactly once
// Mounted by the layout only for admins whose org has never been detected
export function TimezoneAutoDetect() {
  const queryClient = useQueryClient();

  // Survives React strict-mode's double effect run, so the action fires once
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Read Intl directly and never submit a fallback zone: the server would stamp it
    // as "detected" and detection would never retry
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Browser can't report a zone — leave the marker null so detection retries later
    }
    if (!zone) return;

    // Fire-and-forget: a failure here must never disturb the dashboard
    autoDetectTimezone(zone)
      .then((result) => {
        // Charts group by day in the org timezone — refetch them only if the zone really changed
        if (result.success && result.data.updated) {
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }
      })
      .catch((err) => {
        console.error("[TimezoneAutoDetect] Failed:", err);
      });
  }, [queryClient]);

  return null;
}
