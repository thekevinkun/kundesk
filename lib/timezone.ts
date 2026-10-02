// Returns the BUSINESS's timezone (orgs.timezone) for dashboard queries and charts
// Previously read a browser cookie, which made the dashboard disagree with KUN
// whenever the viewer's device was in another zone

import { getSession } from "@/lib/auth";
import { getOrgTimezone } from "@/lib/db/queries/org-timezone";
import { DEFAULT_TIMEZONE } from "@/helpers/format";

export async function getOwnerTimezone(): Promise<string> {
  try {
    // orgId comes from the server session, never from the client
    const session = await getSession();
    if (!session) return DEFAULT_TIMEZONE;
    return await getOrgTimezone(session.orgId);
  } catch (err) {
    // A failed lookup must never take the dashboard down — fall back and log
    console.error("[getOwnerTimezone] Failed, using default:", err);
    return DEFAULT_TIMEZONE;
  }
}
