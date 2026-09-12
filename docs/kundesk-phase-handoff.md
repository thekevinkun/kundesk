# Kundesk — Phase Handoff Document

> **Document Type:** Living document. Replace entirely after each phase completes. **Current State:** Phase 16 (Security & Reliability Stabilization) — IN PROGRESS. Three PRs merged this session, closing the three highest-severity findings from a full-codebase audit. Several medium/high items remain open — see below. Production deployed at `kundesk.vercel.app`. **Last Updated:** September 2026. **Always read `kundesk-project-bible.md` before this document.**

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
15. ALWAYS ask to see an existing file before rewriting or modifying it. Never assume what's in a file — ask Kevin to paste it first. **Claude has no direct access to Kevin's repo or local machine — Claude gives exact code/diffs in chat; Kevin applies, commits, and pushes himself.**
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
112. **Midtrans Finish Redirect URL** — handled via per-request `callbacks` (see Phase 15). Dashboard-level setting alone does NOT work for Kundesk's integration — per-request `callbacks.finish/error/pending` override it.
113. **Neon cold start context** — Neon serverless sleeps after inactivity. First query after waking takes 2–5 seconds. AI-mode DB transaction fires BEFORE Pusher events — transaction itself is fast (ms), so cold start adds only a small fixed delay, not a 25s stall.
114. **Pusher channel auth — `transport: "ajax"` + `headersProvider`** — DO NOT change to `"fetch"` or `customHandler`. Confirmed working via direct A/B test; `customHandler` causes total live-update regression.
115. **Dark mode is scoped to dashboard only** — `ThemeProvider` (next-themes) lives in `app/(dashboard)/dashboard/layout.tsx`, NOT in root `app/layout.tsx`. Landing page is always light.
116. **`ThemeProvider` wrapper keeps `next-themes` as-is** — no `scriptProps` override. Do NOT add `scriptProps={{ type: "application/json" }}`.
117. **Theme toggle hydration guard** — `Topbar.tsx` dark mode toggle renders a neutral placeholder until `mounted === true`.
118. **PlanCard CTA/badge text colors use `text-white`, never `text-(--color-bg-page)`** — `--color-bg-page` is theme-dependent and produces dark-on-dark text in dark mode.
119. **`getAnsweredRate` is capped at 100%** — `Math.min(..., 100)`. Never remove the cap.
120. **`payments_org_pending_unique_idx` is real and live in Neon** — DB-level partial unique index, one `pending` row per `org_id`. `createPayment` already catches its `23505` violation gracefully. `insertPendingPayment` proactively expires stale (>24h) pending rows before inserting, so this constraint can no longer permanently lock an org out of checkout.
121. **`insertPendingPayment` must be called before EVERY Midtrans transaction creation, including renewals** — not just manual checkout. This is what makes the webhook's amount validation actually work; without a pending row, validation silently no-ops and trusts whatever Midtrans reports.
122. **`lib/db/schema.ts` is the only source of truth for the schema** — never trust `drizzle-kit introspect` output as a long-term artifact. It's a one-time diagnostic tool for detecting drift, not something to keep or maintain going forward.
123. **`lib/db/migrations/0000_equal_brood.sql` must never be run against production Neon** — it documents schema that already exists there. It exists so the NEXT real schema change produces an accurate diff via `drizzle-kit generate`, not so it can be executed. A literal warning comment is at the top of the file.
124. **Any future manual Neon schema change must be mirrored in `lib/db/schema.ts` in the same sitting.** This is exactly how the original migration-chain drift happened, and nothing structurally prevents it happening again.
125. **Midtrans real-mode transactions set `expiry: { unit: "hours", duration: 24 }`** — matches the local `payments` staleness cutoff used by `insertPendingPayment`'s expiry logic. Do not remove one without reconciling the other.
126. **`documents/process` always downloads `document.s3Key` from the DB, never the client-supplied `s3Key`** — client value is validated for exact match and rejected on mismatch, but never trusted for the actual S3 call, even as defense-in-depth.
127. **Sentry (`sentry.server.config.ts` etc.) only auto-captures uncaught exceptions and client-side crashes** — it does NOT capture anything from a `console.error` inside a `try/catch`, which is this codebase's dominant error-handling pattern. Only two call sites (`documents/process` s3Key mismatch, midtrans webhook amount mismatch + fraud flag) have explicit `Sentry.captureMessage` calls as of Phase 16. A full audit of every other catch block is deferred — see Open Items.

---

## Phase 15 — Midtrans Payment Lifecycle (Prior Session — Summary Retained)

> Full detail preserved from the prior handoff for reference. Two PRs: `feature/midtrans-payment-lifecycle` and `feature/billing-ux-refinements`. Both merged and tested live in production before this session began.

**Core changes:** `payments` table shifted from success-only ledger to full lifecycle tracking (`pending → success/failed/expired/cancelled`), with `insertPendingPayment`, `markPaymentSuccess` (UPDATE + INSERT fallback), `markPaymentClosed`, `getPendingPayment`, `cancelPendingPayment` added to `lib/db/queries/billing.ts`. `createPayment`'s same-day lock replaced by the pending-payment check. Midtrans `callbacks.finish/error/pending` added to fix the redirect-back-to-`/billing` issue. `PaymentResultBanner` (one-time, query-param-driven) and `PendingPaymentBanner` (persistent, DB-row-driven) both added. Webhook handler gained non-settlement status handling (`expire`/`cancel`/`deny` → `markPaymentClosed`). Two new lifecycle emails (`PaymentPendingEmail`, `PlanUpgradedEmail`). `PAYMENT_METHOD_LABELS`/`getPaymentMethodLabel` replaced the old `formatPaymentMethod`. `CurrentPlanCard` got a 100%-quota badge and a corrected "Reset Kuota" date via `getNextMonthFirstDay()`.

**CodeRabbit finding at the time (Section K):** TOCTOU gap between `getPendingPayment` and `insertPendingPayment` was flagged. **This session's investigation (Phase 16) found this was already resolved at the DB level** — a partial unique index (`payments_org_pending_unique_idx`) exists live in Neon and is already handled by a `23505` catch in `createPayment` — but this was never documented in Phase 15's decision log, which incorrectly states "no unique constraint was added." See rule 120.

**Full file-change list and prior Open Items are preserved below in the original Phase 15 record.**

---

## Phase 16 — Security & Reliability Stabilization (Current Phase — IN PROGRESS)

### Context — Why This Phase Started

Kevin returned after a 2-month gap with a detailed external audit (run independently against the live codebase) comparing documentation claims to actual code. The audit surfaced several cosmetic doc-drift items and several genuinely severe findings. This session worked through the three highest-severity items end to end, plus two more that surfaced organically during that work.

### PR 1 — `fix/document-process-s3-key-authorization` (merged)

**Vulnerability:** `/api/documents/process` verified `documentId` ownership via `requireOrg()`/`orgId`, but then downloaded the **client-supplied** `s3Key` rather than the DB-persisted `document.s3Key`. An attacker with a valid `documentId` in their own org could point processing at a different (possibly cross-tenant) S3 object if they discovered its key.

**Fix:**
- Hard reject (400) if `s3Key !== document.s3Key`, logged via `console.error` AND `Sentry.captureMessage`
- Pipeline now always downloads `document.s3Key`, never the client value, as defense-in-depth even if the check above were ever bypassed

### PR 2 — `fix/midtrans-webhook-amount-validation` (merged)

**Vulnerability:** Midtrans webhook signature verification proves Midtrans sent the notification — it does NOT prove the amount is correct. `MIDTRANS_CLIENT_KEY` is public; a caller could create their own Snap transaction using Kundesk's `order_id` format at a lower price and have it activate a full-price plan.

**Fix:**
- New `getPaymentByOrderId(orderId)` in `lib/db/queries/billing.ts`
- Webhook handler compares `notification.gross_amount` against the recorded `payments.amount` before calling `activateSubscription`; mismatch → mark processed, return 200, `Sentry.captureMessage`, do NOT activate
- Existing fraud-flag branch also now calls `Sentry.captureMessage` (previously `console.error` only)
- **Gap found during CodeRabbit review, fixed in same PR:** the renewal cron (`app/api/cron/renewal/route.ts`) created Midtrans transactions but never called `insertPendingPayment` — meaning renewals had ZERO amount validation even after the fix above (no pending row to compare against). Fixed: renewal cron now calls `insertPendingPayment` right after `createSubscriptionTransaction`, using the already-returned (but previously discarded) `orderId`. Wrapped in try/catch for the `payments_org_pending_unique_idx` collision case (org already has an unresolved pending payment when renewal cron runs) → logged and skipped for that org, not treated as a hard failure.
- New tests in `route.test.ts`: amount-mismatch reject, amount-match pass-through

### PR 3 — `fix/migration-chain-baseline-reset` (merged)

**Root problem:** `lib/db/migrations/meta/_journal.json` referenced a file (`0008_organic_namora`) that didn't exist on disk; three files existed on disk with no journal entry; no migration ever created the `payments` table. Root cause: schema changes have long been applied by hand directly in Neon (per existing rule — `db:migrate` doesn't work against Neon), and the local migration folder simply never stayed in sync with that manual process.

**Deeper finding during reconciliation:** `lib/db/schema.ts` itself had drifted from *live* Neon (confirmed via `npx drizzle-kit introspect` against the real database), in three places:
- `payments` — missing a **partial unique index** (`payments_org_pending_unique_idx`, one pending row per org) that is ALREADY LIVE in Neon and already relied upon (the `23505` catch in `createPayment` was written for it, but nobody had documented that the constraint actually exists). Also: `payments_org_status_created_idx` (composite, `org_id, status, created_at`) was documented in the Phase 15 handoff as applied via `ALTER TABLE`, but is **NOT actually live** — `getPendingPayment` has been running unindexed this whole time.
- `promoCodes` — missing a case-insensitive unique index on `lower(code)` (live, matches the `LOWER()` lookup rule, just undeclared) and THREE `CHECK` constraints (`chk_discount_percent`, `chk_max_uses`, `chk_used_count`) that are live in Neon and completely undocumented anywhere in the codebase until now.
- `chunks` — the HNSW vector index existed live but was never declared in `schema.ts`, meaning any future unrelated `drizzle-kit generate` on this table risked silently generating a `DROP INDEX` for it.

**Fix:**
- `lib/db/schema.ts` reconciled to match live Neon exactly for all three tables
- Old `lib/db/migrations/` archived (not deleted) to `lib/db/migrations_archive_pre_reset/`
- Fresh `lib/db/migrations/0000_equal_brood.sql` generated from the corrected schema via `drizzle-kit generate`, verified line-by-line against the introspected live schema
- Explicit `-- DO NOT run this against production Neon` warning comment added at the top of the file, plus `CREATE EXTENSION IF NOT EXISTS vector;` as the first statement (CodeRabbit finding — a genuinely fresh DB would otherwise fail on the HNSW index with no pgvector extension enabled)
- `lib/db/migrations/schema.ts` and `relations.ts` (one-time `introspect` diagnostic artifacts, NOT maintained migration definitions, and one had an actual syntax error — unterminated string literal, `default(')` — that broke `typecheck`/CI) were **deleted entirely**, not fixed. Source of truth is `lib/db/schema.ts`; the migration is `0000_equal_brood.sql`, generated from that file, not from the introspect output.
- `insertPendingPayment` now expires any stale (>24h) pending row for the org before inserting a new one (CodeRabbit finding — without this, an abandoned checkout with no Midtrans-side interaction at all, so no `expire` webhook ever fires, would permanently block that org from any future checkout via the unique index)
- `createSubscriptionTransaction` (real mode only) now sets Midtrans-side `expiry: { start_time, unit: "hours", duration: 24 }`, matching the local 24h cutoff — closes the same stale-payment race structurally on the Midtrans side, rather than only reconciling it after the fact

**Explicitly accepted, not fixed (raised 3 times by CodeRabbit across threads, acknowledged each time):** `db:migrate` is still theoretically unsafe to run against live Neon (it would try to `CREATE TABLE` things that already exist). This is unchanged from before this PR — `db:migrate` was never invoked anywhere (confirmed: not in `ci.yml`, not in any `package.json` script actually used). A real fresh-database bootstrap mechanism (recording the baseline as "already applied" without running it) is legitimate future work, correctly flagged by CodeRabbit as a heavy lift, out of scope here.

### Root Cause, Named Explicitly (for future reference)

Two systemic patterns explain most of what this session found:

1. **Manual Neon application has been standard practice for a long time** (confirmed as far back as Phase 15), but nothing ever kept the local migration folder or `schema.ts` in sync with what was actually run by hand. This is now reconciled as of PR 3, but the underlying practice is unchanged — the next schema change will drift again unless `schema.ts` is updated in the same sitting as the manual Neon change, every time, going forward (rule 124).

2. **The codebase is disciplined about catching and gracefully handling errors** (returning clean JSON, never letting things 500) — which is good practice, but it also means almost nothing reaches Sentry, since Sentry here was only ever wired for uncaught exceptions. "Monitoring is set up" and "monitoring actually sees deliberately-handled failures" turned out to be two different, previously-unexamined claims (rule 127).

### Incidental Fix — E2E Test Infrastructure (Discovered and Resolved Mid-Session)

CI hadn't run in 2 months. First re-run failed 15/24 E2E tests across every unrelated spec file simultaneously — a strong signal of a foundational break, not a feature bug. Root cause: the Neon `e2e-test` branch (referenced by the `E2E_DATABASE_URL` GitHub secret) had auto-suspended/been removed after prolonged inactivity — a known Neon free-tier behavior. Resolved by: creating a fresh Neon branch, applying `0000_equal_brood.sql` to it in full, updating the `E2E_DATABASE_URL` secret, and confirming the `E2E_ORG_ID`/`E2E_ORG_SLUG`/Clerk test-user seed data still matched. A separate, real syntax error in `lib/db/migrations/schema.ts` (see PR 3) was also blocking CI independently and was discovered/fixed in the same session.

---

## Open Items — Carried Forward, Not Yet Started

**High severity:**
1. **Plan enforcement not server-side.** `PLAN_LIMITS` declares document/widget/analytics/branding flags per plan, but only message quota is actually enforced. Free users can currently get widget embed code and call the public widget endpoint. **Decision needed:** enforce literally per `PLAN_LIMITS`, or looser? Not yet decided.
2. **Org member permissions — decided, not implemented.** Decision made in Phase 16: `org:member` should be conversations-only (view, reply, takeover, return, dismiss). Billing, org settings, documents, chatbot config, team management should require `org:admin`. No code changes made yet — current code reportedly allows members to do nearly everything.
3. **`payments_org_status_created_idx` still not live.** Documented as applied in Phase 15, confirmed NOT live during Phase 16's introspection. Deliberately NOT added to the new baseline migration since it isn't live yet — needs a real `CREATE INDEX` applied to Neon, then captured in a proper follow-up migration file (would be `0001_...sql` on top of the new clean baseline).

**Medium severity:**
4. **Org deletion / data retention — decision in progress.** Current behavior only flips `subscriptionStatus` to `cancelled`; no `deletedAt`, no actual deletion or anonymization of documents/chunks/messages/PII. Leaning toward soft-delete + grace period + scheduled hard-delete (industry-standard pattern, likely UU PDP compliant), with `payments` anonymized-not-deleted for accounting retention — but not committed to yet.
5. **Public Pusher channel security** — customer widget channels rely on UUID (`channelToken`) secrecy alone, no expiry or revocation mechanism.
6. **Synchronous document processing vs. Vercel Free's 10s function limit.** Current code has a 55s in-process race timeout, which structurally cannot fit inside a 10s Vercel Free function limit if that limit is actually being enforced in production. Needs deployment-runtime confirmation, not just code reading.

**Lower priority / cleanup, do opportunistically:**
7. **Sentry blind-spot audit** — see rule 127. Full pass across every catch block in the codebase, not just the two touched in Phase 16. Explicitly deferred by Kevin's own call: "we're going to do it later."
8. **Doc drift, cosmetic/informational only:**
   - `/billing/mock-payment` route referenced in mock-mode `redirectUrl` does not actually exist as a page
   - Message length: Bible/architecture say 500 chars, public chat actually accepts 1,000 (staff reply is still 500)
   - CSP: Bible claims full CSP configured for Clerk/Pusher/Midtrans/CloudFront; actual global headers omit CSP, only `/chat/*` gets `frame-ancestors *`
   - FK naming drift: live `payments_org_id_fkey` vs. Drizzle's auto-generated `payments_org_id_orgs_id_fk` — cosmetic, will resurface as a rename suggestion on the next real `drizzle-kit generate`, safe to ignore
   - `generateMetadata()` on the public chat page reveals org name for an inactive chatbot, undermining the slug-enumeration protection that's otherwise correctly implemented
9. **`orgs.midtransCustomerId`** — confirmed dead (Midtrans has no persistent customer concept). Safe to drop whenever `orgs` is next touched for an unrelated reason. Not urgent.

**Unchanged from Phase 15, still deferred:**
- WhatsApp/Meta integration — on hold pending Meta Business verification
- Midtrans production keys — still sandbox
- Domain purchase + Resend sender migration — still pending
- CloudFront — still post-launch
- Promo code administration — still manual via Neon SQL editor
- Quota reset / billing cycle decoupling — known limitation, not addressed
- `lib/ai/stream.ts` — still dead code, can delete anytime

---

## Decisions Made / Pending (5-Question List from the Original Audit)

1. **Org member permissions:** conversations-only for `org:member`. ✅ Decided, not yet implemented (Open Item #2).
2. **Org deletion:** leaning soft-delete + grace period + scheduled purge, payments anonymized not deleted. ⏳ Not finalized.
3. **Free-tier technical enforcement:** ❓ Not yet discussed.
4. **Manual Neon schema drift as accepted practice:** effectively reaffirmed by continuing the practice (Phase 16 cleaned up its bookkeeping, didn't change the practice itself). Whether reproducible migrations should become mandatory was not decided either way.
5. **Next priority — security/reliability stabilization continues:** ✅ this whole phase is that. Suggested next: plan enforcement (Open Item #1) — most contained of the remaining high-severity items, doesn't risk another CI/CodeRabbit fire drill like the migration reset did.

---

## Coding Rules Reminder (New From Phase 16 — Also See Rules 120–127 Above)

- **`payments_org_pending_unique_idx` is real and live** — see rule 120.
- **`insertPendingPayment` must precede every Midtrans transaction, including renewals** — see rule 121.
- **`lib/db/schema.ts` is the only source of truth for the schema** — see rule 122.
- **`0000_equal_brood.sql` must never be run against production Neon** — see rule 123.
- **Any future manual Neon schema change must be mirrored in `schema.ts` in the same sitting** — see rule 124.
- **Midtrans real-mode transactions now set `expiry: 24 hours`** — see rule 125.
- **`documents/process` always downloads `document.s3Key`, never the client value** — see rule 126.
- **Sentry only auto-captures uncaught exceptions, not caught-and-logged errors** — see rule 127. Full audit deferred, not forgotten.
