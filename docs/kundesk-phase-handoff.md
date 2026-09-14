# Kundesk — Phase Handoff Document

> **Document Type:** Living document. Replace entirely after each phase completes. **Current State:** Phase 16 (Security & Reliability Stabilization) — IN PROGRESS. Nine PRs merged across two sessions, closing all three original highest-severity findings plus both items that were explicitly decided-but-not-implemented at the top of this session's Open Items list. Three medium-severity items remain open — see below. Production deployed at `kundesk.vercel.app`. **Last Updated:** September 2026 (Session 2). **Always read `kundesk-project-bible.md` before this document.**

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
26. **CodeRabbit is active** — CI (typecheck → lint → test → build + Playwright E2E) plus CodeRabbit review on every PR. CodeRabbit has repeatedly caught real, valid issues this project (TOCTOU races, missing accessibility attributes, cache-based auth bypass windows, enumeration signals) — always treat its findings as worth investigating, never dismiss without checking.
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
59. **DB indexes** — `notifications_org_created_idx ON (org_id, created_at DESC)`. `conversations_org_handoff_status_idx ON (org_id, handoff_status)`. `payments_org_status_created_idx ON (org_id, status, created_at)` (added this session — see Phase 16 PR log).
60. **RLS intentionally NOT implemented** — application-layer isolation via `requireOrg()` + `AND org_id = $orgId` is sufficient.
61. **KUN is the fixed AI identity** — name, greeting, and voice are hardcoded. Never read from `chatbots` table. `name`, `tone`, `greeting_message` columns dropped in Phase 12b. This is also why `PLAN_LIMITS.chatbots` is vestigial (see rule 133) — there was never a multi-chatbot creation flow built, because the product moved to a single fixed KUN identity per org before that feature existed.
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
124. **Any future manual Neon schema change must be mirrored in `lib/db/schema.ts` in the same sitting.** This is exactly how the original migration-chain drift happened, and nothing structurally prevents it happening again. (Followed correctly this session — see rule 132.)
125. **Midtrans real-mode transactions set `expiry: { unit: "hours", duration: 24 }`** — matches the local `payments` staleness cutoff used by `insertPendingPayment`'s expiry logic. Do not remove one without reconciling the other.
126. **`documents/process` always downloads `document.s3Key` from the DB, never the client-supplied `s3Key`** — client value is validated for exact match and rejected on mismatch, but never trusted for the actual S3 call, even as defense-in-depth.
127. **Sentry (`sentry.server.config.ts` etc.) only auto-captures uncaught exceptions and client-side crashes** — it does NOT capture anything from a `console.error` inside a `try/catch`, which is this codebase's dominant error-handling pattern. Only two call sites (`documents/process` s3Key mismatch, midtrans webhook amount mismatch + fraud flag) have explicit `Sentry.captureMessage` calls as of Phase 16 Session 1. A full audit of every other catch block is deferred — see Open Items.

### New Rules — Phase 16, Session 2

128. **`requireOrgAdmin()` in `lib/auth.ts`** — the org-admin equivalent of `requireOrg()`. Reads `orgRole` directly off the same `auth()` call already used everywhere — confirmed via direct testing that Clerk's session claims include `orgRole` with values `"org:admin"` / `"org:member"`, no extra Clerk API round-trip needed. Use this (not a fresh `client.organizations.getOrganizationMembershipList()` call) for any new admin-only mutation. The one exception is `lib/actions/team.ts`, which legitimately needs a live Clerk fetch because its own actions mutate membership itself — that pattern should NOT be copied elsewhere now that `requireOrgAdmin()` exists.
129. **Every Server Action/Route Handler that mutates data must independently re-verify permissions — a page-level UI gate (`AccessRestricted`, hidden nav item, hidden button) is NEVER sufficient on its own.** This was violated twice in the same PR during Session 2 (`saveChatbotConfig`/`saveQuickReplies`/`saveAccentColor` and `updateOrgProfile` were left on `requireOrg()` after their pages were gated) and caught by CodeRabbit both times. The page gate stops normal navigation; the action-level gate is the actual security boundary — a devtools `fetch()` call or a stale form submission bypasses any UI-only gate entirely.
130. **`org:member` permission model (Phase 16 decision, now implemented):**
    - **Fully admin-gated pages** (page-level `AccessRestricted` + action-level `requireOrgAdmin()`): Billing, Settings, Analytics (partially — see rule 131), Chatbot Config.
    - **View-only for members** (page visible, no page gate, but mutating actions/controls gated/hidden): Documents (members can view the knowledge base and chunk counts; upload and delete require `requireOrgAdmin()` and are hidden from the UI entirely for members), Team (members can see the member list; invite/role-change/remove require admin — this was already correctly built before Session 2 in `lib/actions/team.ts`, serves as the reference pattern for "view yes, mutate no").
    - **Fully open to members, no gating at all:** Dashboard Overview (business awareness), Conversations (their actual job), Widget Embed (QR code, shareable link, and embed script are non-sensitive, read-only, and were never actually named in the original Phase 16 decision — do not gate this page; it was mistakenly flagged `adminOnly` mid-session and correctly reversed).
    - Any UI control whose action is admin-only must ALSO be conditionally hidden for members in the same PR — this includes cross-cutting controls easy to miss, e.g. the sidebar's "Upgrade ke Pro" CTA (links to admin-only Billing) and the Topbar's accent-color picker (calls `saveAccentColor`, which is admin-only) — both were missed on first pass and caught by CodeRabbit / self-review.
131. **Analytics uses a soft-lock pattern, not a hard page gate, for the plan dimension.** Role gate (member vs admin) is a hard `AccessRestricted` page block. Plan gate (Free vs Starter/Pro) is a per-card blur-and-upsell, NOT a page block — Free-tier admins can see the full Analytics page (KPI strip, channel breakdown, volume/response-time trends), but `HandoffInsightCard`, `TopQuestionsCard`, and `PeakHoursCard` are locked via `LockedFeatureOverlay`. Card titles/subtitles always render regardless of plan; only the data body is blurred. `clusterTopQuestions()` (real OpenAI cost) is skipped entirely server-side when locked — never fetch-then-hide for anything with a real API cost behind it. Locked content containers must have `aria-hidden={locked}` — CSS blur alone (`blur-sm`, `pointer-events-none`) does NOT remove content from the accessibility tree, so a screen reader would otherwise read out the exact data being visually hidden. This was caught by CodeRabbit, not anticipated in the original design — always check ARIA implications of any visual-only lock/blur pattern.
132. **`payments_org_status_created_idx` (org_id, status, created_at) is now live in Neon** — created via `CREATE INDEX IF NOT EXISTS` directly in the Neon SQL editor, declared in `schema.ts`, and captured in `lib/db/migrations/0001_lively_franklin_richards.sql` (historical record only — like `0000_equal_brood.sql`, this file must never actually be run against Neon; it exists purely so `schema.ts` and the migration chain stay reconciled per rule 124). The migration file uses `CREATE INDEX IF NOT EXISTS`, not a bare `CREATE INDEX` — a bare version would hard-fail with an existing-relation error if `drizzle-kit migrate` were ever genuinely run against this database, since the index already exists from the manual apply. Any future historical-record-only migration documenting an already-applied manual change must use the same `IF NOT EXISTS` guard.
133. **`PLAN_LIMITS.chatbots`, `PLAN_LIMITS.customBranding`, and `PLAN_LIMITS.apiAccess` are confirmed vestigial — no corresponding feature exists anywhere in the codebase.** `chatbots` is a leftover from before KUN became a single fixed identity per org (see rule 61) — there is no multi-chatbot creation UI or action anywhere. `customBranding` and `apiAccess` were directly confirmed by Kevin to correspond to nothing ever built. Do not write enforcement code against any of these three fields — there is nothing to enforce. If `PLAN_LIMITS` is ever touched for an unrelated reason, these three fields are safe to remove, but removing them was intentionally left out of scope this session to avoid unrelated churn in a security-focused PR.
134. **Client-side `useQuery` keys that read org-scoped data MUST include `orgId` in the key array**, sourced reactively via Clerk's `useOrganization()` hook (`const { organization } = useOrganization(); const orgId = organization?.id;`) — never `window.Clerk?.organization?.id` for this purpose, since that doesn't trigger a React re-render on org switch (that raw-window pattern is only acceptable for one-off imperative reads outside React's render cycle, e.g. Pusher channel subscription setup in `DocumentsPage.tsx`). Missing `orgId` in the key means `OrganizationSwitcher`-driven org changes silently keep serving the previous org's cached value until a manual refresh forces a full remount. Found and fixed in `DocCountBadge.tsx` and `ConversationCountBadge.tsx` (both of its queries) this session. Gate the query with `enabled: !!orgId` so it doesn't fire with an undefined org mid-switch. This does NOT require changing any `invalidateQueries` calls elsewhere (e.g. in `PusherProvider.tsx`) as long as those calls use a partial key with no `exact: true` — TanStack Query's default prefix-match behavior still correctly matches the now-longer, orgId-suffixed key.
135. **E2E tests that create persistent DB rows (documents, conversations, chatbots, etc.) MUST clean up after themselves in `test.afterEach`, capturing the created ID in a `describe`-scoped variable as soon as it's known** — not only at the end of the test body, since an assertion failure earlier in the test would otherwise skip cleanup entirely. This is not optional cosmetic hygiene: `03-document-upload.spec.ts` had no cleanup since it was written, silently accumulating rows in the shared `klinik-paco` E2E org (Starter plan, 20-document limit) across every CI run for the project's lifetime. Once the count crossed 20, the document plan-limit enforcement shipped this session began correctly rejecting the test's own upload — surfacing as an apparently flaky, intermittent CI failure that took significant back-and-forth to root-cause, when the actual cause was accumulated test data crossing a real, correctly-functioning limit, not a bug in the application or a timing flake. Confirmed by manually clearing the E2E org's `documents` table in Neon, after which CI passed immediately. **Any new feature that adds a plan limit or quota should prompt an audit of whether existing E2E tests create rows against that same resource without cleanup** — this class of bug will recur silently otherwise.
136. **When a Playwright failure looks intermittent/flaky, do not assume infra flakiness by default and do not chain multiple unverified hypotheses.** Sequence that actually works: (1) check whether the failing test touches any file changed in the current session — if not, a single clean re-run is reasonable evidence of real flakiness; (2) if it does touch changed code, get the actual HTTP response (status + body) from the failed request before theorizing — via the Playwright trace viewer/artifact, not by rebuilding request logic from memory; (3) only after direct evidence, form one hypothesis and check it, rather than stacking a second and third hypothesis on top of an unconfirmed first one. Session 2 burned significant time chaining theories (document count → admin role → rate limiting → dev-server compile timing) before the actual root cause (rule 135) was found by directly inspecting the database state.

---

## Phase 15 — Midtrans Payment Lifecycle (Prior Session — Summary Retained)

> Full detail preserved from the prior handoff for reference. Two PRs: `feature/midtrans-payment-lifecycle` and `feature/billing-ux-refinements`. Both merged and tested live in production before this session began.

**Core changes:** `payments` table shifted from success-only ledger to full lifecycle tracking (`pending → success/failed/expired/cancelled`), with `insertPendingPayment`, `markPaymentSuccess` (UPDATE + INSERT fallback), `markPaymentClosed`, `getPendingPayment`, `cancelPendingPayment` added to `lib/db/queries/billing.ts`. `createPayment`'s same-day lock replaced by the pending-payment check. Midtrans `callbacks.finish/error/pending` added to fix the redirect-back-to-`/billing` issue. `PaymentResultBanner` (one-time, query-param-driven) and `PendingPaymentBanner` (persistent, DB-row-driven) both added. Webhook handler gained non-settlement status handling (`expire`/`cancel`/`deny` → `markPaymentClosed`). Two new lifecycle emails (`PaymentPendingEmail`, `PlanUpgradedEmail`). `PAYMENT_METHOD_LABELS`/`getPaymentMethodLabel` replaced the old `formatPaymentMethod`. `CurrentPlanCard` got a 100%-quota badge and a corrected "Reset Kuota" date via `getNextMonthFirstDay()`.

**CodeRabbit finding at the time (Section K):** TOCTOU gap between `getPendingPayment` and `insertPendingPayment` was flagged. **Phase 16 Session 1's investigation found this was already resolved at the DB level** — a partial unique index (`payments_org_pending_unique_idx`) exists live in Neon and is already handled by a `23505` catch in `createPayment` — but this was never documented in Phase 15's decision log, which incorrectly states "no unique constraint was added." See rule 120.

**Full file-change list and prior Open Items are preserved below in the original Phase 15 record.**

---

## Phase 16 — Security & Reliability Stabilization (Current Phase — IN PROGRESS)

### Session 1 — Context and Summary

Kevin returned after a 2-month gap with a detailed external audit comparing documentation claims to actual code. Session 1 worked through the three highest-severity findings end to end:

- **PR 1 — `fix/document-process-s3-key-authorization`** — `/api/documents/process` now always downloads `document.s3Key` from the DB, never the client-supplied value. Hard reject (400) on mismatch, logged via `console.error` AND `Sentry.captureMessage`.
- **PR 2 — `fix/midtrans-webhook-amount-validation`** — webhook handler now compares `notification.gross_amount` against the recorded `payments.amount` before activating a subscription. Renewal cron gap (zero amount validation on renewals — no pending row existed to compare against) found via CodeRabbit and fixed in the same PR.
- **PR 3 — `fix/migration-chain-baseline-reset`** — reconciled `lib/db/schema.ts` with live Neon (partial unique index on `payments`, undocumented CHECK constraints + case-insensitive index on `promo_codes`, undeclared HNSW index on `chunks`), archived the broken migration folder, generated a clean `0000_equal_brood.sql` baseline.
- **Incidental fix** — E2E test infrastructure (Neon `e2e-test` branch had auto-suspended after 2 months of inactivity) recreated and reconciled in the same session.

Full detail on these three PRs is preserved in the prior handoff version; not repeated here to keep this document from growing unbounded. The **Root Cause, Named Explicitly** analysis from Session 1 (manual Neon application without `schema.ts` sync as a systemic pattern; Sentry only capturing uncaught exceptions as a second systemic pattern) remains accurate and unchanged by Session 2's work.

### Session 2 — Summary

Six PRs merged, closing the two highest-priority Open Items carried forward from Session 1 (#1 plan enforcement, #2 org member permissions) completely, plus #3 (missing index), plus two bugs found during manual verification of the above.

#### PR 4 — `feat/document-plan-limit-enforcement`

**Gap:** `PLAN_LIMITS.documents` was declared but never enforced — Free-tier orgs could upload unlimited documents.

**Fix:**
- New `lib/db/queries/documents.ts` — `getOrgDocumentUsageCount(orgId, dbOrTx?)`, counts `processing` + `ready` documents (excludes `failed`, which never consumed a real slot). Accepts an optional transaction handle, extracted via `Parameters<Parameters<typeof db.transaction>[0]>[0]` (zero-`any`, always matches the real driver type).
- `api/documents/upload/route.ts` — plan check + document count + insert now run inside one `db.transaction()` with `SELECT ... FOR UPDATE` locking the org row. This closes a CodeRabbit-flagged TOCTOU race: a plain count-then-insert allowed two concurrent uploads to both pass the check and both insert, exceeding the limit. Confirmed fixed via an actual two-tab concurrent upload test, not just code review — second tab correctly rejected once the first tab's insert committed.
- New `app/api/documents/usage/route.ts` — additive endpoint (`{ used, limit }`) for a dashboard usage banner. Kept separate from `GET /api/documents` (the list endpoint) specifically to avoid changing that response's shape and breaking `DocumentsPage.tsx`'s existing `useQuery(["documents"])` consumer, which expects a flat array. `Infinity` (Pro/unlimited) is explicitly converted to `null` before serialization.
- `DocumentsPage.tsx` / `UploadZone.tsx` — usage banner, disabled dropzone at limit. Header uses `usage.used` (server-truth), not `visibleDocuments.length` (client-filtered, can undercount due to in-flight-upload dedup) — CodeRabbit finding, fixed.

#### PR 5 — `feat/embed-widget-plan-enforcement`

**Gap:** `PLAN_LIMITS.embedWidget` was declared but never enforced — Free-tier orgs could load a fully working embed `<script>` widget on their own website. QR code and shareable link (also on the Widget page) were never part of this gap — those remain free-tier-available by design (Project Bible Section 12).

**Fix:**
- `api/widget/route.ts` — plan check added right after the org lookup (before the chatbot query, to avoid wasted work on disqualified requests). Rejection uses the same generic `404`/`// Not found` body as the existing org-not-found and chatbot-inactive branches — CodeRabbit correctly flagged that the three cases previously had distinguishable bodies (`// Org not found`, `// Chatbot not active`, and a would-be `// Not found`), which is an enumeration signal inconsistent with Layer 10's slug-enumeration protection elsewhere. Unified to one generic body across all three.
- **`Cache-Control` changed from `public, max-age=300, stale-while-revalidate=600` to `private, no-cache`** — CodeRabbit major finding: a plan-gated response must never be publicly cached, or a downgraded org's cached script keeps working past the downgrade for up to the cache TTL, silently bypassing the check entirely. This is a correctness-over-performance tradeoff that's non-negotiable once the endpoint is authorization-gated.
- `lib/actions/chatbot.ts`'s `getWidgetData()` now also returns `plan` (added to the existing `orgs` join, no new query).
- `WidgetPage.tsx` — embed tab shows a locked/upgrade state instead of the code block for Free-tier, replacing what was previously a purely decorative "Starter & Pro" badge that never actually checked anything.

#### PR 6 — `feat/org-member-permission-enforcement`

**Gap:** Phase 16's own audit had already *decided* `org:member` should be conversations-only, but no code enforced it — members could access billing, settings, chatbot config, and document management identically to admins.

**Fix — see rules 128–130 above for the full permission model.** Key points not fully covered by the rules:
- New `requireOrgAdmin()` in `lib/auth.ts` (rule 128).
- New `AccessRestricted` component — renders in place of a gated page at the same URL, no redirect, with a "Kembali ke Dashboard" link. Deliberately generic/non-diagnostic messaging (no leak of *why*, consistent with the widget's enumeration-avoidance pattern).
- Sidebar (`NavItem.adminOnly`, filtered in `SidebarContent.tsx`) hides admin-only links from members' rendered HTML entirely, not just via CSS.
- Two CodeRabbit findings required a second commit on this same PR: `saveChatbotConfig`/`saveQuickReplies`/`saveAccentColor` (`lib/actions/chatbot.ts`) and `updateOrgProfile` (`lib/actions/settings.ts`) were left on `requireOrg()` after their pages were gated — the page gate alone does not protect a direct Server Action call. Fixed by switching those five mutations to `requireOrgAdmin()`. This is the concrete example behind rule 129.
- Self-review (prompted by Kevin, not CodeRabbit) also caught: the sidebar's "Upgrade ke Pro" CTA linked to now-gated Billing, and the Topbar's accent-color picker called an now-admin-only action — both hidden for members in the same PR.
- **Verified end-to-end with a real second Clerk user**, not role-spoofing: Kevin invited `developer.kevinkun@gmail.com` via the Team page's real invite flow, accepted the invitation from a clean/incognito session (the first attempt failed because the invitation link was opened while already signed in as admin — Clerk silently reused the existing admin session rather than processing the invitation ticket; documented as a testing-process gotcha, not a bug), and confirmed sidebar filtering, page gates, and the Documents/Team view-only behavior all worked correctly from that member's actual authenticated session.

#### PR 7 — `feat/analytics-plan-based-feature-lock`

**Gap:** `PLAN_LIMITS.analytics` was declared but never enforced — Free-tier admins (post PR 6, only admins could reach this page at all, but any-plan admins) saw the full Analytics page with no plan distinction.

**Fix — see rule 131 above for the full pattern.** Product decision made explicitly during this session: rather than block the whole page, only three cards (`HandoffInsightCard`, `TopQuestionsCard`, `PeakHoursCard`) are locked via blur + `LockedFeatureOverlay`; KPI strip, channel breakdown, and both trend charts remain fully visible on Free. `clusterTopQuestions()` (real OpenAI cost) is skipped server-side when locked. Two CodeRabbit findings: (1) `orgs.plan` is unconstrained `text`, so an unexpected value would make `PLAN_LIMITS[plan]` `undefined` and crash the page — fixed with explicit normalization (`rawPlan === "starter" || rawPlan === "pro" ? rawPlan : "free"`), never trust an `as PlanName` cast as runtime validation; (2) CSS blur does not remove content from the accessibility tree — `aria-hidden={locked}` added to both real-data-blurred cards.

During this same investigation, `PLAN_LIMITS.chatbots`, `customBranding`, and `apiAccess` were confirmed vestigial (rule 133) — no code changes needed for these three, closing out the remainder of Open Item #1 as "nothing left to enforce," not "still open."

#### PR 8 — `fix/payments-org-status-created-index`

Closed Open Item #3. See rule 132. One CodeRabbit finding (missing `IF NOT EXISTS` guard on the historical-record migration file) — fixed.

#### PR 9 — Bug fixes found during manual verification (two small PRs)

- **`fix/stale-org-scoped-badge-counts`** — `DocCountBadge.tsx` and `ConversationCountBadge.tsx` showed stale counts after switching orgs via `OrganizationSwitcher`. Root cause and fix: rule 134. Found by Kevin during manual testing of PR 6, not part of the original scope — correctly treated as a separate, small PR rather than bundled into the permissions PR.
- **`fix/e2e-document-upload-cleanup`** — root-caused a real, non-flaky CI failure. Full story: rules 135–136. `03-document-upload.spec.ts` now deletes its created document in `test.afterEach`.

### Root Cause, Named Explicitly (Session 1, Still Accurate)

Two systemic patterns explain most of what Session 1 found, and remain the frame for understanding Session 2's issues too:

1. **Manual Neon application without keeping `schema.ts`/migrations in sync** — correctly followed this session for the new index (rule 132), proving the discipline holds when deliberately applied.
2. **The codebase's error-handling discipline (catch-and-log, never 500) means Sentry sees almost nothing** — unchanged, still deferred (Open Item #7 below).

A third pattern emerged specifically in Session 2, worth naming for future sessions: **decisions made in one PR can silently create obligations in files not touched by that PR.** Enforcing a new plan/role limit on a resource (documents, embed widget, analytics) can retroactively turn previously-harmless behavior elsewhere (an E2E test that never cleaned up its own rows, a UI control that called a now-restricted action, a cache header that was fine when the response wasn't authorization-sensitive) into a real bug or regression. **After shipping any new enforcement gate, deliberately ask "what else in the codebase assumed this was always allowed?"** rather than only checking the direct feature surface.

---

## Open Items — Carried Forward, Not Yet Started

**High severity:** None remaining. All three items from the original audit (plan enforcement, org member permissions, missing index) are now closed as of Session 2.

**Medium severity:**
1. **Org deletion / data retention — decision still not finalized.** Current behavior only flips `subscriptionStatus` to `cancelled`; no `deletedAt`, no actual deletion or anonymization of documents/chunks/messages/PII. Leaning toward soft-delete + grace period + scheduled hard-delete (industry-standard pattern, likely UU PDP compliant), with `payments` anonymized-not-deleted for accounting retention — but not committed to yet. This needs a real decision conversation before any code — same as the Documents view-vs-mutate question needed resolving before PR 4/6 could proceed correctly.
2. **Public Pusher channel security** — customer widget channels rely on UUID (`channelToken`) secrecy alone, no expiry or revocation mechanism.
3. **Synchronous document processing vs. Vercel Free's 10s function limit.** Current code has a 55s in-process race timeout, which structurally cannot fit inside a 10s Vercel Free function limit if that limit is actually being enforced in production. Needs deployment-runtime confirmation (check actual production behavior/logs), not more code reading.

**Lower priority / cleanup, do opportunistically:**
4. **Sentry blind-spot audit** — see rule 127. Full pass across every catch block in the codebase, not just the two touched in Phase 16 Session 1. Explicitly deferred by Kevin's own call: "we're going to do it later."
5. **Doc drift, cosmetic/informational only:**
   - `/billing/mock-payment` route referenced in mock-mode `redirectUrl` does not actually exist as a page
   - Message length: Bible/architecture say 500 chars, public chat actually accepts 1,000 (staff reply is still 500)
   - CSP: Bible claims full CSP configured for Clerk/Pusher/Midtrans/CloudFront; actual global headers omit CSP, only `/chat/*` gets `frame-ancestors *`
   - FK naming drift: live `payments_org_id_fkey` vs. Drizzle's auto-generated `payments_org_id_orgs_id_fk` — cosmetic, will resurface as a rename suggestion on the next real `drizzle-kit generate`, safe to ignore
   - `generateMetadata()` on the public chat page reveals org name for an inactive chatbot, undermining the slug-enumeration protection that's otherwise correctly implemented
   - **New this session:** `PLAN_LIMITS.chatbots`, `.customBranding`, `.apiAccess` are vestigial fields with no corresponding feature (rule 133) — safe to remove from `types/billing.ts` whenever that file is next touched for an unrelated reason, but intentionally left in place this session to avoid unrelated churn in security-focused PRs.
6. **`orgs.midtransCustomerId`** — confirmed dead (Midtrans has no persistent customer concept). Safe to drop whenever `orgs` is next touched for an unrelated reason. Not urgent.

**Unchanged from Phase 15, still deferred:**
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
2. **Org deletion:** leaning soft-delete + grace period + scheduled purge, payments anonymized not deleted. ⏳ Still not finalized — top candidate for next session's real decision-making work.
3. **Free-tier technical enforcement:** ✅ Resolved for documents, embed widget, and analytics (soft-lock pattern). Chatbots/customBranding/apiAccess confirmed to need no enforcement (vestigial). Plan enforcement as a category is now considered complete unless a new plan-gated feature is added in the future.
4. **Manual Neon schema drift as accepted practice:** unchanged position — the practice continues, but Session 2's index addition (rule 132) demonstrates the discipline of syncing `schema.ts` in the same sitting can be followed correctly when deliberately applied.
5. **Next priority:** ✅ All three original high-severity items closed. Recommended next: either the org deletion decision (#2 above, needs a real conversation before code), or Pusher channel security (Open Item #2 in the medium list) — both are self-contained and don't risk the kind of multi-day investigation the E2E flakiness did this session. The Vercel timeout item (Open Item #3) needs Kevin to check production directly before any code work makes sense.

---

## Coding Rules Reminder (Session 2 Additions — Also See Rules 128–136 Above)

- **`requireOrgAdmin()` exists now** — use it for any new admin-only mutation. See rule 128.
- **Page-level gates are never sufficient alone — always also gate the underlying Server Action/Route Handler.** See rule 129. This was missed twice in one PR this session; make it a standing checklist item for any future permission work.
- **The `org:member` permission model is now fully documented and implemented** — see rule 130 for the definitive per-page breakdown before assuming a page needs gating.
- **Analytics plan-gating is a soft-lock (blur + overlay), not a page block** — see rule 131. Any CSS-only visual lock must also carry `aria-hidden` on the hidden content.
- **`payments_org_status_created_idx` is live** — see rule 132.
- **`PLAN_LIMITS.chatbots`/`customBranding`/`apiAccess` are vestigial — do not write enforcement code against them.** See rule 133.
- **Org-scoped client queries need `orgId` in the query key, read reactively via `useOrganization()`.** See rule 134.
- **E2E tests that create DB rows must clean up in `afterEach`, ID captured immediately.** See rule 135.
- **Don't chain unverified hypotheses on a "flaky" Playwright failure — get the actual HTTP response first.** See rule 136.