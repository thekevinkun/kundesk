// proxy.ts — Next.js 16 replacement for middleware.ts
// Controls which routes require authentication
// Clerk reads this to protect dashboard routes and allow public routes through

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Dashboard routes — require userId + orgId (active organization)
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);

// Public chat routes — customers don't have accounts
const isChatRoute = createRouteMatcher(["/chat(.*)"]);

// Webhook routes — skip Clerk auth, they have signature verification instead
const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Webhooks bypass Clerk entirely — verified by signature in route handler
  if (isWebhookRoute(request)) return;

  // Chat routes are fully public — no auth required
  if (isChatRoute(request)) return;

  // Dashboard routes require authentication + an active organization
  if (isDashboardRoute(request)) {
    const { userId, orgId } = await auth();

    // Not signed in — redirect to sign-in
    if (!userId) {
      await auth.protect();
      return;
    }

    // Signed in but no active org — redirect to org selection
    if (!orgId) {
      return Response.redirect(new URL("/select-organization", request.url));
    }
  }

  // All other routes — no special handling needed
  return;
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
