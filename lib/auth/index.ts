// Auth helpers — used at the top of every Server Action and Route Handler
// requireOrg() is the single guard that enforces authentication + org membership
// orgId always comes from the server session — never from client request body

import { auth } from "@clerk/nextjs/server";

// Returned by requireOrg() — typed so callers get autocomplete
export interface OrgSession {
  userId: string;
  orgId: string;
}

// Guards any Server Action or Route Handler that requires an active org
// Throws with a clear message — caller wraps in try/catch and returns ActionResult
export async function requireOrg(): Promise<OrgSession> {
  const { userId, orgId } = await auth();

  // Not signed in at all
  if (!userId) throw new Error("Unauthenticated");

  // Signed in but no active organization selected
  if (!orgId) throw new Error("No active organization");

  return { userId, orgId };
}

// Returns session without throwing — use for optional auth checks
export async function getSession(): Promise<OrgSession | null> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;
  return { userId, orgId };
}
