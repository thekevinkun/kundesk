# Kundesk

<img width="158" height="56" alt="kundesk_with_kun_logo_white" src="https://github.com/user-attachments/assets/855de8ea-0fc7-42d1-a3e7-19b15f1f7b96" />
<br />

**AI-powered customer service SaaS for Indonesian SMEs.**

Kundesk lets business owners teach **KUN**, an AI assistant that answers customer questions 24/7, in Bahasa Indonesia, using only their own content. Start from whatever you already have: upload a document (menu, FAQ, price list), paste a price list or photograph a menu, or fill in a simple form.

**Live demo:** [kundesk.vercel.app](https://kundesk.vercel.app)

---

## The Problem

Indonesian SMEs — warung, klinik, salon, properti — are drowning in repetitive WhatsApp and website messages from customers asking the same questions every day. They can't afford enterprise customer service solutions, and nothing is built specifically for the Indonesian context.

## The Solution

Sign up, give Kundesk your business information in whichever way is easiest — upload documents, paste or photograph a price list, or fill in the form — and Kundesk deploys **KUN**, an AI assistant that handles your customers automatically. Every answer KUN gives comes from your own content, not from generic AI knowledge.

---

## Meet KUN

<img width="88" height="88" alt="kun_logo" src="https://github.com/user-attachments/assets/e4e0a029-918d-45c3-a431-f5f9b41fe73f" /><br />


KUN is Kundesk's built-in AI assistant — the entity your customers actually talk to. KUN is not a generic chatbot; it has a fixed identity, a consistent voice, and speaks naturally in Bahasa Indonesia using the "Kak" address form that Indonesians expect in a friendly service context.

KUN answers exclusively from what each business gives it: uploaded documents plus the information entered by hand in **Isi Manual** (business profile, catalog, FAQ, policies, promos). Ask KUN about something not in that content and it won't guess — it tells the customer honestly and suggests they contact the business directly.

KUN also knows the real day and time in the business's own timezone, and whether the business is open right now is computed in code from the structured opening hours, not left to the model.

When a customer needs a human, they can ask KUN to connect them with the business owner. KUN detects the request, notifies the dashboard instantly, and holds the conversation gracefully until staff takes over. When staff is done, KUN resumes automatically.

---

## Early Traction

Two LinkedIn posts in July 2026 announcing Kundesk reached **45,371 impressions** and generated **365 total reactions**:

- **[Launch announcement](https://www.linkedin.com/feed/update/urn:li:activity:7475759720574763009/)** — 4 screenshots, product overview (256 reactions, 11 comments, 26,371 impressions)
- **[Technical walkthrough video](https://www.linkedin.com/feed/update/urn:li:activity:7477677344254705665/)** — 6-minute demo + architecture breakdown (109 reactions, 11 comments, 19,764 impressions)

**Real engagement:** 13 signups to create organizations. 2 uploaded documents and started testing. 4 attempted a paid subscription (but didn't complete checkout).

This validates the product-market fit signal: Indonesian SMEs recognize the problem and want the solution. The next focus is reducing friction in the onboarding and checkout flows.

---

## Screenshots

> Landing Page - Hero

<img width="1920" height="1505" alt="hero" src="https://github.com/user-attachments/assets/c6b2ff16-005f-4310-8e94-13fab8cf8b18" /><br />

> Dashboard Overview

<img width="1920" height="1841" alt="dashboard" src="https://github.com/user-attachments/assets/98f04e19-357e-4b2e-ab5c-e1a1004f85f9" /><br />

> Chat Interface

<img width="1920" height="1098" alt="chat-2" src="https://github.com/user-attachments/assets/36b32a89-83a2-499f-901b-752b3cc41cd7" /><br />

---

## Features

### For Business Owners
- **Three ways to teach KUN** — every answer comes from your own content via RAG (Retrieval-Augmented Generation):
  - **Document upload** — PDF, DOCX, TXT or MD (10MB max); the real file size and content are verified before processing
  - **Isi Manual ("Info Bisnis")** — a business profile (about, address, contacts, structured opening hours, payment methods) plus catalog, FAQ, policy, promo and note sections; entries sync to KUN automatically
  - **Catalog import from text or photo** — paste a WhatsApp price list or photograph a menu; AI reads the items into rows, the owner reviews and edits them before anything is saved, and the photo is never stored
- **Business-timezone aware** — KUN states the right day, time and open/closed status; the timezone is auto-detected for Indonesian zones and can be changed in Settings
- **Multiple delivery channels** — shareable public chat link, QR code (print it on your counter or menu), and embeddable web widget
- **Human handoff** — take over any KUN conversation manually from the dashboard; return to KUN when done; dismiss pending requests with a canned message
- **Live dashboard** — real-time conversation monitoring, stat cards, and Chart.js analytics (daily trend, monthly comparison, weekly breakdown)
- **Subscription billing** — GoPay, OVO, DANA, BCA Virtual Account via Midtrans; three plans in Rupiah (Free, Starter, Pro)
- **Discount system** — promo codes with per-plan applicability, validity windows, and max-use limits
- **Quota notifications** — real-time alerts at 80% and 100% usage, monthly reset notification, plan upgrade confirmation
- **Dark mode** — full token-based theme switching via `next-themes`
- **KUN customization** — accent color picker, language setting (ID / EN / both), quick replies, system prompt addendum

### For Customers
- **Talking to KUN** — streaming responses token-by-token via Server-Sent Events; feels instant, no page reload
- **Markdown rendering** — KUN's formatted answers rendered via `react-markdown`
- **Human handoff request** — customers can ask KUN to connect them with a person; staff is notified instantly via dashboard
- **Embeddable widget** — KUN works inside any website via a single `<script>` tag

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, SSE) |
| Language | TypeScript 5 — strict mode, zero `any` |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Framer Motion |
| Database | Neon (serverless PostgreSQL), Drizzle ORM v0.45, pgvector |
| Auth & Multi-tenancy | Clerk Organizations |
| AI | OpenAI `gpt-4o-mini` (chat, plus text and vision extraction for catalog import) + `text-embedding-3-small` (RAG embeddings) |
| Vector Search | pgvector cosine similarity, HNSW index, scoped per `org_id` |
| File Storage | AWS S3 (presigned URLs, 5-min expiry) + CloudFront CDN |
| Payments | Midtrans — GoPay, OVO, DANA, BCA VA, QRIS, Credit Card |
| Real-time | Pusher (private dashboard channels) + SSE (customer chat stream) |
| Caching & Rate Limiting | Upstash Redis — per-purpose rate limiters (chat, upload, auth, widget, knowledge writes, text and photo import) + cache-aside pattern; the chat path fails open if Redis is down |
| Email | Resend + React Email |
| Analytics | PostHog (server-side, 7 tracked events) |
| Error Tracking | Sentry (PII scrubbed before send) |
| Validation | Zod v4 |
| Testing | Vitest (1,289 tests in 49 files) + Playwright E2E (30 tests) |
| CI/CD | GitHub Actions — typecheck → lint → test → build → E2E |
| Deployment | Vercel (built-in cron, auto-deploy on push) |

---

## Architecture Highlights

### Multi-Tenancy
Shared database with `org_id` as the tenant isolation key — on every table, every query, enforced at the application layer via `requireOrg()`. IDOR protection via `AND org_id = $orgId` on all lookups. `orgId` always sourced from Clerk server session, never from client request body.

### RAG Pipeline
```
Customer asks KUN a question
  → OpenAI text-embedding-3-small (1536 dimensions)
  → pgvector cosine similarity search (WHERE org_id = $orgId LIMIT 5)
  → System prompt built from top 5 chunks + KUN identity rules
  → OpenAI gpt-4o-mini streams KUN's reply
  → SSE ReadableStream → token-by-token to browser
```

### Document Processing Pipeline
```
Business owner uploads file
  → AWS S3 (presigned URL, client uploads directly)
  → API notified → checks the real object size (HeadObject), downloads from S3
  → verifies the file signature (PDF / DOCX / text) against the real bytes
  → pdf-parse / mammoth / plain text extraction
  → chunked (~500 tokens, 50 token overlap)
  → batched embedding (10 chunks/batch via batchedAsync)
  → one transaction: replace old chunks, bulk INSERT new chunks with org_id + vector embedding, set status "ready"
  → document status updated to "ready"
  → Pusher event fires → dashboard updates live
```

### Knowledge Entries Pipeline (Isi Manual)
```
Owner saves an entry (catalog item, FAQ, policy, promo, note)
  → entry saved immediately and marked "stale"
  → compiled into its own self-contained chunk
    (catalog sections also get a summary chunk listing every item)
  → embedded outside any DB transaction
  → one transaction: fingerprint re-check, old chunks deleted, new chunks inserted, entry marked "synced"
  → if the data changed meanwhile, the entry stays "stale" and a retry button repairs it
```
Always-needed profile facts (about, address, contacts, hours, payment methods) go straight into the system prompt instead of retrieval. A daily `knowledge-health` cron checks for entries that are "synced" but have no chunk.

### Catalog Import (Text and Photo)
```
Owner pastes text or picks one photo
  → photo: shrunk to a ~1600px JPEG in the browser (EXIF stripped), sent as multipart to a Route Handler
  → server checks the real bytes (size, magic bytes) before any paid call
  → rate limit → gpt-4o-mini with a strict JSON schema (text or vision)
  → rows returned for review — nothing is saved yet
  → owner edits, unticks or fixes rows; suspicious or duplicate rows are flagged and start unselected
  → save: server re-validates every row, checks plan slots under a lock, skips duplicate names, then syncs
```
The pasted text and the model's answer are treated as untrusted data: titles are flattened to a single line, and text that looks like an instruction to the AI is flagged, never silently saved.

### Mock Mode System
Every external paid service has a `mock` mode — OpenAI, S3, Midtrans, Pusher, Resend. The entire product can be built and tested without spending a cent. Mode switching is a single env variable change per service; the caller never checks the mode directly. Even catalog photo import has a mock mode, so its whole review flow can be built and tested for free.

### Design Decisions (Why We Built It This Way)

**Midtrans over Stripe:** Indonesian SMEs pay with GoPay, OVO, DANA, BCA Virtual Account. Stripe doesn't support these. Midtrans does. Market fit > ecosystem convenience.

**pgvector over Pinecone/Weaviate:** RAG needs vector similarity search. Rather than spin up a separate vector DB with another API key and bill, we use Neon's pgvector extension. Same SQL query, one connection string. Trade-off: optimized for 100MB–1GB, not petabyte-scale. Refactor later if needed.

**Next.js 16 Server Actions over tRPC:** Server Actions are simpler for our use case — no API schema duplication, automatic type safety, native to Next.js. tRPC would add a code generation step without much benefit at our scale.

**Pusher for dashboard live updates:** We don't need real-time for customers (they see their own messages instantly via optimistic UI). We *do* need real-time for staff — new conversation counter, live conversation status, human handoff notifications. Pusher is battle-tested and costs nothing at our scale.

**Clerk Organizations for multi-tenancy:** We could use custom JWT + a `tenant_id` header. Clerk gives us instant org switching, invite workflows, RBAC foundation, and free webhooks for org/user sync. Trade-off: tied to Clerk. We chose the convenience.

**Mock mode for every external service:** Building without spending money on OpenAI, Midtrans, S3 means faster iteration. One env variable changes the entire behavior — the caller never checks the mode. This meant we could build the full payment flow without a live Midtrans account.

### Security Model (11 layers)
`proxy.ts` route guards → `requireOrg()` tenant isolation → Zod input validation (AI-extracted rows are re-validated on the server before saving) → prompt injection detection (chat: 15+ regex patterns; imports: flag and unselect) → Upstash rate limiters → Clerk (Svix) + Midtrans (SHA512) webhook verification → file validation on the real bytes (size, magic bytes) → atomic plan limit enforcement → security headers → slug enumeration protection → Sentry PII scrubbing.

### Subscription Logic (Midtrans has no native recurring)
Manual subscription management via Vercel Cron: daily renewal check → Midtrans charge creation → payment link via Resend → `past_due` with a warning email at day 3 (full access kept) → automatic downgrade to Free at day 7 → reactivated on payment settlement. A daily reconcile cron asks Midtrans directly about unpaid orders, so a lost webhook never leaves a paying customer on the wrong plan. Cancelled subscriptions keep access until the paid period ends, then drop to Free. Full idempotency via the `processedWebhooks` table.

---

## Challenges & Lessons Learned

### 1. Multi-Tenant Live-Update Race Condition (Phase 14)

**Problem:** Dashboard stat cards lagged one message behind. Every time a customer sent a message, the "Total Pesan" card showed the *previous* count, catching up on the next message.

**Root cause:** `triggerOrgEvent()` fired Pusher notifications *before* `db.transaction()` committed. TanStack Query refetched immediately on Pusher event, but the DB write hadn't committed yet — the query saw stale data.

**Solution:** Separated Pusher ordering by path:
- **AI-mode (`handleStreamComplete`):** Fire Pusher *AFTER* transaction. The LLM stream is already done; no user-facing latency from the DB write.
- **Human/handoff paths:** Fire Pusher *BEFORE* writes. User is actively waiting; small inserts are fast; cold-start risk is real.

**Learning:** "Fire before to avoid cold start" doesn't apply to all paths. Cold start risk is real for user-waiting scenarios, not for async background tasks that finish hours later.

### 2. Quota Webhook Silent Failure

**Problem:** Quota warnings and "you've exceeded limit" notifications never fired.

**Root cause:** `insertQuotaWebhookOnce` was using `source: "quota"`, but the `processedWebhooks.source` column only accepts `"midtrans" | "clerk" | "system"`. Every insert threw a constraint error, which was caught and swallowed silently by upstream `.catch(console.error)`.

**Solution:** Changed `source: "quota"` → `source: "system"` in all quota idempotency inserts.

**Learning:** Silent failures are worse than crashes. Upfront schema validation (TypeScript discriminated unions, database constraints) catches these before production.

### 3. Handoff Message Consistency Across Channels

**Problem:** After staff took over a conversation, the customer's chat wouldn't update to show they're talking to a person. The footer still showed "Menunggu staff kami" even after staff replied.

**Root cause:** Three separate bugs layered:
1. Staff reply's Pusher payload didn't include `handoffStatus: "human"` — customer's `ChatPage` had no handler to update the UI
2. Canned messages from "Return to KUN" and "Dismiss" were stored as `role: "assistant"` in the database but fired to Pusher as `role: "human_agent"` — customer's UI handler only had a branch for `human_agent`, so assistant messages were silently dropped
3. No handler in `ChatPage` for `role: "assistant"` messages from Pusher

**Solution:** Established a single invariant: **DB role === Pusher payload role, always, for every message.** Now:
- Staff replies: `role: "human_agent"` in DB and Pusher
- Canned KUN messages: `role: "assistant"` in DB and Pusher
- Customer messages: `role: "user"` in DB and Pusher (no Pusher event needed)

**Learning:** Multi-layer message pipes (DB insert → Pusher event → client handler → UI render) need one consistent "source of truth" for message attributes. Misalignment between layers is easy to miss and breaks silently.

### 4. Why Midtrans, Not Stripe?

**Problem:** Stripe is market-leading, well-documented, production-proven. Why deviate?

**Answer:** Stripe doesn't support GoPay, OVO, DANA, BCA Virtual Account — the payment methods 95% of Indonesian SMEs use. Market fit > developer convenience.

**Implementation:** Midtrans lacks native recurring subscriptions, so we built manual renewal via Vercel Cron + daily checks + Midtrans charge creation + payment links via Resend. Same outcome, slightly more code, but every rupiah collected goes to the business (not a third-party subscription middleman).

**Learning:** Early-stage products must fit their market, even if it means more integration complexity. Stripe would have been "wrong" here despite being "easier."

### 5. pgvector Instead of a Separate Vector DB

**Problem:** RAG requires vector similarity search. Industry best practice is a dedicated vector DB (Pinecone, Weaviate, Qdrant). But that's another infrastructure dependency, another auth token, another cost.

**Answer:** Neon (our PostgreSQL host) includes pgvector as a built-in extension. Cosine similarity search runs in the same SQL query. One connection string, one bill, zero new dependencies.

**Trade-off:** pgvector is slightly slower than specialized vector DBs at massive scale. We're optimized for 100MB–1GB vector data (typical for SME document stores), not for millions of embeddings. If Kundesk grows to that scale, migrating to a specialized DB is a one-week refactor.

**Learning:** "Pick the simplest tool that solves your problem today" beats "pick the industry-standard tool for tomorrow's scale." You can always refactor later.

---

## Project Structure

```
kundesk/
├── app/
│   ├── (marketing)/          ← Landing page + legal pages
│   ├── (auth)/               ← Clerk auth flows
│   ├── (dashboard)/          ← Protected tenant dashboard
│   │   ├── page.tsx          ← Overview (stat cards + charts)
│   │   ├── conversations/    ← Live conversation management + human handoff
│   │   ├── knowledge/        ← Info Bisnis: document upload + Isi Manual (profile, catalog, FAQ, import)
│   │   ├── chatbot/          ← Chatbot configuration
│   │   ├── analytics/        ← Deep analytics charts
│   │   ├── billing/          ← Subscription + payment history
│   │   ├── widget/           ← Embed code + QR code generator
│   │   └── settings/         ← Org settings
│   ├── (chat)/
│   │   └── [orgSlug]/        ← Public chat interface per tenant
│   └── api/
│       ├── chat/             ← SSE streaming endpoint + RAG
│       ├── documents/        ← Upload trigger + processing pipeline
│       ├── knowledge/        ← Catalog photo import
│       ├── conversations/    ← Takeover, dismiss, human reply routes
│       ├── webhooks/
│       │   ├── midtrans/     ← Payment notification + subscription state machine
│       │   └── clerk/        ← Org/user sync
│       ├── cron/             ← Renewal, reset-usage, past-due, retention, org-purge, knowledge-health, payment-reconcile
│       ├── widget/           ← Embeddable JS snippet
│       └── health/           ← Health check (SELECT 1)
├── components/
│   ├── dashboard/            ← All dashboard UI components
│   ├── chat/                 ← Public chat widget components
│   ├── landing/              ← Marketing page sections
│   └── ui/                   ← shadcn/ui components
├── lib/
│   ├── db/                   ← Drizzle client, schema, queries
│   ├── ai/                   ← Embedding, RAG, text and photo extraction
│   ├── knowledge/            ← Entry-to-chunk sync layer
│   ├── billing/              ← Shared payment settlement
│   ├── aws/                  ← S3 helpers
│   ├── redis/                ← Upstash client + rate limiters + cache
│   ├── midtrans/             ← Payment client + subscription helpers
│   ├── email/                ← Resend client + templates
│   └── env.ts                ← Startup env validation (throws on missing vars)
├── helpers/                  ← Pure functions: chunking, formatting, validation
├── types/                    ← All TypeScript types (never defined inline)
├── stores/                   ← Zustand stores
├── hooks/                    ← Custom React hooks
└── e2e/                      ← Playwright E2E specs
```

---

## Database Schema (13 Tables)

| Table | Purpose |
|---|---|
| `orgs` | Tenants — synced from Clerk webhooks; plan, billing state, timezone |
| `chatbots` | Per-org chatbot config (language, accent, quick replies, system prompt) |
| `documents` | Uploaded files with processing status |
| `business_profiles` | One row per org — about, address, contacts, structured opening hours, payment methods |
| `knowledge_sections` | Named groups of manual entries (catalog, FAQ, policy, promo, note) |
| `knowledge_entries` | Individual manual entries with a sync status |
| `chunks` | RAG knowledge base — chunks + pgvector embeddings; each chunk belongs to exactly one document, entry or section (enforced by a CHECK constraint) |
| `conversations` | Customer sessions with handoff state |
| `messages` | All chat messages (`user`, `assistant`, `human_agent` roles) |
| `processedWebhooks` | Idempotency table — prevents double-processing on retries |
| `notifications` | In-dashboard notification feed (8 types) |
| `payments` | Payment history per org |
| `promoCodes` | Discount codes with validity, max uses, per-plan applicability |

---

## Cron Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `/api/cron/renewal` | Daily 08:00 WIB | Find orgs due for renewal, create Midtrans charge, send payment link |
| `/api/cron/reset-usage` | 1st of month | Reset `messagesUsed` to 0, fire `quota_reset` notification per org |
| `/api/cron/past-due` | Daily 09:00 WIB | Warn at day 3, downgrade to Free at day 7; downgrade cancelled orgs once their paid period ends |
| `/api/cron/retention` | Daily 03:00 WIB | Delete messages older than 90 days |
| `/api/cron/payment-reconcile` | Daily 02:00 WIB | Ask Midtrans about unpaid orders, recover payments whose webhook was lost, expire abandoned checkouts |
| `/api/cron/knowledge-health` | Daily 04:00 WIB | Report-only check for missing knowledge chunks (alerts Sentry) |
| `/api/cron/org-purge` | Daily 11:00 WIB | Permanently delete organizations after the 30-day deletion grace period |

> Schedules are set in UTC; on Vercel's Hobby plan a cron may run up to an hour late.

---

## Test Coverage

```
Vitest unit tests:   1,289 tests in 49 files — all passing
Playwright E2E tests:   30 tests — all passing

Unit coverage includes every cron job, both webhooks, payment settlement,
the knowledge sync layer, and the chat route (including failed-turn and
Redis-outage paths).

E2E coverage:
  - Public chat flow (SSE streaming, rate limiting, prompt injection)
  - Dashboard authentication and org activation
  - Document upload and processing pipeline
  - Billing webhook (Midtrans mock settlement)
  - Human handoff (takeover, return to AI, dismiss pending)
  - Customer widget channel authentication
  - Knowledge limits and cross-tenant isolation
```

---

## Running Locally

> All external services have a `mock` mode. You can run the full product with only Clerk and Neon credentials.

**1. Clone and install**
```bash
git clone https://github.com/thekevinkun/kundesk.git
cd kundesk
npm install
```

**2. Set up environment variables**

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
# Required (always real — both have generous free tiers)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
DATABASE_URL=   # Neon connection string

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# All other services default to mock mode
KUNDESK_AI_MODE=mock
KUNDESK_EMBEDDING_MODE=mock
KUNDESK_STORAGE_MODE=mock
KUNDESK_PAYMENT_MODE=mock
KUNDESK_REALTIME_MODE=mock
KUNDESK_EMAIL_MODE=mock

# Upstash Redis (required even in mock mode — rate limiters always call Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

> **Why mock mode?** Every external service (OpenAI, S3, Midtrans, Pusher, Resend) has a mock implementation. This means you can run the entire product — upload documents, train RAG, send messages, process payments, receive live updates — without spending money or hitting rate limits. Switch any service to `real` mode when ready. Mock mode is not a hack; it's a deliberate architectural choice that enables fast iteration.

**3. Run database migrations**
```bash
npm run db:generate
# Then apply the generated SQL manually via Neon SQL editor
```

**4. Start the dev server**
```bash
npm run dev
```

**5. Run tests**
```bash
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E (requires .env.e2e)
```

---

## Subscription Plans

| Plan | Price | Messages/month | Documents | Manual entries |
|---|---|---|---|---|
| Free | Rp 0 | 100 | 3 | 50 |
| Starter | Rp 149.000 | 1.000 | 20 | 300 |
| Pro | Rp 399.000 | 10.000 | Unlimited | 1.000 |

Payment methods: GoPay, OVO, DANA, BCA Virtual Account, QRIS, Credit Card — all via Midtrans.

---

## Delivery Channels

| Channel | Free | Starter | Pro |
|---|---|---|---|
| QR Code + Public Chat Link | ✓ | ✓ | ✓ |
| Web Embed Widget | — | ✓ | ✓ |
| WhatsApp Integration | — | — | Planned |

---

## About

Built by **Kevin Mahendra** — self-taught full stack developer based in Samarinda, East Kalimantan, Indonesia.

This is a product under the **Kun Borneo** brand, alongside [Kun Bookshop](https://github.com/thekevinkun) — a full-stack bookshop with AI chatbot, OpenAI tool calling, SSE streaming, and Stripe checkout.

---

## License

MIT
