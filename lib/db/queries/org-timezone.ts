// Reads the org's timezone fields — used by the dashboard layout (Topbar + auto-detect)
// and by getOwnerTimezone() for every time-grouped dashboard query

import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/helpers/format";

// React cache() = one DB read per request, even when the layout and the page both ask
export const getTimezoneDetectionState = cache(
  async (
    orgId: string,
  ): Promise<{ timezone: string; timezoneDetectedAt: Date | null } | null> => {
    // Scoped by org id — the only row this may read
    const [row] = await db
      .select({
        timezone: orgs.timezone,
        timezoneDetectedAt: orgs.timezoneDetectedAt,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    return row ?? null;
  },
);

// The org's timezone, guaranteed usable — a bad value typed into Neon falls back to the default
export async function getOrgTimezone(orgId: string): Promise<string> {
  const state = await getTimezoneDetectionState(orgId);
  return state && isValidTimeZone(state.timezone)
    ? state.timezone
    : DEFAULT_TIMEZONE;
}
