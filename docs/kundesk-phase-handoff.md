# Kundesk — Phase Handoff Document

> **Document Type:** Living document. Replace entirely after each phase completes. **ONE document only: never create a supplement file again (Kevin's decision, Phase 20 Session 5).** Always read `kundesk-project-bible.md` first.
> **Last Updated:** November 26, 2026 (Phase 20 Session 6 close). Phase number is provisional; Kevin assigns the real one.
> **How this version was made:** the previous handoff (rules 1–383) was CONDENSED again and the Session 6 work (live scene, rules 384–404) was added. Every rule number is kept; long session stories were cut down to the facts that still matter. Rules that were later corrected carry the correction inline. The June 2026 file `kundesk-live-update-chat-fixes.md` is fully covered by these rules and is no longer needed as a project file.

---

## Current State (read this first)

- **Midtrans is LIVE in production with real money.** Three keys exist (rule 370): Server Key (API calls), Client Key (Snap), Signature Secret Key (verifies notifications, `MIDTRANS_SIGNATURE_KEY`, rule 372). Two real payments were made with a 98% promo on Pro (Rp 2.980); after the signature fix the second worked end to end (rules 373, 377).
- **Promo prices show on the plan cards** (rule 376). `applicable_plans` must be a JSON array string like `["pro"]` (rule 375).
- **Storage is Cloudflare R2**, not AWS S3 (rule 357). Document preview exists (360–362); deleting a document or purging an org also deletes the stored files (364–365).
- **Still on the dev Clerk instance** (production Clerk needs an owned domain, rule 233). Resend sender is blocked on the same domain (rule 170), so customer emails are not really deliverable yet.
- **Live scene (Session 6, rules 384–404):** "Ruang Percakapan Live" on `/dashboard` is now an illustrated, state-driven scene: a customer, the gold KUN robot and the admin (real name of the logged-in user, or of whoever took over) on isometric tiles. Packets, rings and pop-ups play only for real Pusher events. All Session 6 PRs are merged.
- Phase 20 sessions: Session 1 = rules 318–338; Session 2 = 339–349; Session 3 = dashboard live overview 350–356; Session 4 = R2, preview, delete 357–369; Session 5 = Midtrans production keys, signature key, promo preview 370–383; **Session 6 = live scene 384–404.**
- **Last full test run Kevin reported (Nov 26, 2026): 72 files, 1465 tests passing.**
- Everything below this line that says "sandbox" still describes sandbox behavior; production now exists too.

---

## Instructions for Claude (rules 1–17)

1. Read the Project Bible completely before this document.
2. This document is the current build state and what to do next.
3. Never guess missing information. Ask Kevin to paste files or confirm. Claude has NO access to the repo; Claude gives exact edits, Kevin applies, commits and pushes.
4. Do not write code until the current state is confirmed.
5. Rewrite this document only when Kevin says so, and as ONE file (no supplements).
6. The Project Bible stays untouched. One-off factual corrections happened only at Kevin's explicit request (rules 152, 349). The Bible is now stale on storage, see "Awaiting Kevin".
7. Explain how things connect before code.
8. Surgical changes: say exactly which lines to find and replace. A full rewrite only when truly needed, and say so.
9. Always a feature branch: branch → PR → CI → merge. Even small fixes that touch production schema, security, payments or CI go through a PR. Only trivial chores (docs, typos) go direct to master. **Before any commit command, give the branch step (`git branch --show-current`, `git switch -c <name>`) — rule 315.**
10. Every PR needs a markdown description, given as a code block in chat (never a file).
11. Concept first (1–3 sentences), then code with comments.
12. Read `/mnt/skills/public/frontend-design/SKILL.md` before UI code (it is written for new UI, not for diagnosing existing bugs).
13. `npm run typecheck`, then `npm run lint`, then tests, before committing.
14. ALWAYS ask to see an existing file before modifying it; never rebuild a file from memory. A file seen earlier in a long chat can be stale; re-verify.
15. Write the handoff only after CI passes and everything is merged.
16. Answer conversationally; no walls of markdown mid-build.
17. Surgical edits with exact FIND / REPLACE blocks (see rule 380 for the format Kevin wants).

---

## Rules 18–170 (condensed)

**Frontend, tests and CI (18–36)**
18. All animation variants live in `lib/animations.ts` (`variants` pattern).
19. Framer Motion `ease` arrays typed as `[number, number, number, number]`.
20. Vitest mock classes use the `function` keyword (arrow functions cannot be `new`ed).
21. Verify `useCallback` dependency arrays include everything the callback reads.
22. Before adding a CI build step, cross-check `.env` against `lib/env.ts` and add ALL required fake vars at once.
23. CI `DATABASE_URL` placeholder: `postgresql://placeholder-host/placeholder-db` (no credential-shaped strings).
24. Shared CI env vars go in `jobs.<job>.env`.
25. CodeRabbit is active; its findings are always worth investigating and never applied verbatim. It has repeatedly found real bugs.
26. E2E uses `page.evaluate(fetch(...))` for authenticated calls (no `request` fixture). One deliberate exception: `e2e/07-knowledge-limits-and-isolation.spec.ts` uses `db` directly (Server Actions have no REST route).
27. `test.use()` only at `describe` level.
28. `vitest.config.ts` excludes `e2e/`; never remove it.
29. CI caches `~/.cache/ms-playwright`; keep the step.
30. Playwright workers: CI 2, local 1.
31. The `/api/chat` final SSE event is `{ done: true, conversationId, channelToken, handoffStatus }`; E2E parses it.
32. E2E uploads use `Date.now()` filenames; knowledge E2E uses `Date.now()` titles.
33. `timestamptz AT TIME ZONE` inverts; always use `timezone('Zone', col)`.
34. Time-grouped queries take a `timezone` param, never hardcoded. `getOwnerTimezone()` now returns the org's DB timezone (rule 242).
35. Chat content uses `<ReactMarkdown>` with the `prose-bubble` class.
36. `ChatHeader` hides in an iframe via `useEffect` + `useState` after mount (no `typeof window` in render).

**Platform and infrastructure (37–59)**
37. `/chat/:path*` overrides `X-Frame-Options` with `ALLOWALL` + `frame-ancestors *`. There is NO global CSP.
38. Promo lookup uses `LOWER(code) = LOWER(input)`, never `ilike`.
39. Promo `usedCount` increments inside the settlement transaction, not at checkout.
40. Promo id is encoded in `order_id`: `KUNDESK-{orgSlice}-{PLAN}-{timestamp}[-P{promoId}]`. Never change the format without updating the parser.
41. Sound notifications fail silently under autoplay policy; never crash the dashboard.
42. Notification routes catch Neon cold-start errors and return graceful empties.
43. `fireMockWebhook` takes an optional `amount`.
44. Redis cache keys: `kundesk:cache:org:slug:{slug}`, `...org:id:{orgId}` (5 min), `...chatbot:{orgId}` (10 min); a business-profile cache also exists (`getCachedProfile`).
45. `invalidateOrgCache(orgId)` reads the cached org to find the slug, then deletes both keys.
46. Embeddings go through `batchedAsync(chunks, 10, embedText)`.
47. `documents/process` wraps the pipeline in a 55s timeout; `markFailed` once in the outer catch. The old "Vercel 10s" premise is STALE (rule 298).
48. OpenAI stream errors use SDK error classes, never string matching; customer message in Bahasa Indonesia.
49. Widget sets text with `textContent`, never `innerHTML`.
50. `/api/widget` limit: 60 req/min per IP + orgSlug.
51. `GET /api/health` pings Neon.
52. `deleteOldMessages(90)` daily via `/api/cron/retention`.
53–55. Privacy, Syarat & Ketentuan and Kebijakan Refund pages exist (Bahasa Indonesia). Facts corrected in Session 2 (rule 344); contact address is `CONTACT_EMAIL` (rule 345).
56. Deployment is Vercel Hobby with Fluid Compute: **function timeout 300s, NOT 10s** (rule 298). 4.5 MB request body limit.
57. npm audit has 7 moderate dev-tool findings; never run `npm audit fix --force`.
58. Indexes: `notifications_org_created_idx`, `conversations_org_handoff_status_idx`, `payments_org_status_created_idx`.
59. RLS is intentionally NOT used; isolation is `requireOrg()` + `AND org_id`.

**KUN and chat (60–67)**
60. KUN is the fixed AI identity (name, greeting, voice hardcoded); the `chatbots` name/tone/greeting columns were dropped.
61. The `kunIdentity` block in `lib/ai/rag.ts` defines the "Kak" (vocative) vs "kakak" (mid-sentence) grammar.
62. KUN's first-load greeting is hardcoded in `ChatPage.tsx` (separate from the per-turn greeting in `buildSystemPrompt`, rule 218).
63. The widget does not call Clerk for the org image; logo served from `/images/kun-logo.png`.
64. Logo paths `/public/images/kun-logo.png` and `kun_logo.png`; always `next/image` with width and height (the live scene robot no longer uses the logo file, rule 392).
65. `ConversationDialog` `lastProcessedMessageId` ref initializes to `newMessage?.id ?? null` (prevents double append on pending→human).
66. `FaqCard` accepts `answerSuffix`.
67. `DemoCard` plays `/public/videos/kundesk-demo.mp4`.

**Counting, quota, notifications (68–86)**
68. Quota, stats and charts count only `role = 'user'` messages.
69. `messagesUsed` increments for all customer messages (AI and human mode), guarded by an atomic `messagesUsed < messagesLimit`.
70. Handoff requests and human mode bypass the quota pre-check on purpose; never "fix" it.
71. `processedWebhooks.source`: `"midtrans"`, `"system"` (quota), `"clerk"`.
72. Quota idempotency keys: `QUOTA-FULL-{orgId}-{YYYY-MM}`, `QUOTA-WARN-...`, source `"system"`.
73. Chart queries filter `role = 'user'`.
74. `getDashboardCharts` bundles the chart queries.
75. Chart query key `["dashboard", orgId, "charts"]`, invalidated with a 2s debounce.
76. `usage:updated` fires for all customer messages.
77. `conversation:return` fires on the org channel AND the customer widget channel.
78. `ChatPage` binds `conversation:return` and sets handoff to `ai`.
79. `human_agent` is remapped to `assistant` before OpenAI.
80. Quota notifications: `quota_warning` at 80%, `quota_full` at 100%, once per period.
81. `plan_upgraded` notification is awaited after activation.
82. `quota_reset` notification fires per org in `reset-usage`.
83. `NotificationPanel` treats `|` as a delimiter; never put `|` in a plain body.
84. `RecentConversationsPanel` uses `getRecentActiveConversations` (last 24h); no `isExpired`.
85. That query sorts in SQL (pending_handoff first, then newest); the client also sorts for Pusher updates.
86. The panel's count label is "pesan aktif".

**Dashboard and misc (87–134)**
87. The old dashboard layout rule is superseded by rules 350–356 and, for the live workspace, 384–404.
88. Repair `messagesUsed` drift with `UPDATE orgs SET messages_used = (SELECT COUNT(*) FROM messages WHERE org_id = orgs.id AND role = 'user') WHERE id = '...'`.
89. PostHog tracks 7 events, all fire-and-forget, `distinctId = orgId`, never `systemPrompt`.
90. PostHog is product analytics; dashboard charts come from Neon.
91. `POST /api/conversations/[id]/dismiss` returns `pending_handoff` to `ai`; 409 otherwise.
92. Dismiss canned message: "Mohon maaf, admin tidak bisa membalas pesanmu sekarang. Tetap cerita sama KUN ya, aku siap membantu! 😊", role `assistant` in DB and Pusher (so the live scene treats it as a plain KUN reply, rule 395).
93. "Abaikan" button shows only for `pending_handoff` (danger style, `useTransition`).
94. Handoff spam is guarded: detection only runs when status is `ai` or null.
95. "Kak" grammar rule lives in `rag.ts`.
96. Features section layout comes from the `FEATURES` constant.
97. `RagPreview` is an animated loop driven by `CHAT_SCRIPT` / `STEP_DELAYS`.
98. `ping-slow` keyframe is CSS in `globals.css` (not Tailwind `animate-ping`).
99. `chatBubbleIn` variant in `lib/animations.ts`.
100. `formatRelativeTime(date, now?)`; pass `now` in ticking contexts.
101. `useNow` hook in `ConversationRow.tsx`.
102. `activeConversations` stays in `useMemo`.
103. `suppressHydrationWarning` on relative-time spans.
104–106. Legal components live in `components/landing/legal/` and share `PrivacyHero`, `PrivacySection`, `Checklist`; constants in `terms-constants.ts`, `refund-constants.ts`.
107. The GitHub repo is public on purpose.
108. Docker is not used.
109. OG image: `app/layout.tsx` points at `/images/og-image.png` (Kevin confirmed that file is real); the `.webp` claim may be stale. A new og-image (gold KUN robot with laptop) exists; whether it replaced the old file was not confirmed.
110. Midtrans webhook URL: `https://kundesk.vercel.app/api/webhooks/midtrans` (sandbox and production are separate dashboard settings).
111. Finish redirect is set per request via `callbacks`; the dashboard-level setting alone does not work.
112. Neon sleeps after inactivity; first query takes 2–5s.
113. Pusher auth stays `transport: "ajax"` + `headersProvider`. Never `"fetch"` or `customHandler`.
114. Dark mode is scoped to the dashboard layout, not the root layout.
115. Theme provider is `@teispace/next-themes@3.1.1` (replaced `next-themes`); keep its settings.
116. Theme toggle renders a placeholder until mounted.
117. PlanCard CTA text uses `text-white`.
118. `getAnsweredRate` capped at 100%.
119. `payments_org_pending_unique_idx`: one `pending` row per org (live).
120. `insertPendingPayment` runs right AFTER `createSubscriptionTransaction` (needs the `orderId`), for checkout and renewal alike.
121. `lib/db/schema.ts` is the schema source of truth; query `information_schema.columns` before guessing columns.
122. Manual Neon changes must be mirrored in `schema.ts` AND get a `migrations/` record (via `db:generate`; never run `db:migrate`/`db:push`); merge order matters.
123. Real-mode Midtrans transactions expire in 24h.
124. `documents/process` always uses the DB `s3Key`.
125. Sentry only auto-captures uncaught errors; a `console.error` in a catch is invisible. Full audit still deferred.
126. Use `requireOrgAdmin()` for admin mutations.
127. Every mutation re-verifies permissions; UI gates are never enough.
128. `org:member` is conversations-only, with Documents/Team/knowledge view-only and Widget Embed open.
129. Analytics uses a soft lock (blur + overlay) with `aria-hidden`.
130. `payments_org_status_created_idx` is live.
131. Dead `PLAN_LIMITS` fields removed (rule 148).
132. Org-scoped client query keys include `orgId` from `useOrganization()`.
133. E2E rows are cleaned in `afterEach`.
134. For an "intermittent" Playwright failure, get the real HTTP evidence before theorizing.

**Phase 16 (135–170)**
135. Customer widget channel is `private-conversation-{channelToken}` with `/api/pusher/conversation-auth` requiring a matching `sessionId`.
136. E2E for channel auth: `e2e/06-pusher-channel-auth.spec.ts`.
137. Org deletion is a 30-day grace period (`deletionRequestedAt`); `org-purge` is the only cron that deletes org data.
138. `orgs.purgingAt` is an atomic claim marker.
139. `org-purge` deletes the Clerk org before the DB row; a Clerk 404 is success. Retry safety was improved by rule 325.
140. `payments.orgId` is nullable with `ON DELETE SET NULL` (accounting retention).
141. `activateSubscription()` accepts an optional transaction handle.
142. A live FK constraint name can drift; check `pg_constraint` first.
143. `e2e/auth.setup.ts` has a known local-only flakiness (not chased). A CI-only failure of the same file had a different cause (rule 224).
144. `subscriptionStatus: "suspended"` is no longer set anywhere; `past_due` (day 3 email) escalates to a real downgrade at day 7.
145. `downgradeToFree(orgId)` returns `boolean`.
146. The old suspended-abandonment trigger was removed with the cron (rule 280).
147. Orgs already `suspended` before that change needed a manual Neon fix.
148. Dead `PLAN_LIMITS.chatbots/customBranding/apiAccess` removed.
149. `orgs.midtransCustomerId` dropped (Neon change must land in master through the PR gate first).
150. `orgs.suspendedAt` kept on purpose (now read and written by nothing).
151. Document upload validation and processing reliability pass is the pattern for pipeline stages that can leak infra error text.
152. One-off Bible doc-drift correction (Sections 6, 7) at Kevin's request.
153. The Midtrans webhook returns 503 + Sentry for unexpected errors; never 200 for an unrecorded payment.
154. `processedWebhooks` is written only when an order is truly finished.
155. `OrgPurgingError` is the only transaction error answered "mark processed, 200, flag in Sentry".
156. `markPaymentSuccess` takes a tx handle; `markPaymentClosed` updates only `pending` rows; use `.onConflictDoNothing()`.
157. Snap sends no webhook when a checkout merely expires; a failed attempt can be retried on the same `order_id`.
158. `cancelMidtransPayment(orderId, redirectUrl)` closes the payment first, then the Snap page.
159. `cancelPendingPaymentAction` reads the order from the DB and updates the row only if Midtrans confirmed.
160. A settlement for a non-pending row is activated anyway, with a Sentry warning (rule 253).
161. Midtrans Subscription API supports only card and GoPay tokenization; the cron + email renewal flow stays.
162. VA fee Rp 4.000 is exclusive of 11% VAT (real Rp 4.440); QRIS is cheapest.
163. Test conventions: `vi.hoisted` mutable `mockEnv`; a `Response` body reads once; a class used with `instanceof` is defined inside the `vi.mock` factory.
164. Process: commit message first, then PR description; answer Kevin's exact question first; don't assert vendor behavior from docs when a live check is cheap.
165. `getOrgsDueForRenewal` picks overdue orgs, not just today's.
166. `markPastDue` restarts the grace clock with `GREATEST(nextBillingDate, NOW())`.
167. The day-3 past-due email awaits the send before recording its idempotency key.
168. `PastDueEmail` states the real consequence (full access until day 7).
169. `expireStalePayments()` now runs inside `payment-reconcile` AFTER the reconcile step (rule 261).
170. **Hard prerequisite for the first real customer: the Resend sender must move to an owned domain** (`DEFAULT_FROM` / `RESEND_TO_EMAIL`). Still pending.

## Rules 171–317 (condensed)

**Structured knowledge (Phase 17, 171–232)**
171. Knowledge model: `business_profiles` (one row per org) holds always-needed facts; `knowledge_sections` (`kind`: catalog | faq | policy | promo | note) group `knowledge_entries`.
172. `chunks.document_id` is nullable; `entry_id` / `section_id` are new nullable owners (cascade); CHECK `chunks_single_owner_chk`.
173. `EntryPrice` is a discriminated union: fixed / range / variants / contact. KUN must never invent a price.
174. An entry compiles to its own chunk; a catalog section also gets summary chunks when it has 2+ entries.
175. `isAvailable = false`: catalog stays searchable with a status line; every other kind compiles to zero chunks. Verified for all five kinds (rule 222).
176. Always-needed profile facts go into the system prompt directly, not through retrieval.
177. Open/closed status and the greeting word are computed in code (`helpers/opening-hours.ts`); how often KUN uses the greeting needed a structural fix (rule 218).
178. `HoursLine` is structured: `{ days, opens, closes ("24:00" allowed), note? }`.
179. One shared line validator guards every opening-hours path.
180. Stored hours are validated at every read boundary.
181. Sync write contract: every content-changing action sets `syncStatus: "stale"` + `updatedAt` in one UPDATE, then syncs; embedding happens outside any transaction.
182. Deleting the last (or second-to-last) entry of a catalog section deletes the summary chunks in the same transaction.
183. `updateSection`'s "nothing changed" fast path must not report `synced` from field equality alone.
184. `PLAN_LIMITS.knowledgeEntries`: Free 50, Starter 300, Pro 1000; `MAX_KNOWLEDGE_SECTIONS` 30; `checkKnowledgeWriteLimit` 200/hour/org.
185. `orgs.timezone` (default `Asia/Jakarta`) drives KUN's clock; auto-detect and a Settings picker exist now (rules 237–240).
186. `/dashboard/documents` redirects to `/dashboard/knowledge`.
187. Nav label is "Info Bisnis"; the default tab was reversed in rule 213.
188. `KnowledgePage.tsx` owns the shared header and tabs.
189. Radix `Tabs` unmount inactive content; E2E must re-click the tab after every `page.goto()`.
190. Segmented-pill tab styling is local to `KnowledgePage.tsx`; the shared `tabs.tsx` is untouched.
191. Editor types (`types/knowledge-editor.ts`) carry a client `editorId` that is stripped before the Server Action; `EntryDialog` mirrors the pattern.
192. CodeRabbit profile-form findings (unstable keys, midnight toggle) were fixed.
193. `getBusinessProfileForEdit(orgId)` is separate from the chat route's `getBusinessProfileData`.
194. Section/entry CRUD is dialog-based (needed for ~190-entry catalogs); the original "third tab" justification was wrong and was reversed (rule 202).
195. `PriceEditor` renders only for catalog sections; save payload nulls `price` for other kinds.
196. A section's `kind` locks in the edit dialog once it has entries (UI-only guardrail).
197. `StaleSyncBanner` (admin-only) retries stale syncs; a Major CodeRabbit bug in it was fixed.
198. A Turbopack + `next/font/google` deploy failure was solved by a plain redeploy.
199. `e2e/07-knowledge-limits-and-isolation.spec.ts` shipped (rule 26 exception).
200. `serial` describe mode was tried and removed.
201. **Orphan summary chunk (unconfirmed root cause).** Symptom once seen: catalog entries all `synced` yet no summary chunk. Theory of an unlocked pre-embed read was disproven (fingerprint recheck returns `superseded`). Three manual repros (sequential add, rapid edit, two-tab concurrent edit) were negative; the third confirmed the safety mechanism turns a race into a visible `stale` state. Sync is delete-then-recreate, the only plausible window. Passive monitoring: daily `knowledge-health` cron (rule 234). If it ever alerts, repair with `syncSection(orgId, sectionId)` or re-save an entry.
202. Knowledge UI is two top-level tabs; Katalog & FAQ is a sub-section of Isi Manual, not its own tab.
203. Commit messages with quotes: use `git commit -F - <<'EOF'`, never `-m "..."`.
204. The mockup is inspiration, not a spec.
205. Katalog keeps named sections + dialog CRUD (no flat table). Restyle dropped (decision 38).
206. FAQ / Kebijakan / Promo / Note keep separate `kind` structure; visual merge dropped.
207. Save semantics: per-item immediate save for Katalog/FAQ entries; one batch "Simpan" for profile fields.
208. A "Kelengkapan data profil" completeness score is deferred (no formula exists).
209. `NumberedSection.tsx` is the shared card header.
210. Isi Manual has sub-tabs: Identitas & Kontak / Jam Operasional / Metode Pembayaran / Katalog & FAQ; each profile sub-tab has its own "Simpan" for the same profile object.
211. `KnowledgeSectionsPanel`'s `sections` state is a controlled prop owned by `ProfileForm` (prevents reset on tab switch).
212. `NumberedSection`'s `number` prop is optional; `QuickNav.tsx` deleted.
213. Tab renamed "Profil" → "Isi Manual"; default tab is **Dokumen** (Kevin's call).
214. `KnowledgePage` subtitle explains the two ways to feed KUN.
215. Mobile responsive pass across Isi Manual sub-tabs (Claude's part and Kevin's own part on dialogs).
216. Button-name collisions in E2E are avoided by scoping to `getByRole("dialog")`.
217. KUN date/time: instruction now explicitly permits stating the date and time to customers.
218. Greeting: `isFirstMessage` (`conversationHistory.length === 0`) makes KUN greet only on the first turn.
219. Stale open/closed status bleed is mitigated by an override instruction (LLM adherence, not deterministic).
220. `chunks_single_owner_chk` is live; query entry chunks by `entry_id`, not `section_id`.
221. Chunk sync is delete-then-recreate (new ids each time).
222. `isAvailable = false` fully verified for catalog, faq, policy, promo, note.
223. Timezone default problem: fixed in Phase 18 Session 1.
224. The E2E Clerk org was deleted by accident; CI broke deterministically. Fixed by a new org "Warung E2E" (`org_3K3gdlREXt5pd8eOh1Fr1LcEL3f`), updating the `E2E_ORG_ID` secret, seeding the E2E DB, and renaming the assertion. Own PR.
225. Query `information_schema.columns` before writing a query for an unfamiliar table.
226–232. (Anchors folded into 217–225; rule 229's Topbar clock is superseded by 242; rule 230: `EntryDialog.tsx` / `SectionDialog.tsx` were reviewed and are clean.)

**Phase 18 (233–287)**
233. **Clerk production needs an owned domain** (`*.vercel.app` cannot be used). Switching broke login (`/__clerk/v1/proxy-health` 404, meaning inferred). Rolled back to dev keys (Kevin's word). Migration is ONE future session: DNS, Clerk production domain, Vercel domain, `NEXT_PUBLIC_APP_URL`, Midtrans callbacks and webhook URL, Pusher auth, re-register the Clerk webhook (new signing secret), Resend sender, and the dev-user/org data question.
234. `knowledge-health` cron (`0 21 * * *`, report-only): catalog sections with 2+ synced entries and no summary chunk; synced entries without chunks. One fixed Sentry message `knowledge-health: missing chunks detected`; failing checks return 500.
235. `DocCountBadge` removed from the sidebar by Kevin (it is still rendered by `KnowledgePage.tsx`, so `getDocumentCount` stays, rule 279).
236. `orgs.timezone_detected_at` added by hand in Neon; migration `0007` is a RECORD ONLY.
237. `autoDetectTimezone`: once per org, admin only, trusts only Indonesia's four IANA zones, never overwrites a manual value.
238. `updateOrgTimezone`: any valid IANA zone, stamps the marker, invalidates the org cache.
239. `<TimezoneAutoDetect />` mounts only for admins with a NULL marker, reads `Intl` directly (never the fallback helper), invalidates `["dashboard"]` queries.
240. Settings `TimezoneSection`: WIB/WITA/WIT buttons plus a search list; Enter is blocked inside the form.
241. `helpers/format.ts`: `isIndonesianTimeZone`, `getUtcOffsetLabel` (normalizes `GMT+00:00` to `UTC`), `formatLocalClock(date, timeZone?)`.
242. The org timezone is the single source of truth for the dashboard (`getOwnerTimezone()`); the `tz` cookie is gone; the Topbar shows business time as `UTC+X`.
243. Business facts use business time; a person's own message time stays on the viewer's device.
244. `lib/actions/settings.test.ts` is the Server Action mocking pattern.
245. Any write to `orgs.timezone` must call `invalidateOrgCache` (inside try/catch).
246. CodeRabbit timezone findings (toast, Enter key, fallback stamping, revalidation, query cache) were all valid.
247. Existing orgs self-detect on their admin's next visit; a test-org backfill was never confirmed.
248. Kevin's working rules: settle decisions before code; ONE ordered numbered step list; no tests before the implementation is applied; manual Neon changes always get a migration record; SQL for the Neon editor must run as pasted; ask to see CSS instead of guessing.
249. The Clerk rollback is closed per Kevin (not independently verified).
250. Webhook layers: body shape (Zod) → signature (401) → idempotency → status → fraud → `status_code` → `settlePaidOrder`. Unexpected errors: 503 + Sentry.
251. `settlePaidOrder` (`lib/billing/settle-payment.ts`) is the ONE settlement path for the webhook and the reconcile cron. The caller decides that an order is paid.
252. The org is resolved from the checkout row's full `orgId`, not the 8-char prefix (prefix only in mock mode).
253. Real mode refuses a settlement with no checkout row; order/plan mismatch is flagged and marked processed; a non-pending row is still activated with a Sentry warning; amount mismatch is flagged.
254. Permanent failures answer 200 + Sentry (never 400); only invalid JSON/body shape is 400.
255. A settlement needs `status_code "200"`; the check runs AFTER the fraud check.
256. Unique-violation inside the activation transaction is re-checked against `processedWebhooks` before answering "already processed".
257. Post-commit work (notification, email, PostHog) can never turn a recorded payment into a 503; email and analytics run in `after()`.
258. `verifyMidtransSignature` uses `timingSafeEqual`; the formula is plain SHA-512, NOT an HMAC. **Since Session 5 it hashes with the SIGNATURE key (rule 372).**
259. `getPaymentByOrderId` returns `{ orgId | null, plan, amount, status }`.
260. `getMidtransTransactionStatus` (Core API Get Status): 404 is inside the body and means never paid; anything without `transaction_status` throws; 3s timeout.
261. `/api/cron/payment-reconcile` (`0 19 * * *`): step 1 reconcile (skipped in mock mode), step 2 `expireStalePayments()`; order matters; a failing step returns 500. Response `{ checked, recovered, flagged, errors, expiredPayments }`.
262. `getReconcileCandidates`: pending rows older than 15 minutes plus expired rows from the last 4 days, skipping processed orders, pending first. Not unit-testable (SQL). Known limit: 404 orders are re-checked for 4 days (a `last_checked_at` column would fix it).
263. Live sandbox verification of the reconcile cron was done on Warung Paco.
264. Orders of purged orgs are marked processed after the first alert.
265. `validateMidtransConfig` (`helpers/midtrans-config.ts`) is called at the end of `lib/env.ts`, only in `midtrans` mode. **Limited heuristic:** this project's sandbox and production keys have no `SB-` prefix, so it cannot tell them apart; the real check is an authenticated call to the endpoint. Rejecting unprefixed keys was declined. **Session 5 extended it for the signature key (rule 372).**
266. `docs/midtrans-smoke-test.md` is the written checklist (9 scenarios). Never `source .env.local` (an `&` in `DATABASE_URL` echoes it); read single values with `grep '^NAME=' .env.local | cut -d= -f2-`; never paste keys, signatures or connection strings; pass secrets via stdin; pay sandbox transactions only through the simulator. Not executed end to end.
267. Test conventions: `after()` mock via `importOriginal`; Sentry mocked as spies; `mockSelectSequence` order is part of the contract; `exactOptionalPropertyTypes` requires `prop?: T | undefined`.
268. Security incident: a Neon password was echoed by `source .env.local` and pasted into chat; rotated. The Midtrans sandbox key printed in Phase 16 was rotated in Session 5 (rule 378).
269. CodeRabbit findings (candidate ordering etc.) were valid; its "reject unprefixed keys" suggestion was declined.
270. Kevin's working rules: a question ENDS the message; confirm a test target exists and is his; state the environment (sandbox vs production); explain what a test simulates before asking him to run it; don't ask him to re-verify what he did.
271. Standard: money-moving or state-changing automation gets a test file in the same PR.
272. The test-coverage agenda was completed (every cron, billing actions, Clerk webhook, `settlePaidOrder`, knowledge sync, `/api/chat` in four files). What is still untested: Open Items Medium #2.
273. Test conventions: `vi.resetAllMocks()` then re-set every default; fake only `Date`; drizzle operators as plain data; Next routes tested only through their handlers; classes used with `new` defined inside the factory; one file per mock shape; `// CHARACTERIZATION` labels; `afterEach` flush for background work; read what a passing test asserts.
274. Cancelled orgs drop to Free after `currentPeriodEnd` via a sweep inside the `past-due` cron (a null period end counts as expired); a failing candidate query returns 500 + Sentry.
275. The Clerk webhook no longer overwrites a custom slug (`organization.updated` updates the name only).
276. A mismatched Clerk webhook signing secret caused `400 Invalid signature` deliveries (likely from the production attempt); fixed, one failed message was resent. A rollback must restore the signing secret together with the keys.
277. `updateOrgProfile` invalidates the org cache before the Clerk sync.
278. The chat completion handler is one-shot (`completionStarted` flag) — a double save was a confirmed bug.
279. Dead code removed (`getLocalTimezone`, `formatUtcOffset`, `lib/ai/stream.ts`); `DocCountBadge` and `getDocumentCount` kept. Grep imports AND typecheck before deleting.
280. The `suspended-warning` cron and email were removed; the cron list is seven: `renewal`, `reset-usage`, `past-due`, `org-purge`, `retention`, `knowledge-health`, `payment-reconcile`. The `suspendedAt` column and `"suspended"` type value stay. `rm -rf .next/dev/types` clears stale type files after deleting a route.
281. `org-purge` stuck claim: fixed in rule 325.
282. Pinned characterizations: `insertPendingPayment` runs after the Midtrans call; non-admin handling differs between actions; a promo over 50 chars answers "Invalid plan selected."; `cancelSubscriptionAction` logs to console only; real-mode no-row settlement is not marked processed; `reset-usage` notifies only non-cancelled orgs; sync errors propagate without Sentry; the renewal cron can leave an org `active` if `markPastDue` throws after the daily marker.
283. `/api/chat` characterizations: most were resolved in Phase 20 Session 1 (Redis 329, failed turns 326, retrieval 327, empty owner email 327). Left on purpose: the greeting repeats after the 90-day purge; first-message handoff fires no `conversation:new`; the usage event reports an optimistic count at the limit; a disconnecting client loses the answer.
284. Rule 201 status: `lib/knowledge/sync.ts` has 26 tests; row locking and rollback cannot be verified by mocks.
285. A GitHub Actions runner outage queued CI; don't spam re-runs; never merge without a green run.
286. Kevin's working rules: one PR at a time; commit message → PR title → PR description; "hold until step N" means stop there; ask for the specific comparison, not "does it exist"; never guess third-party dashboard labels; bugs found by a test ship as their own fix PR.
287. Phase 18 is closed.

**Phase 19 (288–317)**
288. Catalog import: paste text into an "Impor dari teks" dialog from a catalog section row (admin only), review rows, save as normal entries. Nothing from the source is kept. v1 prices: fixed / range / contact; a line with several prices comes back with no price. Photo path now lives in the same dialog.
289. Two actions in `lib/actions/knowledge-import.ts`: `extractCatalogFromText` (all rejections run before the limiter and OpenAI; saves nothing) and `importCatalogRows` (re-validates, one transaction under the org lock, drops duplicate titles, whole batch rejected if over plan slots, syncs only the new entries after the transaction).
290. `syncEntries(orgId, sectionId, entryIds)` rebuilds only the given entries plus the section summary.
291. `lib/ai/extract.ts`: mock-mode line parser; real mode uses `gpt-4o-mini`, temperature 0, strict JSON schema, text fenced as data, Zod re-validation, 45s timeout.
292. Import security: `detectImportInjection` only FLAGS (flagged rows start unselected); `toSingleLine` flattens newlines in titles (charCode loop, not regex); client never trusted; raw input never logged.
293. Text import limiter: 20/hour + 60/day per org.
294. Constants: 25 rows per save, 30 lines per read, 200 rows and 10,000 chars per import, 300-char descriptions.
295. Client logic is pure and tested (`knowledge-import-draft.ts`, `-runner.ts`); the review screen uses the server's own `importRowSchema`.
296. Dialog components live in `components/dashboard/knowledge/sections/catalog-import/`; no component tests exist in the repo.
297. UI gotchas: amounts are text inputs with `inputMode="numeric"`; shadcn `Progress` colors itself with the undefined `bg-primary`; "bagian" means section; no shadcn Checkbox is installed.
298. **Vercel facts (supersede the 10s premise):** Fluid Compute, Hobby default and max 300s; 4.5 MB body limit; function region `iad1`, requests in `sin1`, Neon `ap-southeast-1`. Kevin dropped the function-region change; do not raise it again.
299. Production timing: 30-row read ≈ 8.43s; 17-row save 8.21s; 17-item photo read 9.16s. Read Execution Duration in Vercel runtime logs.
300. Sentry capture gap: closed in Session 1 of Phase 20 (rules 322–323).
301. The E2E database was recreated as a new database and seeded by hand with the Warung E2E org and chatbot rows. Hand-applied objects (`chunks_single_owner_chk`, `payments_org_pending_unique_idx`, extra indexes) may be missing; compare with main if an E2E test touching them fails.
302. No E2E test exists for catalog import (text or photo).
303. Kevin's working rules: answer exactly the question when he is frustrated; tests ship with the code; end every code message with the commands and what to paste back; commit message → PR title → description; one PR per concern; explain causes in plain words before fixes; "ALL CLEAN/GOOD" means proceed.
304. Phase 19 Session 1 closed.
305. Photo import: "Tempel teks | Foto" switch in the same dialog; one photo per read; no preview; the photo is never stored or logged; the owner is told it goes to OpenAI.
306. `POST /api/knowledge/import-photo` is a Route Handler (multipart) answering in `ActionResult` shape with real HTTP codes; every cheap rejection runs before the limiter and OpenAI; 401/403/400/404/422/429/500 mapping.
307. Body size is enforced by `readBodyWithLimit` counting streamed bytes; `Content-Length` is only a fast path (CodeRabbit finding; its "require Content-Length" option was declined).
308. Server accepts JPEG only from real bytes (magic bytes), max 3MB.
309. Browser compression (`helpers/image-compress.ts`): JPEG/PNG/WebP in, ≤25MB, long side 1600px, white fill, quality 0.8→0.6→0.4, EXIF stripped.
310. `lib/ai/extract-image.ts`: `gpt-4o-mini`, 120-row cap, 7000 tokens, 90s timeout; a cut-off answer throws `ImageTooDenseError` (422); text and photo share `ITEM_RULES`, schema and `normalizeRows`.
311. Photo limiter: 10/hour + 30/day per org; estimated cost under one US cent per photo (community estimate).
312. Client side: photo runner and upload helper return the same `ExtractionOutcome`; indeterminate progress bar.
313. Live verification: a real 17-item portrait PNG menu read correctly on production; duplicates detected; a no-items photo handled. Not measured: 100+ item photo, 25-row save, iPhone HEIC.
314. Test conventions: `// @vitest-environment node` for route tests with FormData; assert the message, not just the status; streamed-body test with `duplex: "half"`; `Uint8Array<ArrayBuffer>` for `Response`.
315. Git slip: a commit landed on master; recover with `fetch`, `switch -c`, `branch -f master origin/master`. Always give the branch step first.
316. Kevin's working rules: test instructions must say exactly what to prepare, click and expect; don't re-test what his own test covered.
317. Phase 19 closed.

## Rules 318–369 (Phase 20, Sessions 1–4, condensed)

**Session 1 (318–338)**
318. Section toolbar: "+ Tambah entri" and "Impor dari teks/foto" sit in a toolbar at the top of an opened section; the entry list scrolls in its own box (`max-h-[min(60vh,420px)]`, `role="region"`, `tabIndex={0}`). A search box inside a section is a possible later idea.
319. Clerk webhook deliveries were checked: only one test-org message had failed; resent, now 200.
320. Vercel Cron: seven crons, UTC, Hobby has a 1-hour flexible window, so listed order is NOT a guarantee; ordering that matters belongs inside one function.
321. No `cancelled` org held a paid plan; the old slug dies immediately after a change. The Warung Paco test org may be on the temporary slug `warung-paco-tes`.
322. Sentry production capture is PROVEN on the webhook Route Handler (a signed fake settlement gave a Sentry issue and an alert email).
323. **Tripwire:** the earlier import-timeout event never reached Sentry (unexplained). If a catalog import fails in production and its event is missing again, add `await Sentry.flush(2000)` then. Unverified suspicions: `automaticVercelMonitors`/`removeDebugLogging` inside `webpack: {}` under Turbopack; `tunnelRoute` vs the Clerk `proxy.ts` matcher.
324. `docs/midtrans-smoke-test.md` scenario 5's example id was wrong; fixed in Session 5 (`KUNDESK-org_NOPE-STARTER-1`). The sandbox dashboard has no "send test notification" button.
325. `org-purge`: a claim older than 6 hours is taken over; the claim is NOT released on failure (so `cancelOrgDeletion` cannot restore an org already gone from Clerk); every failure goes to Sentry with a step tag; a failing candidate query answers 500; response `{ message, processed, failed, retriedStale }`.
326. A failed AI turn leaves no trace (nothing saved, counted or announced); saving without counting would break the Total Pesan / Kuota Pesan invariant.
327. Retrieval failure degrades to "no context" with a Sentry alert; no usage email without an owner address.
328. All chat test files mock `@sentry/nextjs`.
329. Redis on the chat path fails open (`lib/redis/fail-open.ts`: 2s timeout, 30s breaker, Sentry throttled to once per 5 minutes, fingerprint `redis-unavailable`). `/api/search` and every other limiter stay strict.
330. The three cache getters fall back to Neon; invalidation stays strict. `/api/search` and `/api/chat` share one rate-limit bucket.
331. PR B tests: `fail-open.test.ts`, cache fallback tests, three route tests; reset breaker state in `beforeEach`/`afterEach`.
332. Document upload findings: no magic-byte check existed; the 10MB limit was only what the browser claimed. Left out on purpose: docx zip-bomb protection and orphan-object cleanup for rows never created.
333. `helpers/file-signature.ts`: pdf `%PDF-` in the first 1024 bytes, docx zip header, txt/md reject NUL bytes (UTF-16 text is now refused).
334. `process` checks the real object size (`getS3ObjectSize`, HeadObject) before download and the buffer size after; HeadObject works on R2 (rule 366).
335. Test conventions: mock `fs/promises` with a `default` export; fake-timer timeout pattern; hoisted state object.
336. `documents/process` is idempotent: early 409 when not `processing`; one transaction under `FOR UPDATE` replaces chunks and sets `ready`; guarded `markFailed`; `requireOrgAdmin`; 400 on bad JSON. Known limit: two simultaneous calls can both spend embedding money.
337. Kevin's working rules: decisions with a recommendation first; read the code before recommending; find the cheapest proof; steps start with the branch; explain dashboards before asking him to open them.
338. Session 1 closed.

**Session 2 (339–349)**
339. README refreshed (docs-only, direct to master); "Challenges" and "Early Traction" untouched.
340. Landing framing is "three ways to teach KUN" (document, photo or pasted price list, Isi Manual); photo wording stays "foto menu atau daftar harga".
341. Plan feature lists live in TWO files (`PRICING_PLANS` in `landing-constants.ts` and `PLAN_CONFIG` in `components/dashboard/billing/constants.ts`); change both until merged.
342. Public claims: a number in a sentence needs a measurement; a number inside a mock screenshot does not. "Setup 5 menit" is still unmeasured.
343. Hero, CTA and SEO text updated; one shared description; "Jadwalkan Demo" became "Lihat Demo".
344. Privacy, terms and refund pages corrected against the code (not a legal review): Neon Singapore, Pusher `ap1`, Upstash `ap-southeast-1`, OpenAI's role in imports, no conversation export exists, `past_due` and cancel behavior, 30-day deletion. Left alone: "7 tahun" retention, Clerk two-factor line, reply-time promises, the 7-day notice of material changes, the inferred IP-address line. Nothing is said about content above Free limits after a downgrade.
345. One contact address: `CONTACT_EMAIL` in `lib/constants/contact-constants.ts`; change that one line when a domain exists.
346. Fake social proof removed (testimonials not rendered but the component kept; trust strip is business types; the hero count card is static and `getActiveOrgCount` is now unused).
347. Kevin's working rules: FIND/REPLACE blocks one file at a time; a question ends the message; one concern per PR; docs-only may go direct to master; accept his declines.
348. Session 2 closed.
349. **Plan prices:** Starter Rp 79.000 (first-time 49.000), Pro Rp 149.000 (first-time 99.000). `PLAN_PRICE` / `PLAN_FIRST_TIME_PRICE` in `types/billing.ts` are the only source. A checkout opened before a price change still settles (the webhook compares the stored amount). Open: push QRIS as the default method.

**Session 3 — Dashboard Live Overview (350–356)**
350. `/dashboard` is a real operations view: three desktop rails (queue + compact activity summary; "Ruang Percakapan Live"; Knowledge KUN / quota / health / priorities). Sidebar and Topbar unchanged. Data is server-loaded (`getLiveOverviewSnapshot`, `getRecentActiveConversations`, `getLiveConversationPreview`, `getDashboardCharts`, `getRecentKnowledgeItems`), all org-scoped. **The live workspace was upgraded to an illustrated scene in Session 6 (rules 384–404).**
351. The live conversation is the one with the newest real message in the last 24h, in ALL handoff modes; it links to Conversations and is not a reply/takeover client; motion fires only on real Pusher events.
352. `handoffStatus` is the current state; `wasHandedOff` is the permanent historical flag used for "Handoff" health.
353. Knowledge KUN rail: at most three newest items across ready documents and manual sections; the summary counts all chunks.
354. Queue shows about five conversations then scrolls; `ActivitySnapshotCard` links to Analytics; only `role = 'user'` is counted.
355. Pusher invalidates the dashboard query keys including `live-conversation` and `recent-knowledge`; Pusher is a refresh signal, never permission to fabricate content.
356. File map: `lib/db/queries/dashboard.ts`, `lib/actions/dashboard.ts`, the dashboard page, `types/dashboard.ts`, `DashboardOverview.tsx`, `RecentConversationsPanel.tsx`, `LiveConversationWorkspace.tsx`, `KnowledgeKunPanel.tsx`, `ActivitySnapshotCard.tsx`, `pusher-provider.tsx`. E2E asserts the heading "Ruang Percakapan Live". Do not resurrect `KunOperationsBoard.tsx` or `AdminHandoffPreviewPanel.tsx` (the live scene in rule 384 is a different, state-driven component inside the workspace).

**Session 4 — R2, preview, delete (357–369)**
357. **Storage is Cloudflare R2** (the AWS account is gone). Env names kept: `KUNDESK_STORAGE_MODE=s3`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` hold R2 values; `AWS_REGION=auto`; new `S3_ENDPOINT`. Account API token, Object Read & Write, one bucket, Asia-Pacific location hint. CORS: origins `https://kundesk.vercel.app` and `http://localhost:3000`, methods PUT and GET, no DELETE (deletes run on the server). `.env.e2e` stays mock. Unverified: R2 free-tier size and whether a card is required.
358. `lib/aws/s3.ts` builds the client in one `createStorageClient()` (endpoint, credentials, checksums `WHEN_REQUIRED` — necessity unconfirmed, leave it). Exports: `generatePresignedUploadUrl`, `downloadFromS3`, `getS3ObjectSize`, `generatePresignedDownloadUrl`, `deleteFromStorage`, `deleteOrgFiles`, `saveMockUpload`, `generateUploadId`. `env.s3Endpoint` is optional, so a missing endpoint fails at the first storage call, not at startup.
359. Public wording says Cloudflare R2 with location "Asia-Pasifik" (no country claimed); the encryption line was checked against Cloudflare's docs.
360. Preview routes (open to every org member, same 404 for missing and foreign): `GET /api/documents/[id]/chunks?page=N` (20 per page ordered by `chunks.id`, Neon only) and `GET /api/documents/[id]/file[?mode=download]` (60-second signed link; `{ available: false }` only when the object is confirmed missing; other storage errors answer 500).
361. `DocumentPreviewDialog.tsx`: "Teks yang dipelajari KUN" (default) and "File asli" (PDF in an iframe; other formats download only); new-tab and download ask for a FRESH link; focus returns to the clicked name; verified on production.
362. `helpers/storage-errors.ts` `isMissingObjectError`: true only for `NotFound` / `NoSuchKey` / ENOENT / HTTP 404; `NoSuchBucket` is not missing. The real R2 `NotFound` shape for HeadObject is unconfirmed.
363. Document query keys include the org: `["documents", orgId]`, `[..., "usage"]`, `[..., docId, "chunks"]`, `[..., docId, "file"]`; `DocCountBadge` keeps `["documents", "count", orgId]`.
364. Deleting a document deletes its R2 file FIRST (a missing file counts as success), then chunks and row.
365. `deleteOrgFiles(orgId)` (guarded by `/^org_[A-Za-z0-9]+$/`, lists and batch-deletes `orgs/<orgId>/`, any `Errors` entry throws) runs in `org-purge` after the claim and before Clerk and the DB row (step `storage`). Verified live with a throwaway org. **The purge cron processes EVERY org past its grace period; check `SELECT id, name, deletion_requested_at FROM orgs WHERE deletion_requested_at IS NOT NULL;` before repeating that test.**
366. Verified: presigned upload, processing, PDF preview on production, `DeleteObjects` and token delete permission, HeadObject through R2. Not verified: the production delete route, the R2 `NotFound` shape, R2 free-tier numbers.
367. Test conventions: `vi.resetAllMocks()` wipes return values set inside a `vi.mock` factory (hoist and re-set in `beforeEach`); a counter inside a factory leaks across tests; `invocationCallOrder[0]` can be undefined (use infinity fallbacks).
368. Kevin's working rules: accept a stated environment fact; never guess third-party menu labels; short numbered steps; answer "why" in one short paragraph; real live check before anything that deletes data; never paste a full presigned URL.
369. Session 4 closed.

---

## Rules 370–383 — Phase 20, Session 5

370. **Midtrans has three separate keys (new dashboard).** Server Key (generated by hand; authenticates API calls: Snap create, Cancel, Get Status), Client Key (Snap in the browser), Signature Secret Key (auto-generated; "used to verify payment notifications"). Previously one server key did both jobs. Sandbox and production each have their own set. Both sandbox keys now start with `SB-`.
371. **Server Key permissions chosen:** Snap Checkout = Write, Core API = Read, Capability → Cancel transaction = Write; Payment Link, Invoicing, Subscriptions, Expire, Refund, Check balance = None; no expiry (a custom date would silently break payments). The form has no IP restriction field. If a feature fails with a permission error, raise that one row. A narrower key limits damage if it leaks.
372. **`MIDTRANS_SIGNATURE_KEY` (merged; 59 files, 1373 tests then).** `env.midtransSignatureKey` is read in `lib/env.ts`. `getSignatureKey()` in `lib/midtrans/index.ts`: real mode uses only the signature key with NO fallback to the server key (a silent fallback is what hid the problem); mock mode falls back to the server key so local dev and CI need no new variable. Only `verifyMidtransSignature` and `fireMockWebhook` use it. `validateMidtransConfig` now requires it in `midtrans` mode, rejects whitespace around it, and rejects an `SB-` signature key when `MIDTRANS_IS_PRODUCTION=true`; it is deliberately NOT in the "different environments" check. `MidtransConfigInput` got `signatureKey`. The webhook `route.ts` and `route.test.ts` needed no change. Vercel: production signature key in Production scope, sandbox one in Preview; also needed in `.env.local` or `npm run dev` refuses to start (that is the guard working). `docs/midtrans-smoke-test.md`: the signed-request command reads `MIDTRANS_SIGNATURE_KEY`, the production checklist lists all three keys, scenario 5's example id was fixed.
373. **First real production payment and incident.** Production keys were set in Vercel; a real QRIS payment of Rp 2.980 (Pro with a 98% promo, order `KUNDESK-org_3Fno-PRO-1795486470201-P1`) succeeded at Midtrans (money received) but our webhook answered `401 Invalid signature` repeatedly (it still hashed with the server key). Result: `payments` row stuck `pending`, no `processed_webhooks` row, org unchanged, UI showed PENDING. Recovery without code: called `/api/cron/payment-reconcile` on production with the `CRON_SECRET` Bearer header; it returned `{"checked":1,"recovered":1,"flagged":0,"errors":0,"expiredPayments":0}`, the plan switched and the "Pembayaran Pro Berhasil" email arrived. This was the reconcile cron's first real-world use and it worked. Lesson: with a rotated or split credential, test EACH job (API call, notification signature) separately.
374. **Mistakes recorded:** Claude asked Kevin to test a sandbox payment while the sandbox notification URL points at production (`https://kundesk.vercel.app/...`), so nothing could have reached localhost; offered tunnel/curl options when Kevin wanted ONE path; and once suggested a sandbox endpoint switch. Decision: skip the sandbox test and the signed-curl proof; the real production payment is the only real proof of the signature key (unit tests mock the verification).
375. **Promo codes.** Table `promo_codes`: `id, code, discount_percent (integer, percent only), applicable_plans (text), valid_from, valid_until, max_uses, used_count, is_active, created_at`. `validatePromoCode` runs `JSON.parse(applicable_plans)`: it must be a JSON array string like `["pro"]` (NULL = all paid plans); the plain value `pro` was treated as malformed and returned null ("Kode tidak valid") — Claude's guessed SQL was wrong; read the validating code before handing over SQL. `used_count` increments only when the order settles; `max_uses = 1` burns the code after one settlement. `checkHasActivePromo()` takes no plan argument, which is why every card showed the badge (fixed in rule 376). Test method: a 98% code on Pro (about Rp 2.980) instead of editing `PLAN_PRICE`.
376. **Promo preview (merged).** New `helpers/promo-price.ts` `applyPromoDiscount(price, percent) = Math.floor((price * (100 - percent)) / 100)` (integer math), used by `createPayment` and `PlanCard`, so the shown price equals the charged price. New `previewPromoCode(rawCode)` in `lib/actions/billing.ts`: `requireOrgAdmin`, trims, accepts 1–50 chars, calls `validatePromoCode` for starter and pro, returns `PromoPreview { starter: number | null; pro: number | null }` (type in `types/billing.ts`); read-only, no transaction, no row, no revalidate. `BillingPage` calls it on apply with an `applyCounter` ref so a slow answer for an old code cannot overwrite a newer one; a failed lookup shows no discount (checkout still validates). `PlanCard` takes `promoPercent`: it shows the regular price crossed out, the discounted price and a "Diskon N% dengan kode promo" badge only on plans the code applies to; the first-time badge shows only when no promo applies. If you click a plan the code does not apply to, checkout still says the code is invalid (the server stays the judge). Tests: helper (5) and `previewPromoCode` (8).
377. **Second real payment: everything worked.** After rule 372 was deployed, Kevin applied `UJIBAYAR2` (98%, `["pro"]`) on production for Kedai Bu Sari: only the Pro card showed Rp 149.000 crossed out and Rp 2.980; he paid with a real QRIS wallet; the plan switched to Pro, history showed success, the bell appeared, and the Vercel logs had no `Invalid signature`. The signature key is now proven against a real Midtrans notification. The `processed_webhooks` query result was not pasted.
378. **Midtrans sandbox key rotation is DONE.** All sandbox keys were regenerated (the key printed in chat in Phase 16 is dead). A new Server Key for sandbox and one for production were generated the same way.
379. **Emails.** The pending-payment email and the "Pembayaran Pro Berhasil" email reached Kevin's own address. The Resend sender is still not on an owned domain (rule 170), so do not assume customers receive these emails.
380. **How Kevin wants instructions (he got angry twice in Session 5):** ONE path, in order, each step with the exact FIND / REPLACE text and the file name; never vague wording like "change as they are"; never several alternatives when he asked for one; when he says everything is already set up, stop asking checks and give the next step; tell him WHICH line, in WHICH file. Explain a concept in plain words before asking him to run something.
381. **Claude mistakes to avoid:** handing over guessed SQL (the `'pro'` value); guessing why the badge showed on both cards before seeing the code; proposing a sandbox test whose notification goes to production; over-complicating the next step after a tired or angry message.
382. **Handoff policy (Kevin's decision):** update `kundesk-phase-handoff.md` as ONE file; do NOT create supplements; fold earlier supplements in; present the file with `present_files`. The old document is condensed because reproducing it word for word is not reliable in one pass.
383. **Merge status:** all PRs of Session 4 and Session 5 are merged and deployed, per Kevin.

---

## Rules 384–404 — Phase 20, Session 6: the live scene (NEW)

**Decisions and principles**
384. **"Not a game" is reversed for the Live Workspace only.** Kevin wanted a game-like illustrated scene in "Ruang Percakapan Live" (3D-looking avatars, KUN robot, operations between them). Built as inline SVG + Framer Motion; NO canvas, Three.js or game engine. The honesty rules of the original brief still hold: the scene moves only for real events and never shows fabricated traffic, presence ("Online/Siaga"), typing ("KUN sedang mengetik"), message text in pop-ups or CSAT. `KunOperationsBoard.tsx` and `AdminHandoffPreviewPanel.tsx` stay dead (rule 356).
385. **State is a pose, events are flourishes.** Poses come from data and are always true (handoff status, bot active, quota, who took over). Events come from Pusher, play once and never replay on load or refetch.
386. **Event replay fix (first PR).** The store's single `liveWorkspaceEvent` slot is never cleared, so remounting the workspace replayed the last packet, and `Date.now()` ids collided. Ids now come from a counter (`liveWorkspaceEventSeq`). The workspace later moved to the queue hook (rule 394), which only sees events that arrive after mount. Store test pins the single slot with a `// CHARACTERIZATION` label.

**State and data**
387. `helpers/live-scene.ts` + `types/live-scene.ts` (pure, tested): `deriveSceneState` returns mode (`ai | pending | manual`), `statusLabel` (same wording as before: "Menunggu admin mengambil alih" / "Admin menangani percakapan" / "KUN menangani percakapan" / "KUN sedang nonaktif"), `quotaLevel` (warning from 80%, full at 100%, integer math, a zero limit is `ok`), `kunPose` (`off | active | tired`; off wins over quota, tired at full quota), `customerPose` (`absent | idle | waiting`), `adminPose` (`idle | alerted | working`), channel and session labels, admin name and ownership. Also `getQuotaCrossing`, `getKunReplyKind`, `getChannelLabel`.
388. **Admin desk name rules.** `takenOverBy` is trusted only in manual mode (it can be stale after a return). The viewer's own takeover shows "Name (Anda)" (Clerk `useUser` first name, else full name, else "Admin"); another member shows their resolved first name (rule 390), "Staf lain" only when that could not be resolved; manual mode with no recorded taker shows "Staf"; an idle desk shows the viewer's first name. The viewer's name is never shown for someone else's work.
389. **`takenOverBy` bug.** The first staff reply to a pending handoff (implicit takeover in `reply/route.ts`) set `human` and `takenOverAt` but not `takenOverBy`, so the desk could only say "Staf". The reply route now stores `takenOverBy: userId` and sends it in the `conversation:takeover` payload (same shape as the takeover route). First tests for a conversations route: `reply/route.test.ts` (8 tests). Rows taken over before the fix keep a null taker until they leave the 24h window. **Claude mistake recorded:** it first said the takeover route never wrote `takenOverBy` without having read it (the grep found the real cause).
390. **Staff name lookup.** `LiveConversationPreview` carries `takenOverBy` and `takenOverByName`. `getLiveConversationPreview` calls `getOrgMemberFirstName(orgId, userId)` (`lib/clerk/org-member-name.ts`) only when the status is `human` and a taker is recorded. It uses Clerk `getOrganizationMembershipList` filtered by `userId` (the same call the Team actions use; it also proves the person belongs to THIS org), trims the first name, caches 5 minutes per `org:user` key per server instance (cap 500 entries), and on failure returns null, reports to Sentry (`area: live-scene-staff-name`) and waits 30s before asking again. Both the server-loaded first render and the refetch action inherit it, so `page.tsx` and `getLiveConversationPreviewAction` needed no change.

**The scene**
391. **Avatars** are inline SVG in `components/dashboard/live-scene/` (`IsoPlatform`, `PersonBust`, `CustomerAvatar`, `AdminAvatar`, `KunRobot`, `KunRobotDefs`, `KunRobotFace`, `SceneMomentLayer`), colors from theme tokens except fixed illustration colors. Customers are anonymous: `helpers/avatar-look.ts` `getAvatarLook(sessionId)` (FNV-1a hash) picks skin, hair, shirt and one of short/long/bun. **Staff always get one neutral hairstyle** (`getStaffLook`, `neutral` crop): Clerk has no reliable gender and guessing from names is wrong too often; skin, hair color and shirt still come from the user id (the viewer's id, or `takenOverBy` for another taker). A per-user avatar style in Settings (Pendek / Panjang / Diikat, stored on the Clerk profile) is postponed.
392. **KUN is gold**, like the og-image and logo: ring antenna, headphone cups, dark visor with smiling-arc eyes and a filled smile, mitten hands, a vector "k" chat bubble on the chest. Fixed colors (`helpers/kun-robot-palette.ts`, gradient ids shared with `KunRobotDefs`), so he ignores the org accent color; steel grey and dimmer when off; tired (half-closed eyes, sweat drop, dim ring light) at full quota; sparkles and a pulsing ring light only when active. `/images/kun_logo.png` is no longer used on the robot. The pill under the robot ("KUN AKTIF") is still the dashboard's brand teal.
393. **Stage geometry.** One fixed ratio (`aspect-[59/33]`, max 590px) so characters, threads, labels and packets scale together. Anchors live in `helpers/live-scene-moments.ts` (`SCENE_ANCHORS`: customer 18%/60.6%, KUN 50%/57.1%, admin 82%/60.6%); the floor threads and the packets use the same anchors. The status pill moved below the stage (`role="status"`). A chip "+N handoff lain menunggu" links to Conversations when other conversations are pending (`pendingHandoffCount` prop; the stage shows only one).
394. **Moments and queue.** Event kinds: `customer-message-ai`, `customer-message-admin`, `kun-reply`, `kun-exchange`, `admin-reply`, `handoff-requested`, `takeover`, `returned`, `quota-warning`, `quota-full`. `SCENE_MOMENTS` defines route, packet tone, pop-up, screen-reader text and duration; a test requires every duration to cover packet time (0.9s per thread) plus the 0.7s landing ring. `useLiveSceneQueue` subscribes to every store change (the store has one slot), plays moments one at a time, merges the same kind within 1.2s, keeps at most the newest 5, and ignores events while the tab is hidden. Pop-ups: "Pesan baru", "Butuh admin!", "Admin mengambil alih", "KUN kembali", "Kuota 80%", "Kuota penuh".
395. **Notification decision kept, animation for every message.** Sound and unread for AI-mode customer messages stay on the first message only (`conversation:new`). The dashboard hears about later AI-mode customer messages only through KUN's reply, so a reply plays `kun-exchange` (customer → KUN → customer); the first message plays a dot to KUN and then a plain `kun-reply`. `pusher-provider.tsx` keeps a module-level `customerShownAt` (30s window); `getKunReplyKind` returns the plain reply when the cached live conversation is `pending_handoff` or `human` (a dismiss canned message is role `assistant`, rule 92) or when the customer leg was just drawn. Known limit: for message 2+ the dot appears when the answer is ready, not when the customer pressed send. Declined alternative: a new server event per customer message (would touch `/api/chat` and the unread logic).
396. **Colors.** Message dots and rings are bright red `#ef4444` (tone `signal`); handoff and takeover stay amber; the full-quota pop-up is the only red pill; pop-ups for messages and "KUN kembali" stay brand teal (a red "Pesan baru" would read as an alarm; switching it is one tone value in the moments table).
397. **Provider event mapping.** `conversation:new` → `customer-message-ai`; takeover with `pending_handoff` → `handoff-requested` (plus the sound); takeover with `human` → `takeover`; message from a customer → `customer-message-admin` in human/pending mode, else `customer-message-ai`; `human_agent` → `admin-reply`; `assistant` → `kun-reply` or `kun-exchange`; `conversation:return` → `returned`. (Before this session pending customer messages were drawn toward KUN.) No filtering by `conversationId`: the live conversation is by definition the newest one. `handleTakeover` branches on `payload.handoffStatus`; the explicit takeover route's own payload (`conversationId`, `takenOverBy`) shows no `handoffStatus` in the route file, so whether `triggerConversationTakeover` adds it was not read. Kevin's manual checks of the choreography passed; do not change takeover payloads without rechecking `handleTakeover`.
398. **Quota moments.** `handleUsageUpdated` compares the last known usage (store, else the cached live overview) with the new payload BEFORE `setUsage`, via `getQuotaCrossing`; only upward crossings fire (ok → warning = `quota-warning`, anything → full = `quota-full`); resets, raised limits and an unknown previous value stay silent. Quota moments are pop-ups only, with no packet. **Not verified in production** (it cannot be reached safely on the test org).
399. **Reduced motion and accessibility.** Under `prefers-reduced-motion` the poses, labels and pop-ups remain; packets, rings, breathing, blinking, waving and pulses stop. `SceneMomentLayer` has an `aria-live="polite"` text for every moment; SVGs are `aria-hidden`; the status pill is `role="status"`.
400. **Animations.** Scene variants live in `lib/animations.ts` (breath, blink, arm, pulse, typing, screen line, ring, pop-up, `scenePacketTransition`). Removed: `liveWorkspaceKunVariants`, `operationsBoard*`, `liveWorkspacePacketVariants`. Variants with `custom` are functions.
401. **Tests added:** `live-scene` (state, queue, moments, quota crossing, reply kind, staff name), `avatar-look`, `staff-look`, `kun-robot-palette`, `org-member-name`, store event tests, `reply/route.test.ts`. Final count reported by Kevin: 72 files, 1465 tests. No component tests exist (rule 296); the drawing was checked by rasterizing the SVG geometry (cairosvg) before code was written, and by Kevin's manual checks per PR.
402. **Kevin's working rules (Session 6):** every PR ends with a numbered manual check he can run; one PR per concern (event replay fix, foundation, avatars, choreography, reply-route fix, staff name, gold robot, neutral staff hair); a stated full-file replacement is fine when most of a file changes; manual checks with Pusher need `KUNDESK_REALTIME_MODE=pusher` (mock mode fires no events); when he says "ALL MERGE" proceed to the next item; do not guess what a file does before reading it (rule 389).
403. **Leftovers noticed, not changed:** a stray `console.log("[Pusher] document:updated", data)` in `use-pusher-channel.ts`; the debug `console.log` lines from the June supplement (`getHumanUnreadConversationIds`, `DashboardOverview orgId`) were marked "remove before next deploy" and their removal was never confirmed.
404. **Session 6 closed.** PRs, all merged: event replay fix; live scene foundation; avatars; choreography; reply route `takenOverBy` fix; staff name lookup; gold KUN robot; neutral staff avatar. The next chat has no mandated first task.

---

## Recurring Themes (1–98, condensed)

1. Manual Neon changes need `schema.ts` and `migrations/` kept in sync, and merge order matters.
2. Catch-and-log everywhere means Sentry sees little; the full audit is deferred.
3. A decision in one PR can create obligations in files it never touched.
4. CodeRabbit's diff is a starting point, never a drop-in.
5. A status field not enforced anywhere is decorative (`subscriptionStatus`).
6. Assumed vendor behavior must be verified live.
7. Failure paths get less design than happy paths.
8. Changing which rows a cron selects can break the next cron in the chain.
9. Write a disproven hypothesis down in full instead of swapping in another guess.
10. A file seen earlier in a long chat can go stale in memory.
11. A recommendation not acted on needs an explicit statement, never silence.
12. When the person gave a direction and latitude, don't hand structural choices back as a picker.
13. A prompt instruction for one fact does not cover an adjacent fact.
14. Model context can override a correct system-prompt fact with the model's own earlier turn.
15. Delete-then-recreate sync opens a race window update-in-place would not.
16. A diagnostic side-test does not close the original complaint.
17. Never guess a table's columns; query `information_schema`.
18. Fix at the single source of truth, not at each caller.
19. A fallback value must never be submitted as a real reading.
20. `revalidatePath` never refreshes the TanStack Query cache.
21. A monitoring check must mirror the producer's rules.
22. Environment moves can have hard prerequisites outside the code.
23. A reactive control inside a form needs its own submit isolation.
24. Verify a third party's real response before building on it.
25. A guard that cannot fire for your config must say so.
26. Two entry points to one action means one shared function.
27. Order the safety net before the cleanup that could undo it.
28. A "known gap" is a decision with a deadline.
29. Confirm test targets exist and belong to Kevin.
30. Unattended money-moving automation is the first thing to test.
31. Writing tests for existing code surfaces latent bugs.
32. A `CHARACTERIZATION` label turns "looks wrong" into a decision.
33. A passing test is only as good as what it asserts.
34. Fixing an environment can release hidden code bugs.
35. A status with no end state is a bug waiting.
36. A rule's wording can drift from the code.
37. "Same name" is not "same code" (grep imports and typecheck).
38. A limit copied from a document is a guess until checked against the platform.
39. AI call time grows with the OUTPUT.
40. Put every cheap rejection before the expensive step.
41. Make the screen use the server's own schema.
42. Inject Server Actions into loops for tests.
43. For hostile-looking text, flag and unselect; don't block.
44. Use the user's words in labels.
45. Prove a monitoring path with a deliberate test.
46. Recreating a shared resource is not restoring it.
47. Trust the real bytes, not the claimed ones.
48. A limit that depends on a header is not a limit.
49. A test that expects only a failure can pass for the wrong reason.
50. A test environment can change what an API does.
51. Measure estimates on the real deployment.
52. A new front end should reuse the whole downstream pipeline.
53. Share the pieces two entry points must agree on.
54. Do not fake progress you do not have.
55. Check the branch before a commit command.
56. Vendor numbers from forums are estimates; label them.
57. A fix inside a shared function changes every caller; grep callers first.
58. Choose the failure default per call site and say why.
59. A catch is not enough for an unreliable dependency: add a timeout and a breaker.
60. An alert that can repeat needs a throttle and one fingerprint.
61. Never record half of an exchange two counters count.
62. Lock the row, then re-check state inside the transaction.
63. A failure handler must be as conditional as the success path.
64. The client claims, the server verifies.
65. A security claim in a document can be false for months.
66. Prove production with the cheapest real event.
67. "No code" is a valid outcome with a tripwire.
68. A retry is safe only if every step is idempotent.
69. A schedule with a flexible window is not an ordering.
70. The same fact in two files drifts.
71. A number in a sentence needs a measurement.
72. Name what a number counts.
73. A contact address that does not exist is worse than none.
74. Public pages are part of every feature.
75. A grep for a literal misses a computed value.
76. Take third-party facts from the vendor's own dashboard.
77. Describe what is true and stop.
78. Accept a stated environment fact before diagnosing.
79. Whatever one action creates, the delete path and the bulk-delete path must remove.
80. Put the retryable step before the one that removes the retry handle.
81. A delete by prefix needs a guard on the id that builds the prefix.
82. A single failed external call is not "missing".
83. Cache keys need the tenant.
84. Prove destructive automation with throwaway data first.
85. A document can promise a behavior the code lacks.
86. A vendor can split one credential into several; after a rotation test each job separately.
87. Read the validating code before handing over SQL for it.
88. A global flag cannot drive a per-item UI.
89. Only a real notification proves a webhook signature; unit tests mock verification.
90. A recovery automation (the reconcile cron) pays for itself on the first real incident.
91. When Kevin is frustrated by complexity: one path, exact edits, nothing else.
92. A store that keeps only the latest value loses bursts, and a remount replays whatever it still holds; subscribe to changes and ignore what predates the mount.
93. State is a pose, events are flourishes: derive what is always true from data, play one-shot motion only from real events.
94. A fallback label that exposes a data gap ("Staf") is the helper working; find the writer that never recorded the fact (rule 389).
95. Never say what a file does before reading it; a grep of every writer of a column beats a theory.
96. A "notify only once" decision and a "show every time" wish need different signals; use the signal that really exists (the reply) and say what it cannot tell (rule 395).
97. Never infer personal traits (gender) from a name or a missing field; make the neutral choice the default and let people choose later.
98. Check a drawing by rendering it before building code around it.

---

## Open Items

**Medium**
1. **Domain → Clerk production migration + Resend sender + `CONTACT_EMAIL`** (rules 233, 170, 345). Hard prerequisite for the first real customer. On Nov 15 Kevin was ready to buy `kunborneo.com` at Hostinger (plan: `kundesk.kunborneo.com` for Kundesk, `kunbookshop.kunborneo.com` for Kun Bookshop, and a Resend sender on it); whether it was bought is not confirmed. Migration must re-register the Clerk webhook with its NEW signing secret in the same step (rule 276).
2. **Still untested:** `lib/actions/knowledge.ts`, `team.ts`, `chatbot.ts`, `dashboard.ts`; `lib/db/queries/*`; `lib/auth`; `lib/pusher`; `lib/env.ts` (extract validators like `validateMidtransConfig`); routes `app/api/conversations/**` EXCEPT `reply` (now tested, rule 389): `takeover`, `return`, `dismiss`, `messages`, `[id]` remain; `documents/upload`, `documents/usage`, `pusher/**`, `notifications/**`, `widget`, `search`, `qr`, `health`, `mock-upload`. No component tests exist. Suggested order: the other conversation routes (the `reply` test file is the pattern), `lib/actions/knowledge.ts`, then `lib/auth`. Rule 271 applies to every new PR.
3. **No SQL-level tests** (everything mocks the DB): the atomic quota guard, cron candidate queries, cancelled-sweep queries, slug uniqueness and the live preview query are unverified by tests.
4. **Photo import leftovers (rule 313):** several photos per import, a photo preview, a real 100+ item photo, iPhone HEIC, no E2E test.
5. **Rule 201** stays monitored by `knowledge-health` only.
6. **Playwright CI on the recreated E2E database** (rule 301): very likely green after many merges, never explicitly confirmed.
7. **Content above Free limits after a downgrade** (50 entries, 3 documents): code behavior not seen; a product decision first (rule 344).
8. **First live billing cycle.** Kedai Bu Sari paid for Pro (period 30 days); the renewal → past-due → downgrade chain runs on real money for the first time around late December 2026. Renewal creates a Midtrans transaction and emails via Resend (sender blocked, rule 170). Watch the Vercel cron logs then, or reset the test org to Free.
9. **Test-data cleanup (advice given, not confirmed done):** set `UJIBAYAR2` and `UJIBAYAR` to `is_active = false`; reset Kedai Bu Sari to Free (`plan='free', subscription_status='free', messages_limit=100, current_period_end=NULL, next_billing_date=NULL`).
10. **Midtrans production checks never run explicitly:** the authenticated production endpoint check (smoke-test production step 3) and the full smoke checklist (only scenarios 1 and 8 exercised, plus two real payments). Whether to push QRIS as the default payment method is open (VA's fixed Rp 4.440 fee is large against the first-time prices).
11. **Sentry tripwire** (rule 323): if a failing catalog import has no Sentry event, add a flush.
12. **Live scene, not yet verified in production (rules 394–398):** the quota 80% and 100% moments, the `kun-exchange` moment for the second and later AI messages on a real widget conversation, the "+N handoff lain menunggu" chip with several pending conversations, and the Clerk name lookup with a second real team member under production keys. Manual checks on the dev setup passed.

**Lower**
1. Midtrans follow-ups: persist `transaction_id`, `last_checked_at` for the reconcile cron, confirm settlement through Get Status inside the webhook.
2. Sentry blind-spot audit across all catch blocks.
3. Doc drift: `generateMetadata()` on the public chat page reveals the org name for an inactive chatbot; the Bible's fee table says Rp 4.000 (real 4.440).
4. Dead weight on purpose: `orgs.suspendedAt`, the `"suspended"` type value, `getActiveOrgCount`.
5. `e2e/auth.setup.ts` local flakiness (rule 143).
6. Cron idempotency keys use `source: "midtrans"` cosmetically; the renewal email links to a Snap page that dies after 24h (the day-3 email is the net).
7. `getOrgPlan` may duplicate a query in `billing.ts`; "Kelengkapan data profil" is unscoped; KUN restates open/closed status unprompted (Kevin's choice to leave it).
8. Test-org leftovers: `timezone_detected_at` backfill, local `.env.local` AI modes, the "Uji Impor" test section, the temporary slug `warung-paco-tes`.
9. Small cleanup bundle: the two import catch blocks log whole error objects (log `err.name` + `err.message`); hand-typed entry titles can contain newlines (apply `toSingleLine` in the entry schemas); `createEntry` drops `price` only for FAQ; shared `Progress` never forwards `value`.
10. Photo and documents leftovers: unverified `request.signal` cancellation, unexplained `Status: 0` in a Vercel log, docx zip-bomb protection, orphan R2 objects for rows never created, `upload` accepting a missing content type, `S3Client` built in three places (now one helper), stale "60s" comment in `process`.
11. Chat leftovers: no Sentry alert for a failed AI turn, the empty conversation after a failed first message, the widget limiter fails closed in a Redis outage, shared rate-limit bucket for chat and search, the Upstash region never checked.
12. Landing and legal leftovers: merge the two plan config files; retake the README screenshot; check the share image (a new og-image exists, rule 109); settle `TESTIMONIALS`; "Setup 5 menit" unmeasured; footer links with `href="#"`; policy statements that are not code (rule 344).
13. R2 leftovers: stale AWS comments and `CLOUDFRONT_URL`, no startup validation for `S3_ENDPOINT`, `AWS_*` variable names, duplicated preview response types, the R2 `NotFound` shape, free-tier numbers.
14. **Live scene leftovers (rules 391–403):** per-user avatar style choice in Settings (postponed by Kevin); the pill under the gold robot is still brand teal; no component tests for the scene components; the stray `console.log` in `use-pusher-channel.ts` and the unconfirmed removal of the June debug logs (rule 403); scene events are not filtered by `conversationId` (by design, rule 397).

**Deferred by choice:** WhatsApp/Meta integration (pending verification); advanced Midtrans features (GoPay auto-renew, static VA, Promo Management, Invoicing); CloudFront; promo code admin UI (SQL only); quota-reset decoupling; a "KUN couldn't answer" inbox; templates for large catalogs.

---

## Awaiting Kevin

- **Project Bible corrections** (Bible is permanent; needs your explicit OK, rules 152 and 349 are the precedent): Section 3 (tech stack lists AWS S3 and CloudFront), Section 4 (diagram says "AWS S3 presigned URL"), Section 6 Layer 7 (S3 wording; the magic-byte check now runs in `process`), Section 11 (`AWS_*` variables and a missing `S3_ENDPOINT`). The mode value is still `s3` in code. Also optional: add the three Midtrans keys to Section 7, and a sentence about the live scene to the "Dashboard Live Overview" part of Section 8 (it still says nothing about the avatars).
- Confirm the test-data cleanup (Open Items Medium #9).
- Tell me if the pill under the gold robot should become gold, or whether the avatar style choice in Settings should be next.

---

## Decisions Made / Pending (condensed; each points to its rules)

- **1–14 (Phase 16):** member permissions, 30-day org deletion, plan enforcement, widget channel security, the past_due → downgrade policy, webhook failure semantics, "Batalkan" semantics, overdue renewals, abandoned-checkout sweep. All implemented.
- **15–38 (Phases 17–18 S1):** structured knowledge (profile, catalog, FAQ, policy, promo, note), two-tab Info Bisnis with Isi Manual sub-tabs and Dokumen as the default tab, dialog-based CRUD, KUN prompt fixes, E2E org recreation, `isAvailable` verified, timezone auto-detect and picker, the org timezone as the single source of truth, `knowledge-health` cron, Clerk production deferred until a domain exists. The Katalog/FAQ visual restyle was dropped.
- **39–56 (Phase 18 S2–S3):** shared `settlePaidOrder`, refuse real-mode settlement without a checkout row, reconcile cron design, the key guard as a heuristic, test-coverage plan, cancelled-org sweep (option B), slug owned by Settings, org cache invalidation, one-shot completion, dead-code removal.
- **57–77 (Phase 19):** catalog import (text, then photo) with the whole safety design, 45s timeout, region change dropped, photo as a switch inside the same dialog, Route Handler, JPEG-only server, byte-counted size cap, 120-row cap, separate photo limiter.
- **78–97 (Phase 20 S1–S2):** section toolbar and inner scroll, Sentry gap closed with a tripwire, `org-purge` stale claims, failed AI turn leaves no trace, retrieval degrades, Redis fails open, document verification and idempotent `process`, README and landing refresh, plan promises on both files, legal fact corrections, one `CONTACT_EMAIL`, fake social proof removed, new plan prices (97: QRIS-default question still open).
- **98–106 (Phase 20 S4):** R2 storage, CORS without DELETE, "Asia-Pasifik" wording, document preview, org-scoped query keys, delete everywhere, org purge deletes files.
- **107. Three Midtrans keys: the signature key gets its own env var `MIDTRANS_SIGNATURE_KEY`.** ✅ Implemented, merged, proven by a real payment (rules 370–372, 377).
- **108. No fallback to the server key in real mode; mock mode falls back.** ✅ (rule 372)
- **109. Two separate PRs:** the signature fix first (urgent, payment path), the promo UI second. ✅ Both merged.
- **110. Test real payments with a percent promo code (98% on Pro), not by editing prices.** ✅ (rule 375)
- **111. Promo preview design:** a read-only admin action using the same `validatePromoCode`, one shared `applyPromoDiscount`, per-plan percent on the cards. ✅ (rule 376)
- **112. Skip the sandbox/tunnel test and the signed curl; prove the signature key with a real production payment.** ✅ Done (rules 374, 377).
- **113. Handoff policy:** one document, condensed, supplements folded in, never a new supplement. ✅ (rule 382)
- **114. Phase 20 Session 5 is CLOSED** (number provisional).
- **115. The live workspace becomes an illustrated, game-like scene built with inline SVG + Framer Motion (no Three.js or game engine); the "not a game" clause is reversed for this component only.** ✅ (rule 384)
- **116. Everything animated must come from a real event; poses come from data.** ✅ (rules 385, 399)
- **117. Sound and unread for AI-mode customer messages stay on the first message only; the scene still animates every message (round trip when KUN replies).** ✅ (rule 395)
- **118. Message dots are bright red; handoff amber; pills for messages stay teal.** ✅ (rule 396)
- **119. KUN is gold like the og-image and logo, with fixed colors and no logo image on the body.** ✅ (rule 392)
- **120. The admin desk shows a real name: the viewer's own, or the first name of whoever took over, resolved on the server; never the viewer's name for another person's work.** ✅ (rules 388–390)
- **121. Staff avatars always use one neutral hairstyle; no gender guessing.** ✅ (rule 391)
- **122. A per-user avatar style in Settings is postponed.** Pending.
- **123. Phase 20 Session 6 is CLOSED** (number provisional). The next chat has no mandated first task.