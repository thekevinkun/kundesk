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

  // TEMPORARY checking
  // console.log("[DEBUG auth()] orgRole:", orgRole);

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

// Guards any Server Action or Route Handler that requires org:admin specifically.
// Built on the same auth() call as requireOrg() — orgRole comes directly from
// the Clerk session token, no extra API round-trip needed (unlike team.ts's
// pattern of re-fetching membership from Clerk on every call, which is
// necessary there because those actions mutate membership itself).
// Phase 16 decision: org:member is conversations-only — billing, settings,
// chatbot config, documents, and team management all require org:admin.
export async function requireOrgAdmin(): Promise<OrgSession> {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) throw new Error("Unauthenticated");
  if (!orgId) throw new Error("No active organization");
  if (orgRole !== "org:admin") {
    throw new Error("Hanya admin yang dapat melakukan tindakan ini.");
  }

  return { userId, orgId };
}
