// Resolves the first name of an organization member from Clerk — server only
// Used by the live conversation preview so the admin desk can name whoever took over a chat

import { clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

// How long a found name (or "not a member") is remembered per server instance
export const NAME_TTL_MS = 5 * 60 * 1000;
// After a failed lookup, wait this long before asking Clerk again — protects Clerk and Sentry from repeats
export const FAILURE_COOLDOWN_MS = 30 * 1000;
// The cache never grows past this many entries
const MAX_ENTRIES = 500;

interface CacheEntry {
  name: string | null;
  expiresAt: number;
}

// In-memory cache — lives as long as the server instance, which is plenty for a name
const cache = new Map<string, CacheEntry>();

// Tests start every case with an empty cache
export function clearOrgMemberNameCache(): void {
  cache.clear();
}

// Store an answer; a full cache is simply emptied rather than evicted entry by entry
function remember(
  key: string,
  name: string | null,
  ttlMs: number,
  now: number,
): void {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { name, expiresAt: now + ttlMs });
}

// First name of a member of THIS org, or null when unknown, not a member, or Clerk failed
export async function getOrgMemberFirstName(
  orgId: string,
  userId: string,
): Promise<string | null> {
  // The key includes the org — the same user id in another org must never reuse an answer
  const key = `${orgId}:${userId}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.name;

  try {
    const client = await clerkClient();
    // Same lookup the Team actions use — filtering by userId also proves the person belongs to this org
    const { data } = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    });
    // A member with no first name falls back to "Staf lain" on the dashboard
    const name = data[0]?.publicUserData?.firstName?.trim() || null;
    remember(key, name, NAME_TTL_MS, now);
    return name;
  } catch (error) {
    // The dashboard must never break because a name could not be fetched
    Sentry.captureException(error, { tags: { area: "live-scene-staff-name" } });
    // Remember the failure briefly so a Clerk outage is asked about (and reported) at most every 30s per person
    remember(key, null, FAILURE_COOLDOWN_MS, now);
    return null;
  }
}
