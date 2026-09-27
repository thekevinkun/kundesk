# Kundesk — Phase Handoff Document

> **Document Type:** Living document. Replace entirely after each phase completes. **Current State:** Phase 17 (Structured Business Knowledge) — Session 3 complete. Session 1 built the entire backend (schema, compile helpers, sync layer, Server Actions, profile-in-prompt, opening-hours logic). Session 2 built and shipped the dashboard UI end to end: the Profil/Dokumen/Katalog & FAQ tabs shell, the business profile form, section/entry management, the stale-sync retry banner, and Session 1's deferred E2E test. **Session 3 was an unplanned but necessary UI/UX overhaul of the "Info Bisnis" page**, triggered by Kevin correctly rejecting Session 2's three-tab structure and a design-inspiration mockup he supplied mid-session: the top-level tab is now "Isi Manual" (renamed from "Profil") vs. "Dokumen" (default active tab), and "Isi Manual" itself was restructured into four real sub-tabs (Identitas & Kontak / Jam Operasional / Metode Pembayaran / Katalog & FAQ) with a shared numbered-card visual shell, replacing an initial scroll-jump "Navigasi Cepat" bar that didn't earn its place. A real state-management bug (`KnowledgeSectionsPanel` remounting to stale data on tab switch) was caught and fixed before shipping, not after. A full mobile-responsiveness pass was also done, split between Claude and Kevin. Two PRs this session, both merged, both through CI + CodeRabbit. One thing is **still not resolved**, unchanged from Session 2: a possible race in `lib/knowledge/sync.ts` that may, rarely, leave a catalog section with two "synced" entries but no summary chunk. **Session 4 is now the planned manual, deliberate, step-by-step real-world testing of the whole Phase 17 feature** — not more automated tests, but Kevin actually using it and Claude connecting whatever breaks back to its likely source, starting with trying to reproduce the sync.ts question on purpose. **Last Updated:** September 2026 (Phase 17 Session 3). **Always read `kundesk-project-bible.md` before this document.**

---

## Instructions for Claude (Read First)

1. Read the Project Bible completely before reading this document
2. This document tells you the current build state and what to do next
3. Do NOT guess missing information — ask Kevin to paste files or confirm details
4. Do NOT start writing code until you've confirmed understanding of current state
5. After a phase completes, rewrite this entire document — only when Kevin says so
6. Keep the Project Bible untouched — only this document changes between phases. **Exception, Session 5 (Phase 16):** Kevin explicitly asked for a small, factual doc-drift correction to the Bible (Section 6 message-length/CSP claims, Section 7 subscription lifecycle steps) — three targeted line edits, not a rewrite. The Bible otherwise stays untouched by default; this was a deliberate one-off, not a change to the standing rule.
7. The learning approach matters — explain how things connect before writing code, not after
8. Never rewrite an entire file just to make a small change — tell Kevin which specific line to add/replace/remove UNLESS a full overhaul is truly needed. State this clearly when doing a full rewrite.
9. Always work on a feature branch — never push directly to master. Branch → PR → CI → merge. Only trivial chores (metadata, typos, accessibility fixes) go directly to master. Even small, mechanical-looking fixes (a single missing index, a one-line query-key fix) go through a PR if they touch production schema, security enforcement, or CI reliability — the ceremony can be lightweight, but the review step stays.
10. Every new PR needs a description filled in markdown — title is auto-filled from commit; description must always be written. Never skip this. **Always give PR descriptions as a plain markdown code block directly in chat — never as a file attachment.** Kevin copies it straight from the chat window.
11. Always explain concept first (1–3 sentences), how it connects to what Kevin knows, then write code with inline comments.
12. Before writing any UI code — read `/mnt/skills/public/frontend-design/SKILL.md` first.
13. Always use `npm run typecheck`. Then `npm run lint` before committing.
14. ALWAYS ask to see an existing file before rewriting or modifying it. Never assume what's in a file — ask Kevin to paste it first. **Claude has no direct access to Kevin's repo or local machine — Claude gives exact code/diffs in chat; Kevin applies, commits, and pushes himself.** **Session 2 note:** this rule caught real bugs twice that session precisely because it was followed. **Session 3 reconfirmed it again**, twice: restyling `ContactsEditor`/`PaymentMethodsEditor`/`HoursScheduleBlock`/`HoursLineRow` only after seeing their real source avoided guessing at markup that turned out to have specific width/layout constraints (fixed 160px columns, 110px time inputs actually needed 150px); and Claude explicitly declined to touch `SectionRow.tsx`/`SectionDialog.tsx`/`EntryDialog.tsx`/`PriceEditor.tsx` for the mobile-responsive pass because it had never seen them, leaving that portion to Kevin rather than patch blind.
15. After CI passes — THEN write the handoff document. Never write it before merge.
16. Answer conversationally in chat — never dump walls of markdown mid-build unless Kevin explicitly asks for a document. This is a conversation, not a document session by default.
17. When making surgical changes to existing files — specify EXACTLY which lines to change, what to replace, and what to add. Never force a full rewrite unless truly necessary. **Session 3 example of stating this clearly, as required:** the very first `KnowledgePage.tsx` change (removing the third tab) was flagged explicitly as a full-file rewrite, not a diff, because the tab count and content nesting both changed at once — not just a line or two.
18. All animation variants must live in `lib/animations.ts` — never inline in components. Use `variants` pattern: `variants={x} initial="hidden" animate="visible"`.
19. Framer Motion `ease` arrays must be typed as `[number, number, number, number]` tuples to satisfy TypeScript strict mode.
20. Vitest mock classes with `function` keyword — never arrow functions. Arrow functions cannot be used with `new`, causing "is not a constructor" errors.
21. When writing tests for functions that use `useCallback` — always verify the dependency array includes all values the callback reads. Stale closures cause silent bugs in production and incorrect test behaviour.
22. Before adding a build step to CI — cross-reference the full `.env` against `lib/env.ts` required fields. Add ALL required vars as fake placeholders upfront. Never add them one-by-one after repeated failures.
23. CI env vars: avoid credential-shaped placeholders in `DATABASE_URL` (e.g. `fake:fake@`) — use `postgresql://placeholder-host/placeholder-db` format to avoid secret-scanner false positives (CKV_SECRET_4).
24. Shared CI env vars belong in `jobs.<job>.env` — not duplicated across individual steps.
25. **CodeRabbit is active** — CI (typecheck → lint → test → build + Playwright E2E) plus CodeRabbit review on every PR. CodeRabbit has repeatedly caught real, valid issues this project — always treat its findings as worth investigating, never dismiss without checking, and never apply its suggested diff verbatim without checking it actually fits the surrounding code. **Session 2 reconfirmed this twice more:** the profile form PR (unstable list keys, a data-loss bug in the midnight toggle) and the stale-sync banner PR (a Major starvation bug in `retryStaleKnowledgeSync` itself, plus two Minor findings) — all still-valid, all fixed in the same PR they were raised on. **Session 3's two PRs both passed CodeRabbit clean** — no findings reported by Kevin on either the tab-merge PR or the sub-tabs/mobile-responsive PR.
26. **E2E tests use `page.evaluate(fetch(...))` for all authenticated API calls** — the `request` fixture has no Clerk session. Never use `request.get/post` for protected routes in E2E tests. **Session 2 exception, deliberate and documented:** `e2e/07-knowledge-limits-and-isolation.spec.ts` imports `db` + schema directly into the test's own Node context instead, because knowledge mutations are Server Actions with no REST route to `fetch()` against at all — see rule 199.
27. **`test.use()` must be called at `describe` level** — never inside a `test()` function. Playwright throws immediately if called inside a test.
28. **Vitest excludes `e2e/` folder** — `vitest.config.ts` has `exclude: ["node_modules", ".next", "e2e"]`. Never remove this — Playwright spec files use `@playwright/test` not Vitest, and Vitest will crash trying to run them.
29. **Playwright browser cache** — CI caches `~/.cache/ms-playwright` keyed on `package-lock.json` hash. First run downloads Chromium (~200MB), subsequent runs use cache. Don't remove the cache step from CI.
30. **E2E workers in CI** — `playwright.config.ts` sets `workers: process.env.CI ? 2 : 1`. Locally: 1 worker (sequential, avoids Clerk rate limits). CI: 2 workers (parallel). Never increase back to 4.
31. **SSE stream `conversationId`/`channelToken` extraction** — the `/api/chat` endpoint sends `{ done: true, conversationId, channelToken, handoffStatus }` as the final SSE event. E2E tests parse this to get both values without needing a list API route.
32. **E2E filename uniqueness** — document upload tests use `test-faq-${Date.now()}.txt` as the filename. Never use a fixed filename — accumulated test runs create multiple rows and trigger Playwright strict mode violations. **Session 2 reused the same `Date.now()`-uniqueness idea for section/entry titles in the new knowledge E2E file, and for the foreign-org id in the isolation test.**
33. **PostgreSQL `AT TIME ZONE` operator inverts on `timestamptz`** — `timestamptz AT TIME ZONE 'Asia/Makassar'` converts FROM that zone TO UTC, not the other way. Always use the function form: `timezone('Asia/Makassar', created_at)` to convert TO local time.
34. **All time-grouped DB queries accept a `timezone` string param** — never hardcode `'Asia/Makassar'` or any timezone in queries. Read it from `getOwnerTimezone()` in the Server Component and pass it down.
35. **`react-markdown` is installed** — use `<ReactMarkdown>` with `prose-bubble` CSS class for all chat message content. Never use manual `content.split("\n").map(...)` pattern.
36. **`ChatHeader` is hidden inside iframe** — uses `useEffect` + `useState` to detect `window.self !== window.top` after mount. Never use `if (typeof window !== 'undefined')` directly in render — causes SSR hydration mismatch.
37. **Widget `X-Frame-Options`** — `/chat/:path*` routes override the global `SAMEORIGIN` header with `ALLOWALL` + `frame-ancestors *` CSP. This is intentional — the chat page must be embeddable in the widget iframe. **Note (Session 5, Phase 16):** there is no global `Content-Security-Policy` currently configured at all — only this `/chat/*` override exists. The Project Bible previously claimed a full CSP for Clerk/Pusher/Midtrans/CloudFront; that was doc drift, corrected in that session.
38. **Promo code lookup uses `LOWER()` SQL function** — never `ilike()`. Always use `` sql`LOWER(${promoCodes.code}) = LOWER(${code})` `` for exact case-insensitive match.
39. **`usedCount` increments in webhook handler, not in `createPayment` action** — abandoned checkouts must not burn promo quota.
40. **Promo ID encoded in `order_id`** — format: `KUNDESK-{orgSlice}-{PLAN}-{timestamp}-P{promoId}`. Never change the order_id format without updating the webhook parser.
41. **Sound notifications** — `useSoundNotification` hook plays audio client-side. Browser autoplay policy blocks audio until user interacts with the page — fails silently, never crash the dashboard.
42. **Neon serverless cold start** — notification API routes wrap DB calls in try/catch and return graceful empty responses on `ETIMEDOUT`. Never let a cold-start timeout surface as a 500.
43. **`fireMockWebhook` accepts optional `amount` param** — defaults to `PLAN_PRICE[plan]` for backward compatibility.
44. **Redis caching** — org data cached under `kundesk:cache:org:slug:{slug}` AND `kundesk:cache:org:id:{orgId}` (TTL 5 min). Chatbot config cached under `kundesk:cache:chatbot:{orgId}` (TTL 10 min). Both keys must be invalidated together via `invalidateOrgCache(orgId)`.
45. **`invalidateOrgCache(orgId)`** — reads the cached org to get the slug, then deletes both `orgBySlug` and `orgById` keys atomically.
46. **Embedding batching** — `batchedAsync(chunks, 10, embedText)` — never `Promise.all` directly on embedding calls.
47. **Document processing timeout** — `app/api/documents/process/route.ts` wraps the pipeline in `Promise.race` against a 55-second timeout. `markFailed()` is called ONCE in the outer catch — never inside `runProcessingPipeline`. **Checked in Phase 16 Session 3 against Vercel's 10s free-tier function limit: no evidence of a live problem — left as a documented risk, not an active bug.** **Session 5 (Phase 16) note:** the 55s `AbortSignal` is now correctly propagated all the way into the PDF OCR fallback path.
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
60. **KUN is the fixed AI identity** — name, greeting, and voice are hardcoded. Never read from `chatbots` table. `name`, `tone`, `greeting_message` columns dropped in Phase 12b. **Removed entirely in Session 5 (Phase 16) — see rule 148.**
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
113. **Pusher channel auth — `transport: "ajax"` + `headersProvider`** — DO NOT change to `"fetch"` or `customHandler`. Confirmed working via direct A/B test; `customHandler` causes total live-update regression. **This proven pattern was reused as-is for the customer widget's own auth endpoint in Session 3 (Phase 16) — do not invent a different transport for any new private channel.**
114. **Dark mode is scoped to dashboard only** — `ThemeProvider` (next-themes) lives in `app/(dashboard)/dashboard/layout.tsx`, NOT in root `app/layout.tsx`. Landing page is always light.
115. **`ThemeProvider` wrapper keeps `next-themes` as-is** — no `scriptProps` override.
116. **Theme toggle hydration guard** — `Topbar.tsx` dark mode toggle renders a neutral placeholder until `mounted === true`.
117. **PlanCard CTA/badge text colors use `text-white`, never `text-(--color-bg-page)`**.
118. **`getAnsweredRate` is capped at 100%** — `Math.min(..., 100)`. Never remove the cap.
119. **`payments_org_pending_unique_idx` is real and live in Neon** — DB-level partial unique index, one `pending` row per `org_id`.
120. **`insertPendingPayment` must be called before EVERY Midtrans transaction creation, including renewals.**
121. **`lib/db/schema.ts` is the only source of truth for the schema** — never trust `drizzle-kit introspect` output as a long-term artifact.
122. **Manual Neon schema changes must be mirrored in `schema.ts` in the same sitting.** **A sequencing failure mode worth naming explicitly (Phase 16 Session 5):** applying a manual `ALTER TABLE` in Neon before the matching `schema.ts` change is merged into `master` breaks every branch whose checked-out `schema.ts` still lists the old column — not just the branch doing the work.
123. **Midtrans real-mode transactions set `expiry: { unit: "hours", duration: 24 }`** — matches `insertPendingPayment`'s expiry logic.
124. **`documents/process` always downloads `document.s3Key` from the DB, never the client-supplied `s3Key`.**
125. **Sentry only auto-captures uncaught exceptions and client-side crashes** — a `console.error` inside a `try/catch` is invisible to it. Full audit still deferred — Kevin's own call. **Session 5 (Phase 16) note:** the document-processing pipeline's outer catch now explicitly calls `Sentry.captureException()` — the broader audit across every other catch block is still deferred.
126. **`requireOrgAdmin()` in `lib/auth.ts`** — use for any new admin-only mutation, never a fresh Clerk membership-list call.
127. **Every mutating Server Action/Route Handler must independently re-verify permissions** — a page-level UI gate is never sufficient alone.
128. **`org:member` permission model** — conversations-only, with Documents/Team as view-only exceptions and Widget Embed fully open. **Session 2 (Phase 17) extended this same view-only pattern to every knowledge surface — Profil/Isi Manual, Dokumen, and Katalog & FAQ all render fully for members with zero create/edit/delete/toggle controls, confirmed deliberately with Kevin rather than assumed.**
129. **Analytics uses a soft-lock (blur + overlay), not a page block, for the plan dimension.** Any CSS-only visual lock must carry `aria-hidden` on the hidden content.
130. **`payments_org_status_created_idx` is live in Neon.**
131. **`PLAN_LIMITS.chatbots`/`customBranding`/`apiAccess` were vestigial** — no corresponding feature exists. **Removed in Session 5 (Phase 16) — see rule 148.**
132. **Org-scoped client queries need `orgId` in the query key**, sourced reactively via `useOrganization()` — never `window.Clerk?.organization?.id` for render-triggering reads.
133. **E2E tests that create persistent DB rows must clean up in `test.afterEach`**, ID captured immediately, not only at the end of the test body. **Session 2 (Phase 17)'s knowledge E2E file follows this for every fixture.**
134. **When a Playwright failure looks intermittent, get the actual HTTP response/evidence before chaining hypotheses.** Applies equally to local dev-server flakiness — see rule 141.

### New Rules — Phase 16, Session 3

135. **Customer widget Pusher channel uses `private-conversation-{channelToken}` with a dedicated `/api/pusher/conversation-auth` endpoint** requiring a matching `sessionId` as a second factor against the `conversations` row. `sessionId` is sent via pusher-js's `paramsProvider`, reusing the exact `transport: "ajax"` config already proven for the dashboard's private channel (rule 113) — never invent a different transport.
136. **E2E coverage for channel auth lives in `e2e/06-pusher-channel-auth.spec.ts`** — unauthenticated suite, covers wrong-sessionId (403), correct pair (200), and wrong-channel-prefix (403) cases. Can be run standalone with `--no-deps` when the setup project is flaky.
137. **Org deletion is a 30-day grace period, not instant.** `deleteOrg()` stamps `orgs.deletionRequestedAt` and the org keeps full access. `cancelOrgDeletion()` reverses it. Two daily crons: `suspended-warning` and `org-purge`. **As of Session 4, `suspended-warning`'s trigger condition can no longer occur — see rule 144.** `org-purge` remains the only mechanism that actually deletes org data.
138. **`orgs.purgingAt` is an atomic claim marker** — the canonical atomic-claim pattern for any future cron that permanently deletes or transitions something a user-facing action might race against.
139. **`org-purge` deletes the Clerk organization before the DB row, and treats an already-missing Clerk org (404) as success** — safely retryable. `payments.orgId` is anonymized automatically via `ON DELETE SET NULL` (rule 140).
140. **`payments.orgId` is nullable with `onDelete: "set null"`**, not `cascade` — payment rows must survive org deletion for accounting retention.
141. **`activateSubscription()` accepts an optional transaction handle** — any function called from inside a `db.transaction()` block must actually accept and use the `tx` handle.
142. **A live-database FK constraint's actual name can silently drift from what Drizzle assumes.** Verify the real name first: `SELECT conname FROM pg_constraint WHERE conrelid = '{table}'::regclass AND contype = 'f';`.
143. **`e2e/auth.setup.ts` has a known, unresolved local-only flakiness** — intermittently hangs on `page.goto("/dashboard")`. Always passes reliably in CI. **Decision: not chased further.**

### New Rules — Phase 16, Session 4

144. **`subscriptionStatus: "suspended"` is no longer set anywhere in the codebase.** **Decision: `past_due` (day 0–3, full access, email warning at day 3) escalates to a real, permanent downgrade at day 7** via `downgradeToFree()`, replacing `suspendSubscription()`.
145. **`downgradeToFree(orgId)` returns `boolean`, not `void`** — `true` only if a row was actually updated.
146. **`suspended-warning`'s 90-day abandonment trigger is now permanently unreachable** as a consequence of rule 144. Left in code as dead code, not deleted.
147. **Any org already `"suspended"` before Session 4 shipped does NOT self-heal** — required a one-time manual Neon backfill.

### New Rules — Phase 16, Session 5

148. **`PLAN_LIMITS.chatbots`/`.customBranding`/`.apiAccess` removed entirely from `types/billing.ts`** — confirmed dead via full-repo grep.
149. **`orgs.midtransCustomerId` dropped from `schema.ts` and Neon** — a manual Neon schema change must land in `master` through the normal PR/CI gate before other in-flight branches can be trusted to still work.
150. **`orgs.suspendedAt` was considered for the same cleanup and deliberately left in place** — still read (though never matched) by `suspended-warning`'s cron query.
151. **Document upload validation and processing reliability pass** — the pattern to reuse for any future pipeline stage that can leak infrastructure error text.
152. **Project Bible doc-drift correction (Section 6, Section 7)** — three small factual corrections made directly to `kundesk-project-bible.md` at Kevin's explicit request.

### New Rules — Phase 16, Session 6

153. **Midtrans reads the webhook's HTTP status as an instruction.** `POST /api/webhooks/midtrans` returns **503 + `Sentry.captureException`** for any unexpected error. Never answer 200 for a payment that wasn't actually recorded.
154. **`processedWebhooks` is written only when an order's processing is actually finished.**
155. **`OrgPurgingError`** is the only error in the webhook's transaction `catch` that gets the "mark processed, return 200, flag in Sentry" treatment. Every other error rethrows → 503.
156. **Webhook write details:** `markPaymentSuccess` accepts a transaction handle; `markPaymentClosed` only updates rows still `pending`; use `.onConflictDoNothing()`, never `.catch(() => {})`.
157. **Snap behavior, verified in sandbox:** no webhook fires when a checkout page merely expires; a failed attempt lets the customer retry the same `order_id`.
158. **`cancelMidtransPayment(orderId, redirectUrl)` closes BOTH the payment and the Snap page, payment first.**
159. **`cancelPendingPaymentAction`** reads the pending order from the DB, calls `cancelMidtransPayment` first, only updates the row if that returns `true`.
160. **Known gap left open on purpose:** the webhook's settlement path checks amount but not the row's `status` — unreachable for new cancels post-Session-6.
161. **Midtrans feature review (no code):** the Subscription API supports only credit card and GoPay tokenization — the existing cron + Resend renewal flow stays correct.
162. **Fee facts:** VA Rp4.000 flat is exclusive of 11% VAT (real cost Rp4.440) — QRIS is cheapest at both plan tiers.
163. **Test conventions:** `vi.hoisted` mutable `mockEnv`; a `Response` body can be read only once; a class checked with `instanceof` must be defined inside the `vi.mock` factory.
164. **Process rules:** give the commit message as soon as checks pass, before the PR description; answer Kevin's exact question first before adding detail; don't assert third-party behavior from docs alone when a live sandbox check is cheap.
165. **Renewal cron picks up overdue orgs, not just today's** — `getOrgsDueForRenewal` selects `nextBillingDate` earlier than tomorrow.
166. **`markPastDue` restarts the grace clock: `nextBillingDate = GREATEST(nextBillingDate, NOW())`.**
167. **Past-due day-3 warning is now reliable** — awaits `sendPastDueEmail` first, records the idempotency key only after the send succeeds.
168. **`PastDueEmail` states the real consequence** — full access until day 7.
169. **`expireStalePayments()` daily sweep** closes abandoned checkouts.
170. **Email delivery blocker for the first real customer** — `DEFAULT_FROM`/`RESEND_TO_EMAIL` override must be fixed. Hard prerequisite, still pending.

## New Rules — Phase 17, Session 1

171. **Structured knowledge data model:** `business_profiles` (one row per org) holds always-needed facts. `knowledge_sections` (`kind`: `catalog | faq | policy | promo | note`) groups `knowledge_entries`.
172. **`chunks.document_id` is now nullable**; new nullable `entry_id`/`section_id` columns, each `ON DELETE CASCADE`. CHECK `chunks_single_owner_chk`.
173. **`EntryPrice` is a discriminated union**: `fixed` / `range` / `variants` / `contact`. KUN must never invent a price.
174. **A knowledge entry compiles to its own self-contained chunk.** A **catalog** section also gets summary chunks listing all its items compactly. A section under 2 entries gets no summary.
175. **`isAvailable = false` means different things by section kind.** Catalog: stays searchable with a status line. Any other kind: compiles to zero chunks.
176. **Always-needed profile facts go into the system prompt directly, not through retrieval.**
177. **Neither the greeting nor the open/closed comparison is left to the model.** `helpers/opening-hours.ts` computes both in code.
178. **`HoursLine` is structured, not free text**: `{ days: number[], opens: "HH:MM", closes: "HH:MM" (may be "24:00"), note? }`.
179. **One shared line validator guards every opening-hours code path.**
180. **Stored hours are validated at every read boundary, not just at save time.**
181. **The sync layer's write contract**: every content-changing Server Action sets `syncStatus: "stale"` + `updatedAt: now` in the same UPDATE, then calls a sync function. Embedding always happens outside any DB transaction.
182. **Deleting the last (or second-to-last) entry of a catalog section deletes that section's summary chunks in the same transaction.**
183. **`updateSection`'s "nothing changed, skip the sync" fast path must not report `synced` from field equality alone.**
184. **`PLAN_LIMITS.knowledgeEntries`: Free 50, Starter 300, Pro 1000**, plus a flat `MAX_KNOWLEDGE_SECTIONS = 30` per org. `checkKnowledgeWriteLimit`: 200 saves/hour/org.
185. **`orgs.timezone`** (default `Asia/Jakarta`) drives KUN's stated clock and opening-hours computation.
186. **`/dashboard/documents` moved to `/dashboard/knowledge`** via a `next.config.ts` redirect.

### Process note — Phase 17 Session 1

Twice during this session the commit message and PR description were skipped by mistake. Also: after a multi-step sequence of small `str_replace`-style edits to the same E2E file, a `page.goto` line was accidentally dropped entirely. Worth a full-file diff review after several edits stack up on one file.

## New Rules — Phase 17, Session 2

187. **Nav label and tab-default decisions:** the nav item and page heading are **"Info Bisnis"**. The **Profil** tab was the default active tab (later reversed in Session 3 — see rule 213), not Dokumen.
188. **`KnowledgePage.tsx` is the page-level wrapper** — owns the shared header and a shadcn `Tabs` instance (later restructured further in Session 3).
189. **Radix/shadcn `Tabs` unmounts inactive tab content from the DOM by default**, unless `forceMount` is passed. **General lesson for any tabbed page: a fresh `page.goto()` always lands on the default tab — E2E specs must re-click into the right tab after every navigation, not just once at the top of the test.** This lesson was directly reused in Session 3 when the sub-tab structure was added.
190. **The default shadcn `Tabs` styling was replaced with a segmented-pill look, scoped entirely to `KnowledgePage.tsx`'s own `className` overrides** — the shared `components/ui/tabs.tsx` primitive itself was deliberately left untouched.
191. **Business profile form architecture:** `types/knowledge-editor.ts` holds UI-only editor types (`EditableContact`, `EditablePaymentMethod`, `EditableHoursLine`, `EditableHoursSchedule`) with a client-generated `editorId`. `ProfileForm.tsx` converts persisted data on load and strips `editorId` back out before calling `saveBusinessProfile`.
192. **CodeRabbit findings on the profile form PR, both fixed:** unstable index-based list keys (fixed via `editorId`); the midnight-toggle switch hardcoded a fallback closing time instead of remembering the real one (fixed with `lastNonMidnightClose` state — carried forward correctly through Session 3's restyle).
193. **`getBusinessProfileForEdit(orgId)`** in `lib/db/queries/knowledge.ts` — separate from `getBusinessProfileData` (used by the chat route).
194. **Section/entry management originally shipped as a third top-level tab, "Katalog & FAQ"** — architecture dialog-based (`SectionDialog`, `EntryDialog`, `RemoveSectionDialog`, `RemoveEntryDialog`), matching `TeamPage`'s pattern, chosen for catalog-scale (~190 entries at Rumah Paco). **Superseded in Session 3: the justification given at the time — that the Bible's Section 16 anticipated this as a separate tab — was checked against the actual Bible text in Session 3 and found not to exist. The real reason was implementation convenience, not user mental model, and Kevin correctly rejected the resulting UI. The dialog-based CRUD architecture itself (still needed for the ~190-entry scale) was kept; only its position in the page changed — see rules 202 and 205.**
195. **`PriceEditor` implements the `EntryPrice` discriminated union**, rendered only when the parent section's `kind === "catalog"`.
196. **A section's `kind` is locked in the edit dialog once that section already has one or more entries** — a UI-only guardrail, not a backend rule.
197. **Stale-sync retry banner (`StaleSyncBanner.tsx`)** — admin-only. Surfaced a real Major bug in `retryStaleKnowledgeSync` (no `ORDER BY`, same 3 sections retried forever) and two Minor findings, all fixed same-PR.
198. **An unrelated Vercel deploy failure hit mid-session**: Turbopack + `next/font/google` — resolved by a plain redeploy, no code change.
199. **The E2E test Session 1 deferred shipped as `e2e/07-knowledge-limits-and-isolation.spec.ts`** — the first E2E file to depart from the `page.evaluate(fetch(...))` convention, since knowledge mutations are Server Actions with no REST route. Imports `db` + schema directly for fixture setup and internal-state assertions. **This file's tab-click locators were updated twice more in Session 3** (first for the tab-merge, then again for the sub-tab restructure) — see rules 202 and 210.
200. **A `test.describe.configure({ mode: "serial" })` was added and then removed within the same session** — `serial` mode aborts every remaining test in the group the moment one fails; the three sub-tests here have independent fixtures and never needed it.

### Rule 201 — the orphaned-summary-chunk investigation, told honestly

**What was observed:** creating two real catalog entries (A then B) via the dashboard UI, confirming via DB query that neither was `stale`, the test's own sanity check — "the section should have at least one summary chunk by now" — failed. `summaryBefore` was `0`.

**Claude's first theory:** an unlocked pre-embed read in `syncEntry` racing entry B's own just-committed insert, missing A, correctly returning no summary for what looked like 1 entry.

**Why that theory doesn't survive scrutiny:** `syncSectionChunks` fingerprints its pre-embed read, then re-reads and re-fingerprints inside the transaction after embedding, with rows locked. A mismatch returns `"superseded"`, leaving the entry `stale` — not `synced`. The observed outcome (both entries `synced`, no stale rows, no summary) doesn't fit any branch of the code as written.

**Where this was left:** the actual root cause is **not confirmed**. No further static tracing was attempted after the disproof — the deliberate decision (Kevin's call) was to stop guessing from source and instead **reproduce it on purpose, manually, in Session 4**, treating this the same documented-but-not-chased way rule 143 already treats `auth.setup.ts`'s flakiness.

**What the test does in the meantime:** forces a full section resync via the dashboard's own "Edit bagian" → "Simpan" flow (triggers `updateSection`'s real-change path, a fresh locked read via `syncSection` scope `"all"`) and waits for that to clear before asserting the summary chunk exists.

**Why this is worth flagging to Kevin explicitly:** if real, any business owner's catalog section could go from 1 to 2 entries and end up fully `synced` while KUN still can't answer catalog-listing questions — with nothing surfacing that gap, since the stale-sync banner only reacts to `stale` entries.

### Process note — Phase 17 Session 2

- Two moments where a file diff was given against Claude's own reconstructed memory rather than a fresh paste, both costing real turns. **Lesson reinforced: when a file has been read once earlier in a long session, treat every later diff against it as if it needs re-verification, not as settled.**
- CodeRabbit review caught real, valid findings on 2 of the 4 feature PRs this session, all fixed same-PR.
- `getOrgPlan` (added to `lib/db/queries/knowledge.ts`) flagged as a possible duplicate of an equivalent in `lib/db/queries/billing.ts` — not personally verified, no repo access.

## New Rules — Phase 17, Session 3

This session was an unplanned UI/UX overhaul of the "Info Bisnis" page, triggered by Kevin directly rejecting Session 2's information architecture. Two PRs, both merged, both clean through CI and CodeRabbit. The originally-planned "manual real-world testing" session (see rule 201 / open item #13) did **not** happen this session — it's now Session 4.

202. **The Session 2 three-tab structure (Profil / Dokumen / Katalog & FAQ) was collapsed back to two tabs.** Kevin's objection was direct: Katalog & FAQ was never meant to be a third way of feeding KUN, it's one more manual-entry field group alongside the profile form. Claude checked the justification given in rule 194 (that the Bible's Section 16 "anticipated" a separate tab) against the actual Bible text and found no such passage — the real reason had been implementation convenience, not a user-facing rationale. `KnowledgeSectionsPanel` was moved inside the remaining "Profil" tab as a section, not deleted or changed internally.
203. **Git commit process — embedded quotes break `-m "..."`:** a multi-line commit message quoting literal words like `"Profil"` or `"Simpan"` causes bash to split the argument at each embedded `"`, silently truncating the message; `git commit` then receives the leftover text as pathspecs and errors with a confusing `pathspec '...' did not match any file(s)` — not an obvious quoting complaint. No commit is made and nothing is lost (files stay staged), but always use `git commit -F - <<'EOF' ... EOF` with a **quoted** heredoc delimiter for any commit message with embedded quotes or apostrophes, never `-m "..."`.
204. **Mockup-vs-reality reconciliation:** Kevin supplied a static HTML/screenshot mockup (`code.html`/`screen.png`) showing a materially different "Info Bisnis" page — one long scrollable page with 5 numbered cards, a scroll-jump "Navigasi Cepat" pill bar, Katalog Layanan as a flat table (no section grouping), FAQ+Kebijakan merged into one tag-labeled list, three internally-inconsistent save affordances (autosave indicator + header button + bottom floating bar), and an unimplemented "Kelengkapan data profil: 85%" completeness score. **Decided: the mockup is design inspiration for information architecture and visual language, not a literal spec to clone** — each idea was checked against the real data model and real scale constraints before adopting it.
205. **Katalog Layanan keeps its named-section + dialog-based CRUD model, not the mockup's flat table.** A flat table with no grouping doesn't scale to Rumah Paco's real ~190 catalog entries — the exact problem rule 194's collapsible-by-default section design already solved. Visual restyling toward a cleaner, more table-like row look inside each section is still planned but not yet built (see Open Items).
206. **FAQ / Kebijakan / Promo / Note keep their separate `kind`-based DB structure** (load-bearing for chunk compilation per rule 174) — **decided, not yet implemented**, to merge them visually into one continuous list with a colored per-entry category tag, matching the mockup's visual idea without touching the schema (see Open Items).
207. **Save semantics decided explicitly**, since the mockup itself showed three conflicting affordances at once: kept **per-item immediate save** for Katalog & FAQ entries (unchanged — matches the existing stale/sync pipeline, rule 181; a batch save here would either be a no-op since the entry is already saved, or require dismantling that pipeline), and kept a **single batch "Simpan"** for the profile-only fields (about/address/contacts/hours/paymentMethods) — now duplicated per sub-tab (rule 210) but always saving the same one full profile object regardless of which sub-tab triggered it.
208. **The mockup's "Kelengkapan data profil: 85%" completeness indicator is explicitly deferred as a separate future feature, not a style change** — no completeness formula exists anywhere in the schema or actions yet. Not scheduled.
209. **`NumberedSection.tsx` (new, shared component)** — a consistent icon + title + description + optional-badge card header used for every field group, replacing the visual inconsistency between the polished `ProfileSection`-wrapped profile fields and the bare `<h2>` divider the first tab-merge attempt gave Katalog & FAQ.
210. **"Isi Manual" (renamed from "Profil" — see rule 213) restructured into real sub-tabs** — Identitas & Kontak / Jam Operasional / Metode Pembayaran / Katalog & FAQ — replacing an initial scroll-jump "Navigasi Cepat" bar that Kevin correctly identified as doing nothing useful. Each of the three profile-field sub-tabs renders its own "Simpan" button (all wired to the same `saveBusinessProfile` call, per rule 207); Katalog & FAQ's sub-tab has none.
211. **`KnowledgeSectionsPanel`'s `sections` state moved from internal (`useState(initialSections)`) to a controlled prop (`sections` / `onSectionsChange`), owned by `ProfileForm`.** Caught and fixed before shipping: naively wrapping the panel in a tab that unmounts on switch would have silently reset it back to server-load state on every sub-tab switch, hiding a just-added or just-edited entry until a full page reload. All profile-related state (about/address/contacts/hours/paymentMethods/sections) now lives in one place, under one consistent ownership model.
212. **`NumberedSection`'s `number` prop is optional** — no longer printed once each card lives inside its own sub-tab, since position already implies order. `QuickNav.tsx` (built earlier this same session, then made obsolete by the sub-tab restructure) was deleted — nothing in the codebase references it.
213. **`KnowledgePage.tsx` tab renamed "Profil" → "Isi Manual".** This was a real, tracked mistake before it was a fix: Claude recommended this name earlier in the session, Kevin said "your call," and Claude then silently shipped a full-file rewrite still saying "Profil" with no flag either way — caught by Kevin, not by Claude. **Also decided: default active tab flipped from Isi Manual to Dokumen**, Kevin's explicit call, deliberately reversing Session 2's rule 187 (a "blank form reads friendlier" argument) in favor of "Dokumen was the original product idea." No E2E fallout — both spec files already explicitly re-click their target tab after every navigation per rule 189's established lesson, so no test depended on which tab loads by default.
214. **`KnowledgePage.tsx` subtitle rewritten** to explicitly state there are two separate ways to feed KUN (Dokumen vs Isi Manual) and that an owner can use either or both — the previous copy ("Lengkapi profil bisnis dan dokumen kamu") described neither tab's actual purpose.
215. **Mobile responsiveness pass across the Isi Manual sub-tabs, done in two rounds:**
    - Claude's pass, from files already in hand: `TabsList` given `overflow-x-auto` + `flex-nowrap`, each trigger `flex-shrink-0 whitespace-nowrap` (four sub-tab labels plus gaps exceeded phone width with no wrap/scroll originally); `HoursLineRow`'s Buka/Tutup `type="time"` inputs changed from a fixed `w-[150px]` each (≈300px side-by-side, doesn't fit) to `grid-cols-2` stacking below `sm:`, fixed width restored above it; day-selector chip width nudged down slightly on mobile (`w-8 sm:w-9`); `KnowledgeSectionsPanel`'s header row (entry count + "Tambah bagian") given `flex-col sm:flex-row` instead of a plain `justify-between` that squeezed on narrow screens.
    - Kevin's own pass, on files Claude has never seen: further mobile fixes applied directly to `EntryDialog.tsx` and `SectionDialog.tsx`. Confirmed working via manual click-through and both E2E spec files passing, but the exact diffs are unverified against the E2E's dialog-scoped `getByRole("dialog").getByRole("button", { name: "Simpan" })` locator (rule 202's predecessor fix) — low risk given the tests pass, but a real blind spot if that locator ever starts failing later.
216. **A real button-name collision was caught and fixed during the first (tab-merge) PR of this session, before the sub-tab restructure made it moot:** once `ProfileForm` and `KnowledgeSectionsPanel` were mounted on the same tab (no longer separated by Radix's inactive-tab unmounting per rule 189), `ProfileForm`'s "Simpan Profil" button and any open dialog's "Simpan" button were both in the DOM at once. Playwright's `getByRole(..., { name })` matches by default as a case-insensitive **substring**, not exact — so `getByRole("button", { name: "Simpan" })` matched both, a strict-mode violation. Fixed by scoping the E2E's dialog-button locators to `getByRole("dialog").getByRole("button", { name: "Simpan" })`. **This scoping was kept in the second PR even though it's no longer strictly necessary** (the sub-tab restructure means the two buttons can never coexist in the DOM anymore) — correct either way, costs nothing to leave in.

### Process note — Phase 17 Session 3

- A design decision Claude explicitly recommended in one turn ("Isi Manual" naming) was silently dropped in the very next full-file rewrite with no flag either way — caught by Kevin, not by Claude. **Lesson: a recommendation made and then not acted on needs an explicit "keeping X instead, here's why" statement in the same turn, never silence.**
- Claude initially tried to hand three structural UI decisions (Katalog table vs. sections, FAQ merge, save model) back to Kevin via a multiple-choice tool, after Kevin had already stated a design direction and explicitly said it didn't need to be followed 100%, just made valid for the project. Read correctly by Kevin as Claude dodging the actual job — corrected by making the calls directly, with stated reasoning, once asked to.
- "Make sure it's safe first" was a request for concrete reasoning about state ownership across tab switches, not a request for reassurance — answering it properly required actually tracing where `sections` state lived and catching the remount bug (rule 211) before shipping, not asserting "it's fine" without checking.
- Kevin completed a real portion of this session's mobile-responsive work independently, on files Claude had never seen and correctly declined to guess at (`SectionRow.tsx`, `SectionDialog.tsx`, `EntryDialog.tsx`, `PriceEditor.tsx` were never sent in full). This is a legitimate, good outcome — not a failure of the session — but it means `EntryDialog.tsx` and `SectionDialog.tsx` as they exist on master right now are unverified by Claude and should be treated as genuinely unread, not reconstructed from memory, the next time either needs to change.

### Root Cause, Named Explicitly (Recurring Themes)

1. **Manual Neon application without keeping `schema.ts`/migrations in sync** — the discipline holds when deliberately applied, but requires deliberate effort every time. Merge order, not just schema/code sync, matters (Phase 16 Session 5).
2. **The codebase's error-handling discipline (catch-and-log, never 500) means Sentry sees almost nothing** — still deferred as a full audit, Kevin's own call.
3. **Decisions made in one PR can silently create obligations in files not touched by that PR** — named repeatedly since Phase 16 Session 2.
4. **CodeRabbit's suggested diff is a starting point, not a drop-in fix** — reconfirmed in Phase 17 Session 2's two CodeRabbit rounds, requiring tracing surrounding code to scope the fix correctly.
5. **A status field left unenforced everywhere except one place is effectively decorative** — `subscriptionStatus` existed and displayed correctly for months while `plan` was the only thing actually enforced anywhere.
6. **Assumed third-party behavior, not verified live** — Session 6's Midtrans cancel design assumed vendor behavior a real sandbox call disproved.
7. **Failure paths were designed less carefully than happy paths** — the Midtrans webhook had solid happy-path defenses but quietly-undoing failure paths.
8. **Changing which rows one cron selects can break the next cron in the chain** — the renewal → past-due → downgrade chain shares one clock.
9. **A disproven hypothesis is still worth writing down, in full, rather than replaced with a second unverified guess.** Phase 17 Session 2's orphan-chunk investigation (rule 201) is the clearest example: the honest move was presenting the dead end exactly as it happened, including which specific mechanism made the first theory impossible, rather than quietly swapping in a different guess to look more conclusive. The actual root cause remains open, scheduled to be chased empirically in Session 4.
10. **A file already seen once in a long session can still go stale in memory by the time it's diffed against again** — Phase 17 Session 2's two file-diff mistakes trace back to this. Worth a habit of re-verifying rather than reconstructing from earlier in the same conversation once several turns and several other files have passed.
11. **A recommended decision that isn't visibly acted on needs an explicit statement either way, not silence.** Phase 17 Session 3's "Isi Manual" naming lapse: Claude proposed the name, got sign-off to decide, then genuinely forgot to apply it in the next rewrite with zero flag in either direction — indistinguishable, from Kevin's side, from having silently overridden his own earlier input. Silence about a prior recommendation is never a safe default, whether or not the omission was deliberate.
12. **When the person has already stated a direction and says it doesn't need to be followed exactly, further multiple-choice questions read as deflection, not diligence.** Phase 17 Session 3: three structural UI questions handed back via a picker tool after Kevin had already given a mockup and explicit latitude — the right move was to decide and show the reasoning, not to ask again in a different format.

---

## Open Items

**High severity:** None.

**Medium severity:** None outstanding beyond what's listed below.

**Lower priority / cleanup, do opportunistically:**
1. **Sentry blind-spot audit** — full pass across every catch block. Explicitly deferred by Kevin.
2. **Doc drift, cosmetic/informational only** — FK naming drift is an ongoing pattern; `generateMetadata()` on the public chat page reveals org name for an inactive chatbot, undermining slug-enumeration protection.
3. **`e2e/auth.setup.ts` local flakiness** (rule 143) — unresolved, doesn't block anything since CI is unaffected.
4. **`suspended-warning` and `org-purge`'s abandonment-trigger path are dead code** (rules 144, 146) — left in place intentionally.
5. **`orgs.suspendedAt` column is write-only dead weight** for the non-payment path — deliberately left in place (rule 150).
6. **Webhook small hardening** (Session 6 review, not applied): `timingSafeEqual` for signature comparison; a comment/code mismatch (says HMAC-SHA512, computes plain SHA-512); fire-and-forget upgrade email could be cut off on Vercel.
7. **Webhook doesn't check the payment row's `status` on settlement** (rule 160) — low priority, only legacy pre-fix rows exposed.
8. **Bible fee table drift** — Section 7 lists VA as Rp4.000 flat, actual cost with VAT is Rp4.440 (rule 162). Correct only when the Bible is next touched deliberately.
9. **Housekeeping:** Kevin's sandbox Midtrans server key was printed in terminal/chat during Session 6 testing — regenerate when convenient.
10. **Cron idempotency keys use `source: "midtrans"`** for what are really internal cron events — cosmetic, leave unless the table is ever queried by source.
11. **Renewal reminder email links to a Snap page that dies after 24 hours** (rule 168) — the day-3 past-due email is the safety net.
12. **`getOrgPlan` (`lib/db/queries/knowledge.ts`) may duplicate an existing equivalent in `lib/db/queries/billing.ts`** — flagged, never grepped (no repo access). Check before trusting there's only one implementation.
13. **`lib/knowledge/sync.ts`: unconfirmed possible race leaving a catalog section with fully-`synced` entries but no summary chunk.** Observed once during Phase 17 Session 2's E2E test development. Claude's first theory was traced through and disproved by the code's own fingerprint-and-relock safety check — see rule 201. No current working theory. **Plan, agreed with Kevin: reproduce it on purpose and manually in Phase 17 Session 4**, by watching a fresh real catalog section go from 1 to 2 entries in the actual dashboard and observing what happens, rather than continuing to reason from source code alone.
14. **Katalog Layanan visual restyle toward a cleaner, more table-like row layout** — decided in Session 3 (rule 205) as a follow-up phase, not started. The underlying section/dialog data model stays as-is; only the entry list's visual presentation inside each section is in scope.
15. **FAQ / Kebijakan / Promo / Note visual merge into one continuous, tag-labeled list** — decided in Session 3 (rule 206), DB structure unchanged, not started.
16. **"Kelengkapan data profil" completeness score** — new feature surfaced by the Session 3 mockup, explicitly deferred (rule 208). No formula, no schema field, not scoped yet. Needs its own planning conversation before any code.
17. **`EntryDialog.tsx` / `SectionDialog.tsx` mobile-responsive changes made directly by Kevin in Session 3, never reviewed by Claude** (rule 215). Low risk — both E2E spec files pass — but genuinely unverified. Worth a look the next time either file needs to change for an unrelated reason, rather than assuming Claude already knows their current contents.
18. **`DocCountBadge` / sidebar document count still counts ready documents only** — needs to become documents + knowledge entries combined once the full feature is in real use, or it will visibly undercount a business's real knowledge base.

**Unchanged, still deferred:**
- WhatsApp/Meta integration — on hold pending Meta Business verification
- Midtrans production keys — still sandbox; merchant account still in review
- Midtrans advanced features (GoPay auto-renew, static VA, Snap email reminder, Promo Management, Invoicing) — parked until account approval
- Domain purchase + Resend sender migration — still pending, hard prerequisite for the first real customer
- CloudFront — still post-launch
- Promo code administration — still manual via Neon SQL editor
- Quota reset / billing cycle decoupling — known limitation, not addressed
- `lib/ai/stream.ts` — still dead code, can delete anytime
- Templates and photo/paste import for large catalogs (Rumah Paco-scale, ~190 items) — not started
- An "unanswered question" inbox to grow the knowledge base from real customer questions — shelved, no "KUN couldn't answer this" signal exists yet in the chat pipeline

---

## Decisions Made / Pending

1. **Org member permissions:** conversations-only for `org:member`, Documents/Team view-only exceptions, Widget Embed fully open. ✅ Decided AND implemented (Session 2, Phase 16). Extended to every Phase 17 knowledge surface (Session 2, Phase 17).
2. **Org deletion & data retention:** 30-day grace period, payments anonymized not deleted. ✅ Decided AND implemented (Session 3, Phase 16).
3. **Free-tier technical enforcement:** resolved for documents, embed widget, analytics, and lapsed-payment orgs. Considered complete unless a new plan-gated feature is added.
4. **Manual Neon schema drift as accepted practice:** unchanged position, with the caveat that live constraint/column state must be verified directly and merge order into `master` respected.
5. **Customer widget channel security:** private channel + sessionId second factor. ✅ Decided AND implemented (Session 3, Phase 16).
6. **Vercel 10s timeout vs. document processing:** investigated, no live issue found. ✅ Closed as "checked, not a bug."
7. **Non-payment escalation policy (revised):** `past_due` (0–3 days, full access, warning) → real downgrade to Free at day 7. ✅ Decided AND implemented (Session 4, Phase 16).
8. **Dormant/inactive account cleanup:** explicitly NOT pursued. ⏸️ Deliberately deferred.
9. **PDF support scope:** kept — the actual gap was a fallback-trigger bug, not a reason to drop the format. ✅ Decided AND implemented (Session 5, Phase 16).
10. **Webhook failure semantics:** a declined attempt doesn't close the order; only finished events write `processedWebhooks`; only `OrgPurgingError` stops retries. ✅ Decided AND implemented (Session 6, Phase 16).
11. **"Batalkan" semantics:** cancel the payment AND the Snap page; keep the row pending if either isn't confirmed. ✅ Decided AND implemented (Session 6, Phase 16).
12. **Overdue renewals are retried, not forgotten**, with the grace clock restarting at pickup time. ✅ Decided AND implemented (Session 6, Phase 16).
13. **What the owner is told when overdue:** stays fully active for the grace period; day-3 email says so honestly. ✅ Decided AND implemented (Session 6, Phase 16).
14. **Abandoned checkouts:** closed by a daily sweep, not any vendor event. ✅ Decided AND implemented (Session 6, Phase 16).
15. **Structured business knowledge as a second, form-based way to feed KUN:** six generic building blocks (profile, catalog, FAQ, policy, promo, note). ✅ Backend decided AND implemented (Phase 17 Session 1).
16. **Reuse the existing Documents nav item/page rather than adding a new one:** tabbed page instead of documents-only. ✅ Route move decided AND implemented (Session 1). Tabs, profile form, section/entry management, and stale-sync banner all decided AND implemented in Phase 17 Session 2. **The specific tab arrangement from Session 2 (three top-level tabs) was itself revised in Session 3 — see items 22–23 below. This decision (reuse Documents nav, one page for both knowledge-entry paths) remains closed; only the internal tab layout changed.**
17. **Nav label and default tab (Session 2 version):** "Info Bisnis" nav label ✅ still correct. Default-tab choice ("Profil") was **reversed in Session 3** — see item 23.
18. **Section-kind lock in the edit dialog:** UI-only guardrail, not a backend rule, confirmed acceptable. ✅ Decided AND implemented (Phase 17 Session 2) — see rule 196.
19. **Section/entry management UX shape:** dialog-based (matching `TeamPage`), not inline — chosen specifically for catalog-scale (~190 entries). ✅ Decided AND implemented (Phase 17 Session 2, kept unchanged through Session 3's restructure) — see rules 194, 205.
20. **The `sync.ts` orphan-chunk question:** NOT resolved in Session 2, and **still not resolved after Session 3** (Session 3 was a UI detour, not testing work). ⏸️ **Next step, agreed with Kevin: Phase 17 Session 4 opens with manual, deliberate, step-by-step real-world testing of the entire Phase 17 feature** — not more automated tests, but Kevin actually using every part of it in the real dashboard while Claude connects whatever surfaces back to its likely source in code, starting with a deliberate attempt to reproduce this specific question on purpose.
21. **Isi Manual page information architecture (Session 3):** two top-level tabs (Isi Manual / Dokumen, Dokumen now default), Isi Manual split into four sub-tabs with a shared numbered-card shell, Katalog & FAQ kept as its own sub-tab (not merged inline with the profile form fields, not split back out as a top-level tab). ✅ Decided AND implemented (Phase 17 Session 3) — see rules 202, 209, 210, 213.
22. **Katalog Layanan and FAQ/Kebijakan/Promo/Note visual treatment vs. the Session 3 mockup:** data model and dialog-based CRUD kept as-is (rejected the mockup's flat-table and DB-restructuring implications as not scaling to real usage); visual restyling toward the mockup's table/tag-list look accepted as a direction but **not yet built**. ✅ Decision made, ⏸️ implementation pending (Phase 17 Session 3) — see rules 205, 206, and Open Items #14–15.
23. **Default active tab: Dokumen** (reversing Session 2's Profil-default decision, rule 187). ✅ Decided AND implemented (Phase 17 Session 3), Kevin's explicit call — see rule 213.
24. **The mockup's "Kelengkapan data profil: 85%" completeness score:** NOT adopted — new feature, unscoped, deferred to its own future conversation. ⏸️ Deliberately deferred (Phase 17 Session 3) — see rule 208, Open Items #16.
25. **Next priority:** the Isi Manual/Dokumen page is now considered UX-stable (numbered sections, real sub-tabs, mobile-responsive) with two clearly-scoped visual follow-ups parked (items 14–15 above) and one clearly-scoped new feature parked (item 16). **Phase 17 Session 4 is manual real-world testing of the whole feature**, not new feature work — the explicit goal is finding out what's good and what's wrong across the whole feature by using it, starting with a deliberate attempt to reproduce the rule 201 orphan-chunk question.