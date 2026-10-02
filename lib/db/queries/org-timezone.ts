// Reads the two org fields the dashboard layout needs for timezone auto-detect
// Separate tiny file so the layout never pulls a whole org row

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";

export async function getTimezoneDetectionState(
  orgId: string,
): Promise<{ timezone: string; timezoneDetectedAt: Date | null } | null> {
  // Scoped by org id — the only row this layout may read
  const [row] = await db
    .select({
      timezone: orgs.timezone,
      timezoneDetectedAt: orgs.timezoneDetectedAt,
    })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return row ?? null;
}
