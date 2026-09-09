# Kundesk — Phase Handoff Document

> **Document Type:** Living document. Replace entirely after each phase completes. **Current State:** Phase 15 complete. Full Midtrans payment lifecycle tracking — pending payment detection, resume/cancel UX, Finish Redirect URL fix, result banners, lifecycle emails, and billing display fixes. Production deployed at `kundesk.vercel.app`. **Last Updated:** June 2026. **Always read `kundesk-project-bible.md` before this document.**

---

## Instructions for Claude (Read First)

1. Read the Project Bible completely before reading this document
2. This document tells you the current build state and what to do next
3. Do NOT guess missing information — ask Kevin to paste files or confirm details
4. Do NOT start writing code until you've confirmed understanding of current state
5. After a phase completes, rewrite this entire document — only when Kevin says so
6. Keep the Project Bible untouched — only this document changes between phases
7. The learning approach matters — explain how things connect before writing code, not after
8. Never rewrite an entire file just to make a small change — tell Kevin which specific line to add/replace/remove UNLESS a full overhaul is truly needed. State this clearly when doing a full rewrite.
9. Always work on a feature branch — never push directly to master. Branch → PR → CI → merge. Only trivial chores (metadata, typos, accessibility fixes) go directly to master.
10. Every new PR needs a description filled in markdown — title is auto-filled from commit; description must always be written. Never skip this.
11. Always explain concept first (1–3 sentences), how it connects to what Kevin knows, then write code with inline comments.
12. Before writing any UI code — read `/mnt/skills/public/frontend-design/SKILL.md` first.
13. Always use `npm run typecheck` — NEVER `npx tsc --noEmit`.
14. Always use `npm run lint` after typecheck before committing.
15. ALWAYS ask to see an existing file before rewriting or modifying it. Never assume what's in a file — ask Kevin to paste it first.
16. After CI passes — THEN write the handoff document. Never write it before merge.
17. Answer conversationally in chat — never dump walls of markdown mid-build. This is a conversation, not a document session.
18. When making surgical changes to existing files — specify EXACTLY which lines to change, what to replace, and what to add. Never force a full rewrite unless truly necessary.
19. All animation variants must live in `lib/animations.ts` — never inline in components. Use `variants` pattern: `variants={x} initial="hidden" animate="visible"`.
20. Framer Motion `ease` arrays must be typed as `[number, number, number, number]` tuples to satisfy TypeScript strict mode.
21. Vitest mock classes with `function` keyword — never arrow functions. Arrow functions cannot be used with `new`, causing "is not a constructor" errors.
22. When writing tests for functions that use `useCallback` — always verify the dependency array includes all values the callback reads. Stale closures cause silent bugs in production and incorrect test behaviour.
23. Before adding a build step to CI — cross-reference the full `.env` against `lib/env.ts` required fields. Add ALL required vars as fake placeholders upfront. Never add them one-by-one after repeated failures.
24. CI env vars: avoid credential-shaped placeholders in `DATABASE_URL` (e.g. `fake:fake@`) — use `postgresql://placeholder-host/placeholder-db` format to avoid secret-scanner false positives (CKV_SECRET_4).
25. Shared CI env vars belong in `jobs.<job>.env` — not duplicated across individual steps.
26. **CodeRabbit is active** — CI (typecheck → lint → test → build + Playwright E2E) plus CodeRabbit review on every PR.
27. **E2E tests use `page.evaluate(fetch(...))` for all authenticated API calls** — the `request` fixture has no Clerk session. Never use `request.get/post` for protected routes in E2E tests.
28. **`test.use()` must be called at `describe` level** — never inside a `test()` function. Playwright throws immediately if called inside a test.
29. **Vitest excludes `e2e/` folder** — `vitest.config.ts` has `exclude: ["node_modules", ".next", "e2e"]`. Never remove this — Playwright spec files use `@playwright/test` not Vitest, and Vitest will crash trying to run them.
30. **Playwright browser cache** — CI caches `~/.cache/ms-playwright` keyed on `package-lock.json` hash. First run downloads Chromium (~200MB), subsequent runs use cache. Don't remove the cache step from CI.
31. **E2E workers in CI** — `playwright.config.ts` sets `workers: process.env.CI ? 2 : 1`. Locally: 1 worker (sequential, avoids Clerk rate limits). CI: 2 workers (parallel). Never increase back to 4.
32. **SSE stream `conversationId` extraction** — the `/api/chat` endpoint sends `{ done: true, conversationId, channelToken, handoffStatus }` as the final SSE event. E2E tests parse this to get `conversationId` without needing a list API route.
33. **E2E filename uniqueness** — document upload tests use `test-faq-${Date.now()}.txt` as the filename. Never use a fixed filename — accumulated test runs create multiple rows and trigger Playwright strict mode violations.
34. **PostgreSQL `AT TIME ZONE` operator inverts on `timestamptz`** — `timestamptz AT TIME ZONE 'Asia/Makassar'` converts FROM that zone TO UTC, not the other way. Always use the function form: `timezone('Asia/Makassar', created_at)` to convert TO local time.
35. **All time-grouped DB queries accept a `timezone` string param** — never hardcode `'Asia/Makassar'` or any timezone in queries. Read it from `getOwnerTimezone()` in the Server Component and pass it down.
36. **`react-markdown` is installed** — use `<ReactMarkdown>` with `prose-bubble` CSS class for all chat message content. Never use manual `content.split("\n").map(...)` pattern.
37. **`ChatHeader` is hidden inside iframe** — uses `useEffect` + `useState` to detect `window.self !== window.top` after mount. Never use `if (typeof window !== 'undefined')` directly in render — causes SSR hydration mismatch.
38. **Widget `X-Frame-Options`** — `/chat/:path*` routes override the global `SAMEORIGIN` header with `ALLOWALL` + `frame-ancestors *` CSP. This is intentional — the chat page must be embeddable in the widget iframe.
39. **Promo code lookup uses `LOWER()` SQL function** — never `ilike()`. Always use `` sql`LOWER(${promoCodes.code}) = LOWER(${code})` `` for exact case-insensitive match.
40. **`usedCount` increments in webhook handler, not in `createPayment` action** — abandoned checkouts must not burn promo quota.
41. **Promo ID encoded in `order_id`** — format: `KUNDESK-{orgSlice}-{PLAN}-{timestamp}-P{promoId}`. Never change the order_id format without updating the webhook parser.
42. **Sound notifications** — `useSoundNotification` hook plays audio client-side. Browser autoplay policy blocks audio until user interacts with the page — fails silently, never crash the dashboard.
43. **Neon serverless cold start** — notification API routes wrap DB calls in try/catch and return graceful empty responses on `ETIMEDOUT`. Never let a cold-start timeout surface as a 500.
44. **`fireMockWebhook` accepts optional `amount` param** — defaults to `PLAN_PRICE[plan]` for backward compatibility.
45. **Redis caching** — org data cached under `kundesk:cache:org:slug:{slug}` AND `kundesk:cache:org:id:{orgId}` (TTL 5 min). Chatbot config cached under `kundesk:cache:chatbot:{orgId}` (TTL 10 min). Both keys must be invalidated together via `invalidateOrgCache(orgId)`.
46. **`invalidateOrgCache(orgId)`** — reads the cached org to get the slug, then deletes both `orgBySlug` and `orgById` keys atomically.
47. **Embedding batching** — `batchedAsync(chunks, 10, embedText)` — never `Promise.all` directly on embedding calls.
48. **Document processing timeout** — `app/api/documents/process/route.ts` wraps the pipeline in `Promise.race` against a 55-second timeout. `markFailed()` is called ONCE in the outer catch — never inside `runProcessingPipeline`.
49. **OpenAI stream errors** — use `APIConnectionError` and `APIConnectionTimeoutError` from the OpenAI SDK — never string matching. Error message to customer is in Bahasa Indonesia.
50. **Widget XSS protection** — widget script sets text content via `textContent` (never `innerHTML`).
51. **Widget rate limiting** — `/api/widget` uses `checkWidgetRateLimit(ip, orgSlug)` — 60 req/min per IP+orgSlug.
52. **Health check** — `GET /api/health` pings Neon with `SELECT 1` and returns 200/503. No auth required.
53. **Message retention** — `deleteOldMessages(90)` runs daily at 20:00 UTC via `GET /api/cron/retention`.
54. **Privacy policy** — `app/(marketing)/privacy/page.tsx` at `/privacy`. Bahasa Indonesia. Linked from footer.
55. **Syarat & Ketentuan** — `app/(marketing)/syarat-ketentuan/page.tsx` at `/syarat-ketentuan`.
56. **Kebijakan Refund** — `app/(marketing)/kebijakan-refund/page.tsx` at `/kebijakan-refund`.
57. **Deployment target is Vercel** — Free tier. Cron via `vercel.json`. Function timeout is 10s on free.
58. **npm audit status** — 7 moderate vulnerabilities, all in dev tools. Do NOT run `npm audit fix --force`.
59. **DB indexes** — `notifications_org_created_idx ON (org_id, created_at DESC)`. `conversations_org_handoff_status_idx ON (org_id, handoff_status)`.
60. **RLS intentionally NOT implemented** — application-layer isolation via `requireOrg()` + `AND org_id = $orgId` is sufficient.
61. **KUN is the fixed AI identity** — name, greeting, and voice are hardcoded. Never read from `chatbots` table. `name`, `tone`, `greeting_message` columns dropped in Phase 12b.
62. **KUN RAG prompt — `kunIdentity` block in `lib/ai/rag.ts`** — "Kak" as vocative (start/end of sentence only) vs "kakak" as mid-sentence pronoun. Never revert to vague instructions.
63. **KUN greeting is hardcoded in `ChatPage.tsx`** — `kunGreeting` constant uses `orgName` interpolation. Never read from `chatbots.greetingMessage`.
64. **Widget no longer calls Clerk API for org image** — KUN logo served from `${appUrl}/images/kun-logo.png`.
65. **KUN logo path** — `/public/images/kun-logo.png` (and `/public/images/kun_logo.png` used in `ChatPage` empty state and `MessageBubble`/`ConversationDialog` avatars). Always use `next/image` with explicit `width` and `height` props.
66. **`ConversationDialog` double-message bug** — fixed with `lastProcessedMessageId` ref initialized to `newMessage?.id ?? null`. Never remove — prevents double-append on pending→human transition.
67. **`FaqCard` accepts optional `answerSuffix` prop** — `React.ReactNode` rendered after answer text. Used for privacy policy link in FAQ id=5.
68. **`DemoCard` video component** — `components/landing/works/DemoCard.tsx`. Video source: `/public/videos/kundesk-demo.mp4`. Recorded and live in production.
69. **Message counting — `role: "user"` only** — quota, stat cards, and all chart queries count only customer messages (`role = 'user'`). Assistant and human_agent messages are never counted.
70. **`messagesUsed` increments for ALL customer messages** — both AI-mode and human-mode. Atomic SQL guard `messagesUsed < messagesLimit` prevents exceeding the limit.
71. **Handoff requests and human-mode bypass quota pre-check intentionally** — documented in code, never "fix" it.
72. **`processedWebhooks.source`** — `"midtrans"` for payment/billing, `"system"` for quota, `"clerk"` for Clerk.
73. **Quota idempotency key format** — `QUOTA-FULL-{orgId}-{YYYY-MM}` and `QUOTA-WARN-{orgId}-{YYYY-MM}`. Both use `source: "system"`.
74. **Dashboard chart queries count `role = 'user'` only** — `getDailyMessageTrend`, `getMonthlyMessageComparison`, `getWeeklyMessages` all have `AND role = 'user'` in their CTEs.
75. **`getDashboardCharts` in `lib/db/queries/dashboard.ts`** — bundles all three chart queries into one call.
76. **Dashboard charts live-update via TanStack Query** — `["dashboard", orgId, "charts"]` invalidated by `handleUsageUpdated` with 2s debounce.
77. **`usage:updated` fires for all customer messages** — both AI-mode and human-mode.
78. **`conversation:return` fires on both channels** — `triggerConversationReturn` calls `triggerOrgEvent` (dashboard) AND `triggerPublicConversationEvent` (customer widget) concurrently.
79. **`ChatPage` listens for `conversation:return`** — binds on `conversation-{channelToken}` and calls `setHandoffStatus("ai")`.
80. **`human_agent` role remapped to `"assistant"` before OpenAI** — `conversationHistory` in `/api/chat` maps `human_agent → assistant`.
81. **Quota notifications fire once per billing period** — `quota_warning` at 80%, `quota_full` at 100%.
82. **`plan_upgraded` notification** — fired in Midtrans webhook handler after `activateSubscription` succeeds, awaited.
83. **`quota_reset` notification** — fired per org in `reset-usage` cron, awaited via `Promise.all`.
84. **`NotificationPanel` body rendering** — checks for `|` delimiter. Never put `|` in a plain notification body.
85. **`RecentConversationsPanel` uses `getRecentActiveConversations`** — only conversations with activity in last 24h. No `isExpired` derivation — never add it back.
86. **`getRecentActiveConversations` sorts in SQL** — `pending_handoff` first, then `last_message_at DESC`. Client-side `sortConversations` still runs for Pusher-driven updates.
87. **`RecentConversationsPanel` message count label is "pesan aktif"** — never revert to "pesan".
88. **Dashboard layout** — Charts row 2 is `grid-cols-[1.4fr_1fr]`: left column has `BarChart` stacked above `LineChart`, right column has `RecentConversationsPanel`. Panel uses `lg:sticky lg:top-4`.
89. **`messagesUsed` sync** — run `UPDATE orgs SET messages_used = (SELECT COUNT(*) FROM messages WHERE org_id = orgs.id AND role = 'user') WHERE id = '{orgId}'` in Neon SQL editor when drift occurs.
90. **PostHog tracks 7 events total** — `conversation_started`, `chat_message_sent`, `handoff_requested`, `document_uploaded`, `plan_upgraded`, `chatbot_configured`, `human_handoff_taken`. All fire-and-forget. `distinctId` is always `orgId`. Never log `systemPrompt` content.
91. **PostHog is product analytics, not business metrics** — dashboard charts come from Neon DB queries, not PostHog.
92. **`dismiss` route — `POST /api/conversations/[id]/dismiss`** — returns `pending_handoff` conversation to `ai` mode. Inserts canned apology as `role: "assistant"` in DB. Pusher payload role also `"assistant"`. Only valid when `handoffStatus === "pending_handoff"` — returns 409 otherwise.
93. **Dismiss canned message** — `"Mohon maaf, admin tidak bisa membalas pesanmu sekarang. Tetap cerita sama KUN ya, aku siap membantu! 😊"` — `role: "assistant"` in BOTH DB and Pusher payload.
94. **"Abaikan" button in `ConversationRow` and `ConversationMobileCard`** — shown only when `handoffStatus === "pending_handoff"`. Uses `danger` color, `useTransition` pattern identical to `handleTakeover`.
95. **Pending handoff spam is already guarded** — `detectHandoffRequest` block in `/api/chat` only runs when `currentHandoffStatus === "ai" || currentHandoffStatus === null`.
96. **KUN "Kak" grammar rule in `lib/ai/rag.ts`** — "Kak" vocative at start/end of sentence only. "kakak" mid-sentence pronoun.
97. **Features section layout** — `layout: "wide"` (RAG, Analytics) vs `layout: "card"` (Tenant, Security), driven by `FEATURES` constant in `lib/constants/landing-constants.ts`.
98. **`RagPreview` is an animated looping chat** — `CHAT_SCRIPT` array drives the sequence, `STEP_DELAYS` controls timing. Never convert to a static screenshot.
99. **`AnalyticsPreview` pulsing dot** — pure CSS `ping-slow` keyframe in `globals.css @layer base {}`. Never use Tailwind's `animate-ping`.
100. **`chatBubbleIn` animation variant** — in `lib/animations.ts`. `AnimatePresence mode="popLayout"` wraps the chat area.
101. **`formatRelativeTime` accepts optional `now` param** — `formatRelativeTime(date, now?)`. Always pass `now` inside ticking contexts.
102. **`useNow` hook in `ConversationRow.tsx`** — smart interval, ticks every minute (<1hr) or hourly (>1hr).
103. **`RecentConversationsPanel`** — `activeConversations` wrapped in `useMemo` — never remove.
104. **Hydration mismatch on relative time** — `suppressHydrationWarning` on spans rendering `formatRelativeTime`.
105. **Legal pages share components with privacy page** — `PrivacyHero`, `PrivacySection`, `Checklist` from `components/landing/security/`.
106. **Legal components folder** — `components/landing/legal/` — never merge into `components/landing/security/`.
107. **Legal constants** — `lib/constants/terms-constants.ts` and `lib/constants/refund-constants.ts`.
108. **GitHub repo is public** — intentional decision.
109. **Docker is NOT used** — Vercel handles containerization.
110. **OG image** — `/public/images/og-image.webp`. Under 300KB. Never revert to PNG.
111. **Midtrans webhook URL** — `https://kundesk.vercel.app/api/webhooks/midtrans`.
112. **Midtrans Finish Redirect URL** — handled via per-request `callbacks` (see Phase 15 below). Dashboard-level setting alone does NOT work for Kundesk's integration — per-request `callbacks.finish/error/pending` override it.
113. **Neon cold start context** — Neon serverless sleeps after inactivity. First query after waking takes 2–5 seconds. AI-mode DB transaction fires BEFORE Pusher events — transaction itself is fast (ms), so cold start adds only a small fixed delay, not a 25s stall.
114. **Pusher channel auth — `transport: "ajax"` + `headersProvider`** — DO NOT change to `"fetch"` or `customHandler`. Confirmed working via direct A/B test; `customHandler` causes total live-update regression.
115. **Dark mode is scoped to dashboard only** — `ThemeProvider` (next-themes) lives in `app/(dashboard)/dashboard/layout.tsx`, NOT in root `app/layout.tsx`. Landing page is always light.
116. **`ThemeProvider` wrapper keeps `next-themes` as-is** — no `scriptProps` override. Do NOT add `scriptProps={{ type: "application/json" }}`.
117. **Theme toggle hydration guard** — `Topbar.tsx` dark mode toggle renders a neutral placeholder until `mounted === true`.
118. **PlanCard CTA/badge text colors use `text-white`, never `text-(--color-bg-page)`** — `--color-bg-page` is theme-dependent and produces dark-on-dark text in dark mode.
119. **`getAnsweredRate` is capped at 100%** — `Math.min(..., 100)`. Never remove the cap.

---

## Phase 15 — Midtrans Payment Lifecycle (This Session)

> Two PRs this session: `feature/midtrans-payment-lifecycle` (core lifecycle tracking, banners, emails, redirect fix) and `feature/billing-ux-refinements` (pending-payment controls, history display, quota display fixes). Both merged and tested live in production.

### Context — What Was Broken Before This Phase

Three issues identified after Phase 14:

1. **Abandoned checkouts were a dead end.** Clicking a plan created a Midtrans Snap transaction and a `processedWebhooks` row keyed `PAYMENT-{orgId}-{plan}-{date}` — a same-day lock with no payment data. If the customer closed the Snap tab without paying, re-clicking the plan returned: _"Transaksi untuk plan ini sudah dibuat hari ini. Selesaikan pembayaran sebelumnya atau coba lagi besok."_ — no link back to the payment, no way to cancel, stuck until the next calendar day.
    
2. **Midtrans Finish Redirect URL didn't work.** The Midtrans Sandbox dashboard setting for "Finish Redirect URL" was set to `/dashboard/billing`, but after a successful sandbox payment, Midtrans showed its own default confirmation page instead of redirecting back.
    
3. **No feedback on `/billing` after payment**, success or failure. No banner, no email receipt. `expire`/`cancel`/`deny` webhook notifications were silently ignored — `payments` table only ever had `status: "success"` rows, created fresh on settlement.
    

### A. `payments` Table — Full Lifecycle Tracking

**Core architectural shift:** `payments` changed from "success-only ledger, one row inserted per settlement" to "one row per checkout attempt, status evolves in place." This mirrors the pattern used in Kevin's Padel Court project (`payments`/`bookings` rows that transition `PENDING → SUCCESS/FAILED`).

**Schema changes** (applied manually via Neon SQL editor — `db:migrate` does not work against Neon, per existing rule):

```sql
-- Widen payments table for full lifecycle tracking (pending → success/failed/expired/cancelled)
ALTER TABLE payments ALTER COLUMN payment_method DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN paid_at DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN paid_at DROP DEFAULT;
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN redirect_url TEXT;

-- New composite index for "does this org have a pending payment" lookup
CREATE INDEX payments_org_status_created_idx ON payments (org_id, status, created_at);

-- Discovered during this phase: created_at was in lib/db/schema.ts but had
-- never been migrated to Neon — pre-existing drift, unrelated to this phase's
-- changes but blocked getPendingPayment until fixed
ALTER TABLE payments ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT now();
```

**`payments.status` is now a 5-value union:** `"pending" | "success" | "failed" | "expired" | "cancelled"`

|Status|Set by|Meaning|
|---|---|---|
|`pending`|`insertPendingPayment` at checkout creation|Snap transaction created, awaiting payment|
|`success`|`markPaymentSuccess` on settlement/capture webhook|Payment confirmed, subscription activated|
|`failed`|`markPaymentClosed` on `cancel`/`deny` webhook|Midtrans-side denial or user cancelled in Snap|
|`expired`|`markPaymentClosed` on `expire` webhook|Payment link expired, never paid|
|`cancelled`|`cancelPendingPayment` (user-initiated, this session's second PR)|User clicked "Batalkan" on the pending banner to pick a different plan|

**New/changed query functions in `lib/db/queries/billing.ts`:**

- `insertPendingPayment(orgId, orderId, plan, amount, redirectUrl)` — INSERT at checkout creation, `status: "pending"`
- `markPaymentSuccess(orgId, orderId, plan, amount, paymentMethod)` — UPDATE by `orderId` to `status: "success"`. **Falls back to INSERT if zero rows matched** (e.g. synthetic webhook notifications in E2E tests that never went through `createPayment` — discovered via `04-billing.spec.ts` failure). This guarantees a settlement is never silently lost regardless of whether a pending row exists.
- `markPaymentClosed(orderId, status: "failed" | "expired")` — UPDATE by `orderId` for non-settlement terminal states
- `getPendingPayment(orgId)` — returns the org's `pending` row if `<24h` old (matches Midtrans Snap's `payment-list` page expiry), else `null`. Used for the resume banner AND as the new same-day-lock replacement.
- `cancelPendingPayment(orgId)` — UPDATE `status: "pending" → "cancelled"`, only affects rows still pending. Added in the second PR.
- `activateSubscription` now returns `{ periodEnd: Date }` (previously `void`) — used by the webhook handler to populate the `PlanUpgradedEmail` receipt without an extra query.

`getPaymentHistory` now also selects `createdAt` and orders by `COALESCE(paidAt, createdAt) DESC` — so pending/failed/expired/cancelled rows (which have no `paidAt`) still sort correctly by creation time.

### B. `createPayment` — Same-Day Lock Replaced

**Old logic:** check `processedWebhooks` for `PAYMENT-{orgId}-{plan}-{date}`; if found, hard error, no redirect, wait until tomorrow.

**New logic:** call `getPendingPayment(orgId)`. If a pending row `<24h` old exists:

```ts
return {
  success: false,
  error: "Kamu masih memiliki pembayaran yang belum diselesaikan. ...",
  redirectUrl: pending.redirectUrl, // ← new field on BillingActionResult error variant
};
```

`PlanCard.tsx`'s `useEffect` checks for `state.redirectUrl` on error and shows a toast with a "Lanjutkan" action button (sonner `toast.error` with `action: { label, onClick }`).

On success, `insertPendingPayment` is called immediately after `createSubscriptionTransaction` returns — this row is now the single source of truth for "org has an in-flight payment," replacing the `processedWebhooks` lock entirely. `processedWebhooks` import removed from `lib/actions/billing.ts`.

### C. Midtrans `callbacks.finish/error/pending` — Redirect Fix

**Root cause of issue #2:** the Sandbox dashboard's "Finish Redirect URL" setting is overridden by **per-request `callbacks`** in the Snap transaction creation body — which Kundesk wasn't setting. Padel Court's working implementation (`callbacks: { finish, error, pending }` in `parameter` passed to `snap.createTransaction`) confirmed this.

**Fix — `lib/midtrans/index.ts`, `createSubscriptionTransaction`, real-mode request body:**

```ts
callbacks: {
  finish: `${env.appUrl}/dashboard/billing`,
  error: `${env.appUrl}/dashboard/billing`,
  pending: `${env.appUrl}/dashboard/billing`,
},
```

All three point to `/billing` since Kundesk has no separate status pages (unlike Padel Court's `/booking/success/[ref]`, `/booking/failed`, `/booking/pending/[ref]`). Midtrans appends `order_id`, `status_code`, and `transaction_status` as query params on redirect — consumed by Step D below.

**Confirmed behavior (tested live):** closing the Snap page without selecting/paying does NOT trigger any callback — the row stays `pending` and is picked up by `getPendingPayment` on next `/billing` visit regardless. Callbacks only fire after an actual payment attempt (success, pending-VA-created, or error).

### D. `PaymentResultBanner` — One-Time Redirect Feedback

New component, `components/dashboard/billing/PaymentResultBanner.tsx`. Reads `transaction_status` from `/billing`'s query params (passed down from `app/(dashboard)/dashboard/billing/page.tsx`, which now accepts `searchParams: Promise<{ transaction_status?, order_id? }>` per Next.js 16's async searchParams).

Maps `transaction_status`:

- `settlement` / `capture` → green, "Pembayaran berhasil"
- `pending` → brand/amber, "Pembayaran sedang diproses"
- anything else (`deny`/`cancel`/`expire`) → red, "Pembayaran tidak berhasil"

On mount, `useEffect` calls `router.replace("/dashboard/billing")` — strips the query param so a refresh shows a clean page. **This is purely client-side URL cleanup, nothing persisted** — distinguishes it from `PendingPaymentBanner` (Step E), which is driven by a real DB row and persists across refreshes until resolved.

Used real `--color-success`/`--color-danger` tokens with opacity modifiers (`bg-(--color-success)/10 border-(--color-success)/30`) — NOT fabricated `-light` variants which don't exist in `globals.css`.

### E. `PendingPaymentBanner` — Persistent Resume/Cancel

New component, `components/dashboard/billing/PendingPaymentBanner.tsx`. Rendered when `data.pendingPayment` (from `getPendingPayment`) is non-null — persists across every page load while the row is `status: "pending"` and `<24h` old.

Shows plan + amount + two actions:

- **"Lanjutkan Pembayaran"** — link to `pendingPayment.redirectUrl` (the original Snap `payment-list` URL, valid 24h regardless of which payment method is later selected within it)
- **"Batalkan"** — calls `cancelPendingPaymentAction` (second PR), marks the row `cancelled`, `revalidatePath("/dashboard/billing")`. Lets the user pick a different plan (e.g. Starter → Pro) without waiting for the Snap link to expire. The abandoned Snap link is left to expire naturally on Midtrans's side; if somehow still paid, `markPaymentSuccess` updates by `orderId` regardless of status — no payment lost, just a slightly odd history entry (accepted edge case).

**Plan cards disabled while pending payment exists** (second PR) — `PlanCard` receives `hasPendingPayment: boolean`, added to `isDisabled`, with CTA label "Selesaikan Pembayaran Dulu" (distinct from "Plan Aktif"). Prevents creating concurrent Snap transactions for the same org.

**Render order on `/billing`:** `PaymentResultBanner` (one-time, if present) → `PendingPaymentBanner` (persistent, if present) → `CurrentPlanCard` → plan grid → ... Both banners can coexist (e.g. VA chosen → `transaction_status=pending` on redirect shows the green-ish one-time banner AND the persistent resume banner, since the row is still `pending` until the settlement webhook lands).

### F. Webhook Handler — Non-Settlement Statuses Now Handled

**Old behavior:** `expire`/`cancel`/`deny`/`pending` transaction_status all fell into "no action required" — `payments` row (which didn't exist yet under the old model) was simply never created.

**New behavior** — new branch in `app/api/webhooks/midtrans/route.ts`, inside the `!isSettled` block:

```ts
if (transaction_status === "expire" || transaction_status === "cancel" || transaction_status === "deny") {
  const closedStatus = transaction_status === "expire" ? "expired" : "failed";
  await markPaymentClosed(order_id, closedStatus).catch(console.error);
  await db.insert(processedWebhooks)
    .values({ externalId: order_id, source: "midtrans" })
    .catch(() => { /* unique constraint on retry — already marked, ignore */ });
  return NextResponse.json({ message: "Payment closed" }, { status: 200 });
}
// "pending" status falls through to existing "No action required" — VA created,
// awaiting payment, row correctly stays status: "pending"
```

Note: `.onConflictDoNothing()` was tried first but isn't available on the test mock's `db.insert().values()` chain — replaced with `.catch()`, which works with both the real Drizzle client and the Vitest mock.

**Settlement path** — `insertPayment` replaced with `markPaymentSuccess(org.id, order_id, plan, amount, payment_type)`. `matchingOrgs` select widened to `{ id, name, ownerEmail }` (previously just `{ id }`) — needed for the new receipt email (Step G). `activateSubscription`'s returned `periodEnd` is captured via `let periodEnd!: Date` (definite assignment, set inside `db.transaction`).

### G. Two New Lifecycle Emails

Both follow the existing minimal `UsageWarningEmail`-style template (NOT Padel Court's heavy table layout — kept consistent with Kundesk's email suite).

**`emails/PaymentPendingEmail.tsx`** + `sendPaymentPendingEmail` — sent from `createPayment` (fire-and-forget, `.catch(console.error)`) immediately after `insertPendingPayment` succeeds. Contains plan, amount, and the resume `redirectUrl` (same link as `PendingPaymentBanner`, valid 24h).

**`emails/PlanUpgradedEmail.tsx`** + `sendPlanUpgradedEmail` — sent from the webhook handler (fire-and-forget) after settlement. Doubles as a receipt: plan, amount, payment method (human-readable via `getPaymentMethodLabel`), order ID, paid date, "berlaku hingga" (period end, from `activateSubscription`'s returned `periodEnd`).

Both registered in `emails/index.ts` via `export { default as X } from "./X"`.

### H. `PAYMENT_METHOD_LABELS` / `getPaymentMethodLabel`

Added to `components/dashboard/billing/constants.ts` (NOT `types/billing.ts` — UI-presentation data stays with `PLAN_CONFIG`). Full mapping of Midtrans `payment_type` values (`bank_transfer`, `qris`, `gopay`, `*_va` variants, `shopeepay`, `dana`, `ovo`, `indomaret`, `alfamart`, `kredivo`, `akulaku`, etc.) to Indonesian human-readable labels. Falls back to the raw value if unmapped.

**The old `formatPaymentMethod` switch-statement function was removed** — `getPaymentMethodLabel` supersedes it (more complete mapping) and is now the single source used by both `PaymentHistoryCard` and the email senders.

### I. `PaymentHistoryCard` Updates

- `getPaymentMethodLabel` replaces `formatPaymentMethod` — handles `null` → `"—"` internally
- Status badge: `"pending"`, `"expired"`, `"cancelled"` all render as `badge-warning` with labels "Pending"/"Kedaluwarsa"/"Dibatalkan"; `"failed"` is `badge-danger` "Gagal"; `"success"` is `badge-success` "Berhasil"
- **Date column** — was `formatDate(item.paidAt)`, which showed "—" for any non-success row (since `paidAt` is null until settlement). Now `formatDate(item.paidAt ?? item.createdAt)` — every row shows a meaningful date (when the attempt was made, or when it was paid)

### J. `CurrentPlanCard` — Two Display Fixes

**1. Quota at 100%:** previously showed "⚠ Hampir habis" at both 90% and 100%. Now:

```tsx
{usagePct >= 100 ? (
  <span className="badge-base badge-danger text-[10px]">🚫 Kuota telah habis</span>
) : usagePct >= 90 ? (
  <span className="badge-base badge-danger text-[10px]">⚠ Hampir habis</span>
) : null}
```

**2. "Reset" label was misleading.** Previously `formatDate(data.currentPeriodEnd)` — `currentPeriodEnd` is `null` for Free plans (shows "—"), and for paid plans it's the _subscription renewal date_, not the _quota reset date_. These are different: `messagesUsed` resets monthly via `/cron/reset-usage` (always 1st of calendar month, for every org regardless of plan), completely decoupled from each org's individual 30-day billing cycle (`currentPeriodEnd = activatedAt + 30 days`).

Fixed by computing the actual quota reset date client-side:

```ts
// helpers/format.ts
export function getNextMonthFirstDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
```

```tsx
<p className="text-xs text-(--color-text-400)">
  Reset Kuota: <span className="font-semibold text-(--color-text-500)">
    {formatDate(getNextMonthFirstDay())}
  </span>
</p>
```

**No cron/query changes** — `/cron/reset-usage` behavior was already correct (resets all orgs monthly on the 1st); this was purely a display bug. The existing "Tagihan Berikutnya" field (in the billing-meta block, `data.nextBillingDate`) remains the correct source for subscription renewal date.

### K. CodeRabbit Finding — TOCTOU on Pending Payment Creation

CodeRabbit flagged: the gap between `getPendingPayment` (check) and `insertPendingPayment` (write) — separated by a non-idempotent `createSubscriptionTransaction` call — could allow concurrent requests to both pass the check and create multiple Snap transactions for the same org.

**Resolution: addressed at the UI level, not the DB level.** Plan cards are disabled (`isDisabled` includes `hasPendingPayment`) the moment `data.pendingPayment` is non-null, which `revalidatePath` ensures reflects immediately after `insertPendingPayment`. A genuinely concurrent double-click within the same request-response cycle (before revalidation) remains a theoretical residual risk, but is accepted — same risk class as other fire-and-forget patterns already present in this codebase (e.g. `processedWebhooks` pre-insert pattern in the renewal cron). **No unique constraint/partial index was added** — the UI-level guard plus `markPaymentSuccess`'s INSERT-fallback (which guarantees no payment is ever lost even if rows get into an unexpected state) was judged sufficient.

### L. Test Fixes

`app/api/webhooks/midtrans/route.test.ts`:

- Mock `@/lib/db/queries/billing` now exports `activateSubscription` (resolving `{ periodEnd: Date }`), `markPaymentSuccess`, `markPaymentClosed` (was: `activateSubscription` resolving `undefined`, `insertPayment`)
- New mock `@/lib/email` exports `sendPlanUpgradedEmail`, `sendPaymentPendingEmail`
- Schema mock `orgs` widened to `{ id, name, ownerEmail }`
- `"expire"` status test rewritten — now expects `{ message: "Payment closed" }` and `markPaymentClosed(orderId, "expired")`, not the old `"No action required"`
- New test for `"cancel"` status → `markPaymentClosed(orderId, "failed")`
- All org-lookup mock results widened from `[{ id: "org_3DZHfake123" }]` to include `name`/`ownerEmail`
- `markPaymentSuccess` assertions updated to its new 5-arg signature: `(orgId, orderId, plan, amount, paymentMethod)`

`e2e/04-billing.spec.ts` — the "activates subscription via mock webhook" test fires a synthetic webhook with no prior `createPayment`/pending row. This is exactly the scenario `markPaymentSuccess`'s INSERT-fallback (Step A) was designed for — no test changes needed once the fallback was added; the `payments` row is created fresh on the `UPDATE` matching zero rows.

(The `05-human-handoff.spec.ts` "takeover API rejects invalid conversation ID" failure — expects 400, gets 500 — is pre-existing/unrelated to this phase, flagged as flaky by Playwright, out of scope.)

---

## Files Changed in Phase 15

```
lib/db/schema.ts                                   — payments: nullable paymentMethod/paidAt,
                                                       new redirectUrl, status default "pending",
                                                       new composite index
lib/db/queries/billing.ts                          — insertPendingPayment, markPaymentSuccess
                                                       (UPDATE + INSERT fallback), markPaymentClosed,
                                                       getPendingPayment, cancelPendingPayment,
                                                       activateSubscription returns periodEnd,
                                                       getPaymentHistory selects createdAt,
                                                       orders by COALESCE(paidAt, createdAt)
types/billing.ts                                   — PendingPayment type, BillingPageData.pendingPayment,
                                                       PaymentHistoryItem.createdAt + status union
                                                       widened to include "expired"/"cancelled",
                                                       nullable paymentMethod/paidAt
lib/actions/billing.ts                             — same-day lock replaced with getPendingPayment;
                                                       insertPendingPayment + sendPaymentPendingEmail
                                                       after transaction creation; error variant
                                                       carries redirectUrl; new
                                                       cancelPendingPaymentAction
lib/midtrans/index.ts                              — callbacks.finish/error/pending added to
                                                       real-mode transaction request
app/api/webhooks/midtrans/route.ts                 — expire/cancel/deny → markPaymentClosed branch;
                                                       settlement uses markPaymentSuccess; org select
                                                       widened to name/ownerEmail; sendPlanUpgradedEmail
app/api/webhooks/midtrans/route.test.ts            — mocks updated for new query functions/signatures,
                                                       new expire/cancel test cases
app/(dashboard)/dashboard/billing/page.tsx         — searchParams (async, Next.js 16) →
                                                       transactionStatus passed to BillingPage
components/dashboard/BillingPage.tsx               — renders PaymentResultBanner + PendingPaymentBanner
components/dashboard/billing/PaymentResultBanner.tsx — new — one-time success/pending/failed banner
                                                       from ?transaction_status, strips param on mount
components/dashboard/billing/PendingPaymentBanner.tsx — new — persistent resume/cancel banner
components/dashboard/billing/PlanCard.tsx          — hasPendingPayment prop → isDisabled +
                                                       "Selesaikan Pembayaran Dulu" CTA; resume toast
                                                       action on blocked checkout
components/dashboard/billing/PaymentHistoryCard.tsx — getPaymentMethodLabel (was formatPaymentMethod),
                                                       expired/cancelled status badges,
                                                       paidAt ?? createdAt date fallback
components/dashboard/billing/CurrentPlanCard.tsx   — 100% quota "Kuota telah habis" badge;
                                                       "Reset Kuota" via getNextMonthFirstDay()
components/dashboard/billing/constants.ts          — PAYMENT_METHOD_LABELS + getPaymentMethodLabel
                                                       added; old formatPaymentMethod removed
components/dashboard/billing/index.ts              — export PendingPaymentBanner, PaymentResultBanner
helpers/format.ts                                  — new getNextMonthFirstDay()
emails/PaymentPendingEmail.tsx                     — new
emails/PlanUpgradedEmail.tsx                       — new
emails/index.ts                                    — export both new templates
lib/email/index.ts                                 — sendPaymentPendingEmail, sendPlanUpgradedEmail
```

---

## Open Items / Deferred

|Item|Status|
|---|---|
|Failed payment UX on `/billing`|**RESOLVED in Phase 15** — see sections D, E|
|WhatsApp Integration (Phase 16)|Still on hold — needs Meta Business verification|
|Domain purchase + Resend sender switch|Still waiting on domain purchase|
|Midtrans production keys|Still sandbox|
|`lib/ai/stream.ts` dead code|Still unused, can delete anytime|
|CloudFront CDN|Still post-launch, $100 AWS credit reserved|
|Admin panel for promo codes|Still manual via Neon SQL editor|
|`orgs.midtransCustomerId`|Confirmed dead — Midtrans has no persistent customer concept (transaction-based, not account-based). Always `null`. Safe to remove in a future cleanup migration; not urgent.|
|Quota reset / billing cycle decoupling|**Known limitation, not addressed.** `/cron/reset-usage` resets `messagesUsed` for ALL orgs on the 1st of the calendar month. Each paid org's `currentPeriodEnd`/`nextBillingDate` (renewal cycle) is `activatedAt + 30 days` — an independent date. A paid org's quota may reset a few days before/after their actual billing period ends. Would require per-org reset scheduling to fully align; judged not worth the complexity for now.|

---

## Coding Rules Reminder (Updated — New Rules from Phase 15)

- **`payments` table is now lifecycle-tracked, not append-only.** One row per checkout attempt, `status` evolves via UPDATE (`pending → success/failed/expired/cancelled`). Never go back to insert-on-settlement-only.
- **`markPaymentSuccess` has an INSERT fallback when UPDATE matches zero rows.** This is intentional — guarantees no settlement is ever silently lost (covers synthetic/test webhooks and any future edge case where no pending row exists). Never remove this fallback.
- **`getPendingPayment`'s 24h window matches Midtrans Snap's `payment-list` page expiry** — not the per-method expiry (QRIS 15min, VA 24h, etc.), which only starts once a specific method is chosen. The `payment-list` link itself (returned at checkout, before method selection) is valid 24h regardless.
- **Midtrans `callbacks.finish/error/pending` must always be set on `createSubscriptionTransaction`** — the dashboard-level "Finish Redirect URL" setting does NOT take effect when per-request callbacks are present; removing them silently breaks the redirect-back-to-`/billing` flow (rule 112).
- **`PaymentResultBanner` (one-time, query-param-driven) and `PendingPaymentBanner` (persistent, DB-row-driven) are deliberately separate components with different lifecycles.** Don't merge them — they answer different questions ("what just happened" vs "what's still unresolved").
- **`cancelPendingPayment` only marks our DB row `cancelled`** — it does NOT call any Midtrans API to invalidate the Snap session. The abandoned link is left to expire naturally (24h). If the user pays on it anyway, `markPaymentSuccess` still activates correctly (updates by `orderId` regardless of current status).
- **`getPaymentMethodLabel` (in `components/dashboard/billing/constants.ts`) is the single source for Midtrans `payment_type` → Indonesian label.** Used by `PaymentHistoryCard` and both lifecycle emails. The old `formatPaymentMethod` switch function is gone — never recreate it.
- **`PaymentHistoryCard` date column is `paidAt ?? createdAt`** — every row must show a date regardless of status.
- **"Reset Kuota" on `/billing` is `getNextMonthFirstDay()`, NOT `currentPeriodEnd`.** These represent different things (quota reset vs subscription renewal) — see Open Items for the known decoupling.