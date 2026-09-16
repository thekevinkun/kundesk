# Kundesk — Phase Handoff Document

> **Document Type:** Living document. Replace entirely after each phase completes. **Current State:** Phase 16 (Security & Reliability Stabilization) — IN PROGRESS. Three sessions completed. Session 3 closed all three remaining medium-severity Open Items from the original audit (Pusher channel security, org deletion/data retention, and the Vercel timeout concern — the last one checked and confirmed not a live issue rather than fixed). Only lower-priority, opportunistic cleanup items remain open. Production deployed at `kundesk.vercel.app`. **Last Updated:** September 2026 (Session 3). **Always read `kundesk-project-bible.md` before this document.**

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
9. Always work on a feature branch — never push directly to master. Branch → PR → CI → merge. Only trivial chores (metadata, typos, accessibility fixes) go directly to master. Even small, mechanical-looking fixes (a single missing index, a one-line query-key fix) go through a PR if they touch production schema, security enforcement, or CI reliability — the ceremony can be lightweight, but the review step stays.
10. Every new PR needs a description filled in markdown — title is auto-filled from commit; description must always be written. Never skip this. **Always give PR descriptions as a plain markdown code block directly in chat — never as a file attachment.** Kevin copies it straight from the chat window.
11. Always explain concept first (1–3 sentences), how it connects to what Kevin knows, then write code with inline comments.
12. Before writing any UI code — read `/mnt/skills/public/frontend-design/SKILL.md` first.
13. Always use `npm run typecheck`. Then `npm run lint` before committing.
14. ALWAYS ask to see an existing file before rewriting or modifying it. Never assume what's in a file — ask Kevin to paste it first. **Claude has no direct access to Kevin's repo or local machine — Claude gives exact code/diffs in chat; Kevin applies, commits, and pushes himself.**
15. After CI passes — THEN write the handoff document. Never write it before merge.
16. Answer conversationally in chat — never dump walls of markdown mid-build unless Kevin explicitly asks for a document. This is a conversation, not a document session by default.
17. When making surgical changes to existing files — specify EXACTLY which lines to change, what to replace, and what to add. Never force a full rewrite unless truly necessary.
18. All animation variants must live in `lib/animations.ts` — never inline in components. Use `variants` pattern: `variants={x} initial="hidden" animate="visible"`.
19. Framer Motion `ease` arrays must be typed as `[number, number, number, number]` tuples to satisfy TypeScript strict mode.
20. Vitest mock classes with `function` keyword — never arrow functions. Arrow functions cannot be used with `new`, causing "is not a constructor" errors.
21. When writing tests for functions that use `useCallback` — always verify the dependency array includes all values the callback reads. Stale closures cause silent bugs in production and incorrect test behaviour.
22. Before adding a build step to CI — cross-reference the full `.env` against `lib/env.ts` required fields. Add ALL required vars as fake placeholders upfront. Never add them one-by-one after repeated failures.
23. CI env vars: avoid credential-shaped placeholders in `DATABASE_URL` (e.g. `fake:fake@`) — use `postgresql://placeholder-host/placeholder-db` format to avoid secret-scanner false positives (CKV_SECRET_4).
24. Shared CI env vars belong in `jobs.<job>.env` — not duplicated across individual steps.
25. **CodeRabbit is active** — CI (typecheck → lint → test → build + Playwright E2E) plus CodeRabbit review on every PR. CodeRabbit has repeatedly caught real, valid issues this project (TOCTOU races, missing accessibility attributes, cache-based auth bypass windows, enumeration signals, reactivation-during-purge races) — always treat its findings as worth investigating, never dismiss without checking, and never apply its suggested diff verbatim without checking it actually fits the surrounding code (see Session 3, PR `feat/org-deletion-grace-period`, where a suggested fix needed adapting because it didn't account for the function already being called inside a transaction).
26. **E2E tests use `page.evaluate(fetch(...))` for all authenticated API calls** — the `request` fixture has no Clerk session. Never use `request.get/post` for protected routes in E2E tests.
27. **`test.use()` must be called at `describe` level** — never inside a `test()` function. Playwright throws immediately if called inside a test.
28. **Vitest excludes `e2e/` folder** — `vitest.config.ts` has `exclude: ["node_modules", ".next", "e2e"]`. Never remove this — Playwright spec files use `@playwright/test` not Vitest, and Vitest will crash trying to run them.
29. **Playwright browser cache** — CI caches `~/.cache/ms-playwright` keyed on `package-lock.json` hash. First run downloads Chromium (~200MB), subsequent runs use cache. Don't remove the cache step from CI.
30. **E2E workers in CI** — `playwright.config.ts` sets `workers: process.env.CI ? 2 : 1`. Locally: 1 worker (sequential, avoids Clerk rate limits). CI: 2 workers (parallel). Never increase back to 4.
31. **SSE stream `conversationId`/`channelToken` extraction** — the `/api/chat` endpoint sends `{ done: true, conversationId, channelToken, handoffStatus }` as the final SSE event. E2E tests parse this to get both values without needing a list API route.
32. **E2E filename uniqueness** — document upload tests use `test-faq-${Date.now()}.txt` as the filename. Never use a fixed filename — accumulated test runs create multiple rows and trigger Playwright strict mode violations.
33. **PostgreSQL `AT TIME ZONE` operator inverts on `timestamptz`** — `timestamptz AT TIME ZONE 'Asia/Makassar'` converts FROM that zone TO UTC, not the other way. Always use the function form: `timezone('Asia/Makassar', created_at)` to convert TO local time.
34. **All time-grouped DB queries accept a `timezone` string param** — never hardcode `'Asia/Makassar'` or any timezone in queries. Read it from `getOwnerTimezone()` in the Server Component and pass it down.
35. **`react-markdown` is installed** — use `<ReactMarkdown>` with `prose-bubble` CSS class for all chat message content. Never use manual `content.split("\n").map(...)` pattern.
36. **`ChatHeader` is hidden inside iframe** — uses `useEffect` + `useState` to detect `window.self !== window.top` after mount. Never use `if (typeof window !== 'undefined')` directly in render — causes SSR hydration mismatch.
37. **Widget `X-Frame-Options`** — `/chat/:path*` routes override the global `SAMEORIGIN` header with `ALLOWALL` + `frame-ancestors *` CSP. This is intentional — the chat page must be embeddable in the widget iframe.
38. **Promo code lookup uses `LOWER()` SQL function** — never `ilike()`. Always use `` sql`LOWER(${promoCodes.code}) = LOWER(${code})` `` for exact case-insensitive match.
39. **`usedCount` increments in webhook handler, not in `createPayment` action** — abandoned checkouts must not burn promo quota.
40. **Promo ID encoded in `order_id`** — format: `KUNDESK-{orgSlice}-{PLAN}-{timestamp}-P{promoId}`. Never change the order_id format without updating the webhook parser.
41. **Sound notifications** — `useSoundNotification` hook plays audio client-side. Browser autoplay policy blocks audio until user interacts with the page — fails silently, never crash the dashboard.
42. **Neon serverless cold start** — notification API routes wrap DB calls in try/catch and return graceful empty responses on `ETIMEDOUT`. Never let a cold-start timeout surface as a 500.
43. **`fireMockWebhook` accepts optional `amount` param** — defaults to `PLAN_PRICE[plan]` for backward compatibility.
44. **Redis caching** — org data cached under `kundesk:cache:org:slug:{slug}` AND `kundesk:cache:org:id:{orgId}` (TTL 5 min). Chatbot config cached under `kundesk:cache:chatbot:{orgId}` (TTL 10 min). Both keys must be invalidated together via `invalidateOrgCache(orgId)`.
45. **`invalidateOrgCache(orgId)`** — reads the cached org to get the slug, then deletes both `orgBySlug` and `orgById` keys atomically.
46. **Embedding batching** — `batchedAsync(chunks, 10, embedText)` — never `Promise.all` directly on embedding calls.
47. **Document processing timeout** — `app/api/documents/process/route.ts` wraps the pipeline in `Promise.race` against a 55-second timeout. `markFailed()` is called ONCE in the outer catch — never inside `runProcessingPipeline`. **Checked in Phase 16 Session 3 against Vercel's 10s free-tier function limit: no documents found stuck in `"processing"` status in Neon, no matching timeout errors in Vercel's function logs. No evidence of a live problem — left as a documented risk, not an active bug. Revisit only if a stuck document actually appears or upload volume/size grows.**
48. **OpenAI stream errors** — use `APIConnectionError` and `APIConnectionTimeoutError` from the OpenAI SDK — never string matching. Error message to customer is in Bahasa Indonesia.
49. **Widget XSS protection** — widget script sets text content via `textContent` (never `innerHTML`).
50. **Widget rate limiting** — `/api/widget` uses `checkWidgetRateLimit(ip, orgSlug)` — 60 req/min per IP+orgSlug.
51. **Health check** — `GET /api/health` pings Neon with `SELECT 1` and returns 200/503. No auth required.
52. **Message retention** — `deleteOldMessages(90)` runs daily at 20:00 UTC via `GET /api/cron/retention`.
53. **Privacy policy** — `app/(marketing)/privacy/page.tsx` at `/privacy`. Bahasa Indonesia. Linked from footer.
54. **Syarat & Ketentuan** — `app/(marketing)/syarat-ketentuan/page.tsx` at `/syarat-ketentuan`.
55. **Kebijakan Refund** — `app/(marketing)/kebijakan-refund/page.tsx` at `/kebijakan-refund`.
56. **Deployment target is Vercel** — Free tier. Cron via `vercel.json`. Function timeout is 10s on free.
57. **npm audit status** — 7 moderate vulnerabilities, all in dev tools. Do NOT run `npm audit fix --force`.
58. **DB indexes** — `notifications_org_created_idx ON (org_id, created_at DESC)`. `conversations_org_handoff_status_idx ON (org_id, handoff_status)`. `payments_org_status_created_idx ON (org_id, status, created_at)`.
59. **RLS intentionally NOT implemented** — application-layer isolation via `requireOrg()` + `AND org_id = $orgId` is sufficient.
60. **KUN is the fixed AI identity** — name, greeting, and voice are hardcoded. Never read from `chatbots` table. `name`, `tone`, `greeting_message` columns dropped in Phase 12b. This is also why `PLAN_LIMITS.chatbots` is vestigial (see rule 132) — there was never a multi-chatbot creation flow built, because the product moved to a single fixed KUN identity per org before that feature existed.
61. **KUN RAG prompt — `kunIdentity` block in `lib/ai/rag.ts`** — "Kak" as vocative (start/end of sentence only) vs "kakak" as mid-sentence pronoun. Never revert to vague instructions.
62. **KUN greeting is hardcoded in `ChatPage.tsx`** — `kunGreeting` constant uses `orgName` interpolation. Never read from `chatbots.greetingMessage`.
63. **Widget no longer calls Clerk API for org image** — KUN logo served from `${appUrl}/images/kun-logo.png`.
64. **KUN logo path** — `/public/images/kun-logo.png` (and `/public/images/kun_logo.png` used in `ChatPage` empty state and `MessageBubble`/`ConversationDialog` avatars). Always use `next/image` with explicit `width` and `height` props.
65. **`ConversationDialog` double-message bug** — fixed with `lastProcessedMessageId` ref initialized to `newMessage?.id ?? null`. Never remove — prevents double-append on pending→human transition.
66. **`FaqCard` accepts optional `answerSuffix` prop** — `React.ReactNode` rendered after answer text. Used for privacy policy link in FAQ id=5.
67. **`DemoCard` video component** — `components/landing/works/DemoCard.tsx`. Video source: `/public/videos/kundesk-demo.mp4`. Recorded and live in production.
68. **Message counting — `role: "user"` only** — quota, stat cards, and all chart queries count only customer messages (`role = 'user'`). Assistant and human_agent messages are never counted.
69. **`messagesUsed` increments for ALL customer messages** — both AI-mode and human-mode. Atomic SQL guard `messagesUsed < messagesLimit` prevents exceeding the limit.
70. **Handoff requests and human-mode bypass quota pre-check intentionally** — documented in code, never "fix" it.
71. **`processedWebhooks.source`** — `"midtrans"` for payment/billing, `"system"` for quota, `"clerk"` for Clerk.
72. **Quota idempotency key format** — `QUOTA-FULL-{orgId}-{YYYY-MM}` and `QUOTA-WARN-{orgId}-{YYYY-MM}`. Both use `source: "system"`.
73. **Dashboard chart queries count `role = 'user'` only** — `getDailyMessageTrend`, `getMonthlyMessageComparison`, `getWeeklyMessages` all have `AND role = 'user'` in their CTEs.
74. **`getDashboardCharts` in `lib/db/queries/dashboard.ts`** — bundles all three chart queries into one call.
75. **Dashboard charts live-update via TanStack Query** — `["dashboard", orgId, "charts"]` invalidated by `handleUsageUpdated` with 2s debounce.
76. **`usage:updated` fires for all customer messages** — both AI-mode and human-mode.
77. **`conversation:return` fires on both channels** — `triggerConversationReturn` calls `triggerOrgEvent` (dashboard) AND `triggerPublicConversationEvent` (customer widget) concurrently.
78. **`ChatPage` listens for `conversation:return`** — binds on the customer widget channel and calls `setHandoffStatus("ai")`.
79. **`human_agent` role remapped to `"assistant"` before OpenAI** — `conversationHistory` in `/api/chat` maps `human_agent → assistant`.
80. **Quota notifications fire once per billing period** — `quota_warning` at 80%, `quota_full` at 100%.
81. **`plan_upgraded` notification** — fired in Midtrans webhook handler after `activateSubscription` succeeds, awaited.
82. **`quota_reset` notification** — fired per org in `reset-usage` cron, awaited via `Promise.all`.
83. **`NotificationPanel` body rendering** — checks for `|` delimiter. Never put `|` in a plain notification body.
84. **`RecentConversationsPanel` uses `getRecentActiveConversations`** — only conversations with activity in last 24h. No `isExpired` derivation — never add it back.
85. **`getRecentActiveConversations` sorts in SQL** — `pending_handoff` first, then `last_message_at DESC`. Client-side `sortConversations` still runs for Pusher-driven updates.
86. **`RecentConversationsPanel` message count label is "pesan aktif"** — never revert to "pesan".
87. **Dashboard layout** — Charts row 2 is `grid-cols-[1.4fr_1fr]`: left column has `BarChart` stacked above `LineChart`, right column has `RecentConversationsPanel`. Panel uses `lg:sticky lg:top-4`.
88. **`messagesUsed` sync** — run `UPDATE orgs SET messages_used = (SELECT COUNT(*) FROM messages WHERE org_id = orgs.id AND role = 'user') WHERE id = '{orgId}'` in Neon SQL editor when drift occurs.
89. **PostHog tracks 7 events total** — `conversation_started`, `chat_message_sent`, `handoff_requested`, `document_uploaded`, `plan_upgraded`, `chatbot_configured`, `human_handoff_taken`. All fire-and-forget. `distinctId` is always `orgId`. Never log `systemPrompt` content.
90. **PostHog is product analytics, not business metrics** — dashboard charts come from Neon DB queries, not PostHog.
91. **`dismiss` route — `POST /api/conversations/[id]/dismiss`** — returns `pending_handoff` conversation to `ai` mode. Inserts canned apology as `role: "assistant"` in DB. Pusher payload role also `"assistant"`. Only valid when `handoffStatus === "pending_handoff"` — returns 409 otherwise.
92. **Dismiss canned message** — `"Mohon maaf, admin tidak bisa membalas pesanmu sekarang. Tetap cerita sama KUN ya, aku siap membantu! 😊"` — `role: "assistant"` in BOTH DB and Pusher payload.
93. **"Abaikan" button in `ConversationRow` and `ConversationMobileCard`** — shown only when `handoffStatus === "pending_handoff"`. Uses `danger` color, `useTransition` pattern identical to `handleTakeover`.
94. **Pending handoff spam is already guarded** — `detectHandoffRequest` block in `/api/chat` only runs when `currentHandoffStatus === "ai" || currentHandoffStatus === null`.
95. **KUN "Kak" grammar rule in `lib/ai/rag.ts`** — "Kak" vocative at start/end of sentence only. "kakak" mid-sentence pronoun.
96. **Features section layout** — `layout: "wide"` (RAG, Analytics) vs `layout: "card"` (Tenant, Security), driven by `FEATURES` constant in `lib/constants/landing-constants.ts`.
97. **`RagPreview` is an animated looping chat** — `CHAT_SCRIPT` array drives the sequence, `STEP_DELAYS` controls timing. Never convert to a static screenshot.
98. **`AnalyticsPreview` pulsing dot** — pure CSS `ping-slow` keyframe in `globals.css @layer base {}`. Never use Tailwind's `animate-ping`.
99. **`chatBubbleIn` animation variant** — in `lib/animations.ts`. `AnimatePresence mode="popLayout"` wraps the chat area.
100. **`formatRelativeTime` accepts optional `now` param** — `formatRelativeTime(date, now?)`. Always pass `now` inside ticking contexts.
101. **`useNow` hook in `ConversationRow.tsx`** — smart interval, ticks every minute (<1hr) or hourly (>1hr).
102. **`RecentConversationsPanel`** — `activeConversations` wrapped in `useMemo` — never remove.
103. **Hydration mismatch on relative time** — `suppressHydrationWarning` on spans rendering `formatRelativeTime`.
104. **Legal pages share components with privacy page** — `PrivacyHero`, `PrivacySection`, `Checklist` from `components/landing/security/`.
105. **Legal components folder** — `components/landing/legal/` — never merge into `components/landing/security/`.
106. **Legal constants** — `lib/constants/terms-constants.ts` and `lib/constants/refund-constants.ts`.
107. **GitHub repo is public** — intentional decision.
108. **Docker is NOT used** — Vercel handles containerization.
109. **OG image** — `/public/images/og-image.webp`. Under 300KB. Never revert to PNG.
110. **Midtrans webhook URL** — `https://kundesk.vercel.app/api/webhooks/midtrans`.
111. **Midtrans Finish Redirect URL** — handled via per-request `callbacks`. Dashboard-level setting alone does NOT work for Kundesk's integration — per-request `callbacks.finish/error/pending` override it.
112. **Neon cold start context** — Neon serverless sleeps after inactivity. First query after waking takes 2–5 seconds.
113. **Pusher channel auth — `transport: "ajax"` + `headersProvider`** — DO NOT change to `"fetch"` or `customHandler`. Confirmed working via direct A/B test; `customHandler` causes total live-update regression. **This proven pattern was reused as-is for the customer widget's own auth endpoint in Session 3 — do not invent a different transport for any new private channel.**
114. **Dark mode is scoped to dashboard only** — `ThemeProvider` (next-themes) lives in `app/(dashboard)/dashboard/layout.tsx`, NOT in root `app/layout.tsx`. Landing page is always light.
115. **`ThemeProvider` wrapper keeps `next-themes` as-is** — no `scriptProps` override.
116. **Theme toggle hydration guard** — `Topbar.tsx` dark mode toggle renders a neutral placeholder until `mounted === true`.
117. **PlanCard CTA/badge text colors use `text-white`, never `text-(--color-bg-page)`**.
118. **`getAnsweredRate` is capped at 100%** — `Math.min(..., 100)`. Never remove the cap.
119. **`payments_org_pending_unique_idx` is real and live in Neon** — DB-level partial unique index, one `pending` row per `org_id`.
120. **`insertPendingPayment` must be called before EVERY Midtrans transaction creation, including renewals.**
121. **`lib/db/schema.ts` is the only source of truth for the schema** — never trust `drizzle-kit introspect` output as a long-term artifact.
122. **Manual Neon schema changes must be mirrored in `schema.ts` in the same sitting.** Followed correctly again in Session 3 for the `purgingAt` column addition.
123. **Midtrans real-mode transactions set `expiry: { unit: "hours", duration: 24 }`** — matches `insertPendingPayment`'s expiry logic.
124. **`documents/process` always downloads `document.s3Key` from the DB, never the client-supplied `s3Key`.**
125. **Sentry only auto-captures uncaught exceptions and client-side crashes** — a `console.error` inside a `try/catch` is invisible to it. Full audit still deferred — Kevin's own call, "we're going to do it later."
126. **`requireOrgAdmin()` in `lib/auth.ts`** — use for any new admin-only mutation, never a fresh Clerk membership-list call.
127. **Every mutating Server Action/Route Handler must independently re-verify permissions** — a page-level UI gate is never sufficient alone.
128. **`org:member` permission model** — conversations-only, with Documents/Team as view-only exceptions and Widget Embed fully open.
129. **Analytics uses a soft-lock (blur + overlay), not a page block, for the plan dimension.** Any CSS-only visual lock must carry `aria-hidden` on the hidden content.
130. **`payments_org_status_created_idx` is live in Neon.**
131. **`PLAN_LIMITS.chatbots`/`customBranding`/`apiAccess` are vestigial** — no corresponding feature exists. Do not write enforcement code against them. Safe to remove from `types/billing.ts` whenever that file is next touched for an unrelated reason.
132. **Org-scoped client queries need `orgId` in the query key**, sourced reactively via `useOrganization()` — never `window.Clerk?.organization?.id` for render-triggering reads.
133. **E2E tests that create persistent DB rows must clean up in `test.afterEach`**, ID captured immediately, not only at the end of the test body.
134. **When a Playwright failure looks intermittent, get the actual HTTP response/evidence before chaining hypotheses.** Applies equally to local dev-server flakiness — see rule 141.

### New Rules — Phase 16, Session 3

135. **Customer widget Pusher channel uses `private-conversation-{channelToken}` with a dedicated `/api/pusher/conversation-auth` endpoint** requiring a matching `sessionId` as a second factor against the `conversations` row. A leaked `channelToken` alone is no longer sufficient to subscribe — closes the last standing security item from the original audit. `sessionId` is sent via pusher-js's `paramsProvider`, reusing the exact `transport: "ajax"` config already proven for the dashboard's private channel (rule 113) — never invent a different transport.
136. **E2E coverage for channel auth lives in `e2e/06-pusher-channel-auth.spec.ts`** — unauthenticated suite (matches `01-public-chat.spec.ts`'s `storageState` pattern), covers wrong-sessionId (403), correct pair (200), and wrong-channel-prefix (403) cases. This suite doesn't depend on `auth.setup.ts` and can be run standalone with `--no-deps` when the setup project is flaky.
137. **Org deletion is now a 30-day grace period, not instant.** `deleteOrg()` no longer calls Clerk directly — it stamps `orgs.deletionRequestedAt` and the org keeps full access. `cancelOrgDeletion()` reverses it. Two new daily crons: `suspended-warning` (finds orgs suspended 90+ days, sends one warning email, then starts the same 30-day clock — only after the email successfully sends) and `org-purge` (finds orgs whose grace period has fully expired, actually deletes them). See Decisions section below for the full policy.
138. **`orgs.purgingAt` is an atomic claim marker** — the `org-purge` cron must claim an org via a conditional `UPDATE ... WHERE deletionRequestedAt IS NOT NULL AND purgingAt IS NULL RETURNING id` before acting on it, never act on a stale snapshot from an earlier `SELECT`. `cancelOrgDeletion()` and `activateSubscription()` must both check `purgingAt IS NULL` in their own `WHERE` clause before mutating — an org already claimed for purging can never be reactivated or have its deletion cancelled out from under the purge. This pattern closed three separate CodeRabbit-flagged races in one PR (cancel-during-purge, reactivate-during-purge-via-webhook, warning-before-clock-actually-starts).
139. **`org-purge` deletes the Clerk organization before the DB row, and treats an already-missing Clerk org (404) as success** — makes the cron safely retryable if a prior run got partway through. DB deletion runs in its own transaction; `payments.orgId` is anonymized automatically via `ON DELETE SET NULL` (rule 140) — no manual `UPDATE payments SET orgId = null` needed or wanted.
140. **`payments.orgId` is nullable with `onDelete: "set null"`**, not `cascade` — payment rows must survive org deletion for accounting retention (aggregate totals only; an anonymized payment is intentionally not queryable by org once purged — this was a deliberate decision, not an oversight, since anonymization only means something if the linkage is actually severed).
141. **`activateSubscription()` accepts an optional transaction handle** (`Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db`, same pattern as `getOrgDocumentUsageCount`) — discovered during Session 3 that it was previously always using the top-level `db` client even when called from inside the Midtrans webhook's `db.transaction()` block, silently breaking that transaction's atomicity. Fixed in the same PR as the `purgingAt` guard. The Midtrans webhook now wraps its transaction call in `try/catch`: if activation throws because the org is mid-purge, the webhook marks itself processed (stops Midtrans retries) and logs to Sentry for manual review, rather than surfacing an unhandled 500.
142. **A live-database FK constraint's actual name can silently drift from what Drizzle assumes** — confirmed again in Session 3 (`payments_org_id_fkey` in Neon vs. Drizzle's expected `payments_org_id_orgs_id_fk`). Before writing any `DROP CONSTRAINT` in a manual migration, verify the real name first: `SELECT conname FROM pg_constraint WHERE conrelid = '{table}'::regclass AND contype = 'f';`. Never assume Drizzle's naming convention matches what's actually live.
143. **`e2e/auth.setup.ts` has a known, unresolved local-only flakiness** — intermittently hangs on `page.goto("/dashboard")` after `clerk.signIn()` + `setActive()`, eventually timing out and throwing a misleading "frame was detached" error (the real cause is the navigation hanging, not a race — the detached-frame message is just Playwright's timeout-driven browser teardown surfacing as that error). Confirmed NOT caused by Clerk dev-key rate limiting (failed identically even after a 2-hour pause) or a `setActive`-triggered navigation race (adding `waitForLoadState("networkidle")` changed nothing). Most likely cause: a `next dev` server that's been hot-reloading for hours degrades and the dashboard route (heavier than most — multiple chart imports, several DB queries) needs more than the default 30s on a slow/first compile. A fresh dev server run passed clean twice in a row. Always passes reliably in CI, where the server is always freshly started. **Decision: not chased further. No code committed for this.** If revisited, start by killing any long-running local dev server and testing against a freshly started one before any other hypothesis.

---

## Phase 15 — Midtrans Payment Lifecycle (Historical Summary)

Two PRs: `feature/midtrans-payment-lifecycle` and `feature/billing-ux-refinements`. `payments` table shifted from success-only ledger to full lifecycle tracking (`pending → success/failed/expired/cancelled`). Midtrans `callbacks.finish/error/pending` added. `PaymentResultBanner` and `PendingPaymentBanner` added. Webhook handler gained non-settlement status handling. `PAYMENT_METHOD_LABELS` added. **CodeRabbit finding (Section K):** TOCTOU gap between `getPendingPayment` and `insertPendingPayment` — resolved at the DB level via `payments_org_pending_unique_idx`, confirmed live during Phase 16 Session 1's introspection.

---

## Phase 16 — Security & Reliability Stabilization (Current Phase — IN PROGRESS)

### Session 1 — Summary

Three highest-severity audit findings closed: `/api/documents/process` S3 key authorization, Midtrans webhook amount validation, migration chain baseline reset (reconciled `schema.ts` with live Neon drift). E2E test infrastructure (suspended Neon branch) recreated.

### Session 2 — Summary

Six PRs: document plan-limit enforcement (atomic `FOR UPDATE`, closes a TOCTOU race), embed-widget plan enforcement (with a `Cache-Control: private, no-cache` fix so a downgraded org's cached script can't keep working), org-member permission enforcement (`requireOrgAdmin()`, view-only Documents/Team, un-gated Widget Embed), analytics plan-based soft-lock, a missing composite index, and two bugfix PRs (stale org-scoped badge counts after org switch, E2E test cleanup for document uploads — the latter traced a real, non-flaky CI failure back to 2 months of uncleaned test data crossing a real plan limit).

### Session 3 — Summary

Three pieces of work, closing all three remaining medium-severity Open Items from the original audit.

#### PR 1 — `fix/customer-widget-channel-authorization` + `test/pusher-channel-auth-e2e`

**Gap:** The customer widget's Pusher channel (`conversation-{channelToken}`) was a public channel — no server-side authorization at subscribe time, protected only by the UUID being hard to guess. A leaked token (browser history, screenshot, log line) gave indefinite, unrevocable access to that conversation.

**Fix:** Channel renamed to `private-conversation-{channelToken}`. New `/api/pusher/conversation-auth` endpoint requires a matching `sessionId` (sent via pusher-js `paramsProvider`) against the `conversations` row before authorizing — reusing the exact `transport: "ajax"` config already proven for the dashboard's private channel. Manually verified: wrong `sessionId` → 403, correct pair → 200, no regression on takeover/return/message delivery. Followed by a small E2E test PR covering the same cases automatically. See rules 135–136.

#### PR 2 — `feat/org-deletion-grace-period` + `feat/org-deletion-settings-ui`

**Gap:** `deleteOrg()` called `client.organizations.deleteOrganization(orgId)` directly and immediately — no grace period, no way to reactivate, while all DB data sat forever with no purge mechanism (the actual Open Items concern was closer to "no retention policy" than "instant destructive delete," but the fix needed to address both the immediacy and the lack of any purge).

**Decided policy:** Explicit deletion request → 30-day grace period, full access maintained throughout, cancellable anytime. Long-term unpaid abandonment → 90 days suspended, then the same 30-day clock starts (only after a warning email successfully sends). `payments` anonymized (not deleted) for accounting retention.

**Fix:** New `orgs.suspendedAt`, `deletionRequestedAt`, `purgingAt` columns. `deleteOrg()`/`cancelOrgDeletion()` actions. Two new daily crons (`suspended-warning`, `org-purge`). `payments.orgId` changed from `cascade` to `set null`. Settings UI shows a pending-deletion banner with a cancel button instead of (or alongside) the delete button.

**CodeRabbit findings (two review rounds) — all real, all fixed:** cancel-during-purge race, reactivate-during-purge race (via the Midtrans webhook, which also surfaced a genuine pre-existing bug — `activateSubscription` wasn't using its caller's transaction handle at all), and the suspended-warning clock starting before the warning email was confirmed sent. All three closed via the `purgingAt` atomic claim-marker pattern (rules 138–141). Also fixed a live FK-name mismatch during migration application (rule 142) — same class of drift as the `payments_org_id_fkey` issue documented back in Phase 15/16 Session 1.

#### Checked, not fixed — Vercel 10s timeout vs. synchronous document processing

Investigated directly rather than guessed at: no documents stuck in `"processing"` in Neon, no matching timeout errors in Vercel's function logs. No evidence of a live problem. Left as a documented risk (rule 47), not treated as a bug requiring code changes.

#### Deferred — `e2e/auth.setup.ts` local flakiness

Investigated across several hypotheses (Clerk rate limiting, `setActive` race) — both ruled out with direct evidence. Most likely a degraded long-running local dev server; a fresh server run passed clean. Always reliable in CI. Decided not to chase further this session. See rule 143.

### Root Cause, Named Explicitly (Recurring Themes Across All Three Sessions)

1. **Manual Neon application without keeping `schema.ts`/migrations in sync** — the discipline holds when deliberately applied (proven again in Session 3 for `purgingAt`), but requires deliberate effort every time.
2. **The codebase's error-handling discipline (catch-and-log, never 500) means Sentry sees almost nothing** — still deferred, Kevin's own call.
3. **Decisions made in one PR can silently create obligations in files not touched by that PR** (named in Session 2, reconfirmed in Session 3 — the reactivation-during-purge race is exactly this pattern: the org-deletion PR didn't touch the Midtrans webhook's logic, but its new guard changed what that webhook needed to handle).
4. **CodeRabbit's suggested diff is a starting point, not a drop-in fix** — twice now (Session 2's permission gates, Session 3's transaction-handle fix) the actual fix required understanding surrounding code CodeRabbit's suggestion didn't account for.

---

## Open Items

**High severity:** None. Closed as of Phase 16 Session 1.

**Medium severity:** None remaining. All three items (Pusher channel security, org deletion/data retention, Vercel timeout vs. document processing) are closed as of Session 3 — the last one closed via direct verification rather than a code change.

**Lower priority / cleanup, do opportunistically:**
1. **Sentry blind-spot audit** — full pass across every catch block, not just the ones touched in Phase 16 so far. Explicitly deferred by Kevin: "we're going to do it later."
2. **Doc drift, cosmetic/informational only:**
   - `/billing/mock-payment` route referenced in mock-mode `redirectUrl` does not actually exist as a page
   - Message length: Bible/architecture say 500 chars, public chat actually accepts 1,000 (staff reply is still 500)
   - CSP: Bible claims full CSP configured for Clerk/Pusher/Midtrans/CloudFront; actual global headers omit CSP, only `/chat/*` gets `frame-ancestors *`
   - FK naming drift is an ongoing pattern, not a one-time fix — expect to re-verify actual constraint names in Neon before any future manual migration touching an older table (see rule 142)
   - `generateMetadata()` on the public chat page reveals org name for an inactive chatbot, undermining the slug-enumeration protection that's otherwise correctly implemented
   - `PLAN_LIMITS.chatbots`, `.customBranding`, `.apiAccess` are vestigial fields with no corresponding feature (rule 131) — safe to remove from `types/billing.ts` whenever that file is next touched for an unrelated reason
3. **`orgs.midtransCustomerId`** — confirmed dead (Midtrans has no persistent customer concept). Safe to drop whenever `orgs` is next touched for an unrelated reason.
4. **`e2e/auth.setup.ts` local flakiness** (rule 143) — unresolved, doesn't block anything since CI is unaffected. Worth a fresh look if it starts happening in CI too, or if it becomes disruptive enough to justify the time.

**Unchanged, still deferred:**
- WhatsApp/Meta integration — on hold pending Meta Business verification
- Midtrans production keys — still sandbox
- Domain purchase + Resend sender migration — still pending
- CloudFront — still post-launch
- Promo code administration — still manual via Neon SQL editor
- Quota reset / billing cycle decoupling — known limitation, not addressed
- `lib/ai/stream.ts` — still dead code, can delete anytime

---

## Decisions Made / Pending

1. **Org member permissions:** conversations-only for `org:member`, with Documents/Team as view-only exceptions and Widget Embed fully open. ✅ Decided AND implemented (Session 2).
2. **Org deletion & data retention:** 30-day grace period for explicit requests (full access maintained, cancellable anytime); 90-day-suspended abandonment triggers the same 30-day clock after a confirmed warning email; payments anonymized not deleted. ✅ Decided AND implemented (Session 3).
3. **Free-tier technical enforcement:** ✅ Resolved for documents, embed widget, and analytics. Chatbots/customBranding/apiAccess confirmed vestigial, need no enforcement. Considered complete unless a new plan-gated feature is added.
4. **Manual Neon schema drift as accepted practice:** unchanged position — the practice continues, with the caveat (reconfirmed in Session 3) that live constraint names must be verified directly before writing any `DROP CONSTRAINT`, never assumed from Drizzle's naming convention.
5. **Customer widget channel security:** private channel + sessionId second factor. ✅ Decided AND implemented (Session 3).
6. **Vercel 10s timeout vs. document processing:** investigated directly, no live issue found. ✅ Closed as "checked, not a bug" (Session 3).
7. **Next priority:** All medium-and-above items are closed. What remains is entirely opportunistic cleanup (Sentry audit, doc drift, vestigial fields) or the `auth.setup.ts` local flakiness — none of it blocking, none of it urgent. Next session can either pick from that list or move on to new feature work / the next planned phase.

---

## Coding Rules Reminder (Session 3 Additions — Also See Rules 135–143 Above)

- **Customer widget Pusher channel is now a real private channel** — see rule 135. Never revert to a bare public UUID channel for any future per-customer real-time feature.
- **`purgingAt` is the canonical atomic-claim pattern for any future cron that permanently deletes or transitions something a user-facing action might race against.** See rule 138. Reuse this pattern rather than inventing a new one.
- **Any function called from inside a `db.transaction()` block must actually accept and use the `tx` handle** — see rule 141. Check this specifically whenever wrapping an existing standalone query function in a new transaction.
- **Verify live FK/constraint names directly before writing manual migration SQL** — see rule 142. Don't trust Drizzle's assumed name for any constraint that predates full Drizzle-managed migrations.
- **CodeRabbit's suggested code is a starting point — verify it against the actual surrounding code before applying.** See rule 25 and the Session 3 root-cause notes.