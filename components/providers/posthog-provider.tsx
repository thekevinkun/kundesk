"use client";

import type { ReactNode } from "react";

interface PostHogProviderProps {
  children: ReactNode;
  orgId: string;
}

// PostHog tracking is server-side only via posthog-node (lib/posthog.ts)
// No client-side PostHog needed — usePostHog() hook is not used anywhere
// This wrapper is kept as a no-op so layout.tsx doesn't need changes
export function PostHogProvider({ children }: PostHogProviderProps) {
  return <>{children}</>;
}
