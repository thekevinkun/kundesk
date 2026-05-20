"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";

interface PostHogProviderProps {
  children: ReactNode;
  orgId: string;
}

export function PostHogProvider({ children, orgId }: PostHogProviderProps) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key || !host) return;

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      disable_session_recording: false,
      autocapture: false,
      respect_dnt: true,
    });
  }, []);

  useEffect(() => {
    if (!orgId) return;
    posthog.identify(orgId, { org_id: orgId });
  }, [orgId]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
