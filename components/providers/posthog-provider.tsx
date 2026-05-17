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

    // Skip in development — network restrictions cause ETIMEDOUT noise
    if (!key || !host || process.env.NODE_ENV === "development") return;

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      disable_session_recording: false,
      autocapture: false,
      respect_dnt: true,
    });
  }, []);

  useEffect(() => {
    // Skip identify in development — posthog was never initialized
    if (!orgId || process.env.NODE_ENV === "development") return;
    posthog.identify(orgId, { org_id: orgId });
  }, [orgId]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
