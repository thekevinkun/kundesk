# Kundesk — Project Bible

> **Document Type:** Permanent Reference — Never overwrite this document. Hand it to every new chat session before starting work. 
> **Last Updated:** May 2026 
> **Author:** Kevin Mahendra × Claude

---

## Table of Contents

1. [What is Kundesk](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#1-what-is-kundesk)
2. [Brand & Naming](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#2-brand--naming)
3. [Tech Stack](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#3-tech-stack)
4. [Architecture Overview](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#4-architecture-overview)
5. [Database Schema](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#5-database-schema)
6. [Security Model](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#6-security-model)
7. [Payment System — Midtrans](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#7-payment-system--midtrans)
8. [Design System](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#8-design-system)
9. [Performance & Optimization Rules](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#9-performance--optimization-rules)
10. [Coding Standards & Requirements](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#10-coding-standards--requirements)
11. [Mock Mode System](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#11-mock-mode-system)
12. [Customer Delivery Channels](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#12-customer-delivery-channels)
13. [Human Handoff Feature](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#13-human-handoff-feature)
14. [Build Phases Overview](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#14-build-phases-overview)
15. [Kun Borneo Context](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#15-kun-borneo-context)
16. [Mockup References](https://claude.ai/chat/85daae28-f5de-4f59-9c93-1f816f0537c5#16-mockup-references)

---

## 1. What is Kundesk

**Kundesk** is an AI-powered customer service SaaS platform built specifically for Indonesian SMEs (warung, klinik, salon, properti, retail, etc.).

### The Core Problem

Indonesian SMEs are drowning in repetitive WhatsApp and website messages from customers asking the same questions — menu, harga, jam buka, ketersediaan, cara order. They can't afford enterprise CS solutions, and nothing is built for the Indonesian context.

### The Solution

Business owners sign up, upload their business documents (menu PDF, FAQ, price list), and Kundesk generates an AI chatbot that answers their customers 24/7 — automatically, accurately, and in Bahasa Indonesia — based only on their own documents.

### How It Works (User Flow)

1. Business owner signs up → Clerk creates their Organization (tenant)
2. They upload documents to their dashboard → files go to AWS S3 → background processing parses, chunks, and embeds them into pgvector
3. They configure their chatbot (name, tone, language, accent color)
4. They receive multiple delivery channels — QR code, shareable link, embed widget, and (Pro) WhatsApp integration
5. Their customers interact via whichever channel the business shares → RAG pipeline retrieves relevant chunks → OpenAI streams the answer

### Important Product Reality

The web widget alone is insufficient for the Indonesian SME market. Most Indonesian SMEs do not have websites. Customers contact businesses via WhatsApp — not by visiting a website. This shapes the delivery channel strategy. See Section 12 for the full channel breakdown.

### Target Market

Indonesian SMEs — warung makan, klinik, salon, properti, toko online, travel agent. Businesses with 1–50 employees who receive repetitive customer questions daily.

### Business Model

Subscription SaaS, billed monthly in Rupiah via Midtrans.

| Plan    | Price      | Messages/month | Documents | Chatbots |
| ------- | ---------- | -------------- | --------- | -------- |
| Free    | Rp 0       | 100            | 3         | 1        |
| Starter | Rp 149.000 | 1.000          | 20        | 1        |
| Pro     | Rp 399.000 | 10.000         | Unlimited | 3        |

---

## 2. Brand & Naming

### Product Name

**Kundesk** — written lowercase, one word. Not "KunDesk", not "Kun Desk".

### Why "Kundesk"

- "Desk" references helpdesk — immediately communicates business tool, customer service
- Professional and SaaS-feeling without being generic
- Connects clearly to the Kun brand family
- Works in both Indonesian and English contexts

### Brand Color

**`#069494`** — deep teal. Trustworthy, fresh, not overused in Indonesian market.

|Token|Value|Usage|
|---|---|---|
|`--color-brand`|`#069494`|Primary buttons, active nav, chart lines, links|
|`--color-brand-light`|`#e6f7f7`|Active nav background, badge backgrounds, card tints|
|`--color-brand-mid`|`#b3e5e5`|Borders on active elements, dividers|
|`--color-brand-dark`|`#045f5f`|Hover states on brand elements, dark text on light brand bg|

### Typography

- **Display / Body:** Plus Jakarta Sans (weights: 300, 400, 500, 600, 700, 800)
- **Mono:** DM Mono (weights: 400, 500)
- **Serif accent:** Instrument Serif italic — used only on landing page hero headlines for the italic colored word effect

### Logo

`Kun` in `--color-text-900` + `desk` in `--color-brand`. Font: Plus Jakarta Sans 800 weight, letter-spacing -0.04em.

---

## 3. Tech Stack

> All versions are current as of May 2026. New versions come with new coding patterns — these are documented below.

### Core Framework

|Tech|Version|Why|
|---|---|---|
|Next.js|16.x|App Router, Server Actions, SSE, Turbopack default|
|TypeScript|5.x|Strict mode. Zero `any` types — non-negotiable|
|React|19.2|New hooks: `useActionState`, `useOptimistic`, `use()`, `useEffectEvent`|

#### Next.js 16 Key Changes (affects how we code)

- `middleware.ts` → replaced by `proxy.ts` with `export function proxy()`
- Route params are now **async**: `const { id } = await params` — everywhere
- Caching is now **opt-in**: use `"use cache"` directive explicitly
- Turbopack is default — no flags needed in scripts
- React Compiler is stable — automatic memoization, no manual `useMemo`/`useCallback`
- `updateTag` API for Server Actions for read-your-writes semantics

#### React 19 Key Changes

- `useActionState` — replaces manual state management for form actions
- `useOptimistic` — instant UI feedback that rolls back on failure
- `use()` hook — reads Promises or Context directly in render
- `forwardRef` mostly gone — refs passed as props directly
- Forms: `action={serverAction}` on `<form>` natively
- `<Activity>` component — for background preloading of routes
- `useEffectEvent` — decouples event logic from effect dependencies

### Styling

|Tech|Version|Notes|
|---|---|---|
|Tailwind CSS|v4.1|No `tailwind.config.js`. Everything in `globals.css` via `@theme {}`|
|shadcn/ui|Latest|Component library built on Radix UI primitives|

#### Tailwind v4 Key Changes

- `@import "tailwindcss"` — one line, no `@tailwind` directives
- `@theme {}` block in `globals.css` — replaces `tailwind.config.js` theme.extend
- `@layer components {}` — for reusable component classes
- `@layer base {}` — for global base styles
- JavaScript config files no longer detected automatically

#### shadcn/ui + Tailwind v4 Compatibility Note

shadcn/ui was originally built for Tailwind v3. With Tailwind v4, the initialization process is different — do NOT just run `npx shadcn@latest init` blindly. The correct approach:

- shadcn now supports Tailwind v4 via its latest CLI — verify `npx shadcn@latest` is truly the latest before running
- shadcn's CSS variables must be defined inside `@layer base {}` in `globals.css` — not in a separate `:root` block
- Some shadcn components reference Tailwind classes that changed in v4 — verify each component after install
- If shadcn's init creates a `tailwind.config.js`, delete it — all config belongs in `globals.css`
- At the start of Phase 1, check shadcn docs for their current Tailwind v4 guide before initializing | Tech | Notes | |---|---| | Clerk | Multi-tenancy via Organizations. `Membership required` is default since Aug 2025. Used for org switching, RBAC, API keys. Clerk also has built-in Billing (optional, we use Midtrans instead) |

#### Clerk Key Patterns

```ts
// Always get org from session — never from client
const { orgId, userId, orgRole } = await auth()

// Guard pattern used everywhere
export async function requireOrg() {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  if (!orgId) throw new Error("No active organization")
  return { orgId, userId }
}
```

### Database

|Tech|Version|Notes|
|---|---|---|
|Neon|Serverless PostgreSQL|Branching support (like Git for DB). Serverless-friendly|
|Drizzle ORM|0.45.x (v1.0 RC)|Replaces Prisma. Lightweight, type-safe, SQL-like|
|pgvector|Extension on Neon|Vector similarity search for RAG. No separate vector DB needed|

#### Drizzle Key Changes (v0.45+)

- Identity columns over serial: `integer('id').primaryKey().generatedAlwaysAsIdentity()`
- `drizzle-zod` is now built into `drizzle-orm` — no separate package
- Cache layer support via Upstash (ORM-level caching)
- JIT mappers for performance (25–30% latency reduction, opt-in)

#### Drizzle Config Pattern

```ts
// drizzle.config.ts — root of project
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",           // Neon is PostgreSQL
  schema: "./lib/db/schema.ts",    // single schema file
  out: "./lib/db/migrations",      // migration output folder
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Neon connection string
  },
})
```

|Tech|Notes|
|---|---|
|OpenAI API|`text-embedding-3-small` for embeddings (1536 dimensions). `gpt-4o-mini` for chat completions|
|RAG Pipeline|pgvector cosine similarity search scoped per `org_id`|
|SSE Streaming|Server-Sent Events for token-by-token streaming — native Next.js ReadableStream|

### Storage

|Tech|Notes|
|---|---|
|AWS S3|Document uploads. Private bucket. Presigned URLs only (5min expiry)|
|CloudFront|CDN in front of S3 for delivery|

### Caching & Rate Limiting

|Tech|Notes|
|---|---|
|Upstash Redis|Serverless Redis. Rate limiting (4 limiters), response caching, usage metering, Drizzle ORM cache layer|

### Payments

|Tech|Notes|
|---|---|
|Midtrans|Indonesian payment gateway. VA/Bank Transfer (Rp 4.000 flat), GoPay (2%), QRIS (0.7%), OVO (1.5%), DANA (1.5%), Credit Card (2.9% + Rp 2.000). **Push VA/Bank Transfer as default.**|

> **Midtrans vs Stripe Decision:** Stripe is more mature for subscriptions but Kundesk's 100% Indonesian market needs GoPay, OVO, DANA, BCA VA — none of which Stripe supports. Midtrans subscription renewal is handled manually via Vercel Cron. See Section 7 for full details.

### Real-time

|Tech|Notes|
|---|---|
|SSE (native)|AI response streaming — one-directional, works natively in Next.js|
|Pusher|Dashboard live updates — new conversation counter, live status|

### Analytics & Monitoring

|Tech|Notes|
|---|---|
|PostHog|Product analytics, session recording, feature flags, per-tenant usage|
|Sentry|Error tracking. PII scrubbed before sending|

### Email

|Tech|Notes|
|---|---|
|Resend|Transactional email|
|React Email|Email template components|

### Testing

|Tech|Notes|
|---|---|
|Vitest|Unit + integration tests. Replaces Jest in modern stacks|
|React Testing Library|Component testing|
|Playwright|E2E testing|

### CI/CD & DevOps

|Tech|Notes|
|---|---|
|GitHub Actions|Runs Vitest + ESLint + TypeScript check on every PR|
|CodeRabbit|AI code review — installs as GitHub App, reviews every PR automatically|
|Docker|Containerized for reproducible deployments|
|Railway|Deployment target. Vercel for frontend if needed|

### Validation

|Tech|Notes|
|---|---|
|Zod v4|Import path changed: `import { z } from "zod/v4"`. Used for all input validation in Server Actions and Route Handlers|

---

## 4. Architecture Overview

### Big Picture Flow

```
Customer of SME
  ↓ types question in chat widget (/chat/[orgSlug])
Next.js App (App Router)
  ↓
Upstash Redis — rate limit check (IP + org level)
  ↓
RAG Pipeline:
  → embed question (OpenAI text-embedding-3-small)
  → pgvector cosine search WHERE org_id = $orgId LIMIT 5
  → build system prompt with top 5 chunks
  → stream to OpenAI gpt-4o-mini
  ↓
SSE ReadableStream → token by token to browser
```

```
Business Owner (tenant dashboard)
  ↓ uploads document
AWS S3 (presigned URL, client uploads directly)
  ↓ client notifies API upload complete
API Route:
  → saves document record (status: processing)
  → downloads from S3
  → parses text (pdf-parse)
  → chunks (~500 tokens, 50 token overlap)
  → embeds each chunk (OpenAI)
  → bulk INSERT into chunks table with org_id + embedding
  → updates document status: ready
```

### Pusher Channel Naming Convention

Consistent across the entire codebase — never deviate:

|Channel|Format|Used For|
|---|---|---|
|Org channel|`org-[orgId]`|All events for a specific tenant's dashboard|
|Events on org channel|`conversation:new`|New conversation started|
||`conversation:message`|New message in a conversation|
||`conversation:takeover`|Human handoff initiated|
||`conversation:return`|AI resumed from human handoff|
||`usage:updated`|Message count incremented|

```
kundesk/
├── app/
│   ├── (marketing)/           ← Public landing page
│   │   └── page.tsx
│   ├── (auth)/                ← Clerk sign-in/up/org pages
│   │   └── [[...sign-in]]/
│   ├── (dashboard)/           ← Protected tenant dashboard
│   │   ├── layout.tsx         ← Clerk org guard
│   │   ├── loading.tsx        ← Suspense boundary for whole dashboard
│   │   ├── page.tsx           ← Overview / stats
│   │   ├── documents/
│   │   ├── conversations/
│   │   ├── chatbot/
│   │   ├── analytics/
│   │   ├── billing/
│   │   ├── widget/
│   │   └── settings/
│   ├── (chat)/                ← Public chat interface
│   │   └── [orgSlug]/
│   │       └── page.tsx
│   └── api/
│       ├── chat/              ← SSE streaming endpoint
│       ├── documents/         ← Upload trigger + processing
│       ├── webhooks/
│       │   ├── midtrans/      ← Payment notification handler
│       │   └── clerk/         ← Org/user sync handler
│       └── widget/            ← Embeddable JS snippet
├── components/
│   ├── dashboard/             ← Dashboard-specific components
│   ├── chat/                  ← Chat widget components
│   ├── landing/               ← Marketing page sections
│   └── ui/                    ← shadcn/ui components live here
├── lib/
│   ├── db/
│   │   ├── schema.ts          ← Drizzle schema (all tables)
│   │   ├── index.ts           ← Drizzle client (Neon)
│   │   └── queries/           ← Reusable query functions
│   ├── ai/
│   │   ├── embed.ts           ← OpenAI embedding function
│   │   ├── rag.ts             ← Vector search + prompt builder
│   │   └── stream.ts          ← SSE streaming logic
│   ├── aws/
│   │   └── s3.ts              ← S3 upload/download helpers
│   ├── redis/
│   │   └── index.ts           ← Upstash client + rate limiters
│   ├── midtrans/
│   │   └── index.ts           ← Midtrans client + subscription helpers
│   ├── email/
│   │   └── index.ts           ← Resend client + email helpers
│   └── utils.ts               ← cn() and other shared utilities
├── helpers/                   ← Reusable pure functions (not React)
│   ├── chunk.ts               ← Text chunking logic
│   ├── format.ts              ← Date, number, currency formatters
│   └── validation.ts          ← Shared Zod schemas
├── types/                     ← All TypeScript types — imported everywhere, never defined inline
│   ├── db.ts                  ← Drizzle inferred types: InferSelectModel, InferInsertModel per table
│   ├── api.ts                 ← API request/response types, Server Action return types
│   ├── chat.ts                ← ChatMessage, Conversation, ConversationSession, HandoffStatus
│   ├── billing.ts             ← PlanName, SubscriptionStatus, MidtransNotification
│   └── config.ts              ← AIMode, EmbeddingMode, StorageMode, PaymentMode, RealtimeMode, EmailMode
├── hooks/                     ← Custom React hooks
├── stores/                    ← Zustand stores
├── proxy.ts                   ← Next.js 16 (replaces middleware.ts)
└── drizzle.config.ts
```

---

## 5. Database Schema

### Multi-Tenancy Pattern

**Shared tables with `org_id` as tenant isolation key.** Every table with tenant data has `org_id`. Every query filters by `org_id` first — always. This is enforced at the application layer via the `requireOrg()` helper. Never skip `org_id` in a WHERE clause.

### IDOR Protection Pattern

```ts
// ALWAYS use AND — never just filter by id alone
const [doc] = await db
  .select()
  .from(documents)
  .where(
    and(
      eq(documents.id, documentId),
      eq(documents.orgId, orgId)  // ← IDOR protection
    )
  )
if (!doc) throw new Error("Not found") // same error whether missing or forbidden
```

### Tables

```ts
// orgs — synced from Clerk webhooks
orgs: {
  id: text (PK) — Clerk orgId
  slug: text (unique) — used in /chat/[slug]
  name: text
  plan: text — "free" | "starter" | "pro"
  midtransCustomerId: text (nullable)
  subscriptionStatus: text — "active" | "past_due" | "suspended" | "cancelled"
  currentPeriodEnd: timestamp (nullable)
  nextBillingDate: timestamp (nullable)
  messagesUsed: integer (default 0)
  messagesLimit: integer (default 100)
  createdAt: timestamp
}

// chatbots — one per org
chatbots: {
  id: integer (PK, identity)
  orgId: text → orgs.id
  name: text (default "Assistant")
  systemPrompt: text (nullable)
  language: text — "id" | "en" | "both"
  tone: text — "friendly" | "professional" | "formal"
  greetingMessage: text (nullable)
  accentColor: text (default "#069494")
  isActive: boolean (default true)
  createdAt: timestamp
}

// documents — uploaded by tenant
documents: {
  id: integer (PK, identity)
  orgId: text → orgs.id
  name: text
  s3Key: text
  status: text — "processing" | "ready" | "failed"
  chunkCount: integer (default 0)
  createdAt: timestamp
}

// chunks — the RAG knowledge base (most queried table)
chunks: {
  id: integer (PK, identity)
  orgId: text → orgs.id  ← on EVERY chunk for tenant isolation
  documentId: integer → documents.id
  content: text
  embedding: vector(1536)  ← pgvector
  createdAt: timestamp
  INDEXES:
    - chunks_org_id_idx ON (orgId)
    - chunks_embedding_idx USING hnsw (embedding vector_cosine_ops)
}

// conversations
conversations: {
  id: integer (PK, identity)
  orgId: text → orgs.id
  sessionId: text               ← browser session identifier
  deliveryChannel: text         ← "web_widget" | "qr_link" | "whatsapp" — metadata, not logic
  handoffStatus: text           ← "ai" | "human" | "pending_handoff" — default "ai"
  takenOverAt: timestamp (nullable)
  takenOverBy: text (nullable)  ← Clerk userId of staff member who took over
  createdAt: timestamp
}

// messages
messages: {
  id: integer (PK, identity)
  orgId: text  ← always stamped for tenant isolation, even though accessible via conversation
  conversationId: integer → conversations.id
  role: text — "user" | "assistant" | "human_agent"  ← third role for human handoff messages
  content: text
  tokensUsed: integer (default 0)
  createdAt: timestamp
}

// processedWebhooks — idempotency table, prevents double-processing on retries
processedWebhooks: {
  id: integer (PK, identity)
  externalId: text (unique)  ← Midtrans order_id or Clerk event_id
  source: text — "midtrans" | "clerk"  ← typed, not free text
  processedAt: timestamp
}
```

---

## 6. Security Model

> Every layer has a specific job. No single point of failure.

### Layer 1 — proxy.ts (Network Boundary)

- Dashboard routes: require `userId` + `orgId` from Clerk — redirect if missing
- Webhook routes: skip Clerk auth — they have signature verification instead
- Public chat routes: skip auth — customers don't have accounts

### Layer 2 — Tenant Isolation

- `requireOrg()` helper called at the top of every Server Action and Route Handler
- Every DB query uses `AND org_id = $orgId` — never just by ID alone
- `orgId` always comes from server session (Clerk `auth()`) — never from client request body

### Layer 3 — Input Validation (Zod v4)

- Every Server Action and Route Handler validates all input before touching DB
- Message content capped at 500 chars before hitting OpenAI
- File uploads validated: mime type, extension, size (max 10MB), and magic bytes

### Layer 4 — Prompt Injection Defense

- Regex pattern detection on incoming messages (15+ known injection patterns)
- If detected: return natural deflection response with HTTP 200 (don't tip off attacker)
- System prompt hardened: explicit "ignore these rules" resistance
- Only last 6 messages of conversation history sent to OpenAI (prevents context dilution)

### Layer 5 — Rate Limiting (4 Upstash limiters)

- `chatRateLimit`: 20 req/min per IP (protects OpenAI credits)
- `orgMessageLimit`: 60 req/min per org
- `uploadRateLimit`: 10 uploads/hour per org
- `authRateLimit`: 10 req/15min per IP

### Layer 6 — Webhook Verification

- **Midtrans:** signature verification using `SHA512(order_id + status_code + gross_amount + server_key)` — reject if mismatch
- **Clerk:** Svix signature verification — reject if headers missing or signature invalid
- **Idempotency:** check `processedWebhooks` table before processing any webhook — Midtrans retries, never double-process
- **Subscription state machine:** `free → active → past_due → suspended` — no invalid state transitions

### Layer 7 — File Upload Security

- S3 presigned URLs with 5-minute expiry
- Server-side validation: allowed MIME types (`application/pdf`, `text/plain`), max 10MB
- File path: `orgs/${orgId}/documents/${timestamp}-${safeName}` — namespaced by orgId
- Magic byte verification after upload (actual file content vs claimed MIME type)
- Filename sanitized: `/[^a-zA-Z0-9._-]/g` → `_`

### Layer 8 — Plan Limits

- Enforced server-side on every chat message: `messagesUsed >= messagesLimit` → 402
- Atomic increment: `SET messages_used = messages_used + 1` — no race conditions
- Monthly reset via Vercel Cron

### Layer 9 — Security Headers

- `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`
- `Content-Security-Policy` configured for Clerk, Pusher, Midtrans, CloudFront
- `Permissions-Policy`: camera, microphone, geolocation all denied

### Layer 10 — Org Slug Enumeration Protection

- Whether slug doesn't exist OR chatbot is inactive → same `notFound()` response
- Never reveal which case it is

### Layer 11 — Logging & Monitoring

- Sensitive fields redacted from logs: `password`, `token`, `secret`, `embedding`, `content`
- Sentry `beforeSend`: strips message content and PII before sending to Sentry
- Midtrans IP whitelist on notification URL endpoint

---

## 7. Payment System — Midtrans

### Why Midtrans (Not Stripe)

Kundesk is 100% Indonesian market. Customers pay with GoPay, OVO, DANA, BCA Virtual Account — none of which Stripe supports. Market fit > developer convenience.

### Transaction Fee Structure

|Method|Fee|
|---|---|
|VA / Bank Transfer|Rp 4.000 flat|
|GoPay|2%|
|QRIS|0.7%|
|OVO|1.5%|
|DANA|1.5%|
|Credit Card|2.9% + Rp 2.000|

### Fee Strategy Decision

**Fees are absorbed and built into pricing (Option 3).** VA/Bank Transfer is the default and recommended method. Pricing is set slightly above target to cover average fee. Credit card may be disabled on Free/Starter plans. No surprise fees at checkout.

### Subscription Logic (Manual — Midtrans has no native recurring)

Since Midtrans doesn't have native subscription management like Stripe, we handle it:

```
1. Tenant chooses plan → create Midtrans transaction → they pay
2. Midtrans fires notification URL (POST /api/webhooks/midtrans)
3. We verify signature, check idempotency, verify fraud_status
4. Update orgs: plan, subscriptionStatus: "active", nextBillingDate = +30 days
5. Vercel Cron runs daily → finds orgs where nextBillingDate is today
6. Creates new Midtrans charge → sends payment link via Resend
7. If not paid within 3 days → subscriptionStatus: "past_due" → limit features
8. If not paid within 7 days → subscriptionStatus: "suspended" → block Pro features
9. On payment → subscriptionStatus: "active", reset nextBillingDate
```

### Midtrans-Specific Security

- Always check BOTH `transaction_status` AND `fraud_status`
- `settlement` + `fraud_status: challenge` → flag account, do NOT activate
- IP whitelist Midtrans notification URL to their published IP ranges
- Idempotency on every `order_id` — Midtrans retries notifications multiple times

### DB Fields Added for Midtrans

```ts
// On orgs table (replaces Stripe fields)
midtransCustomerId: text (nullable)
subscriptionStatus: "active" | "past_due" | "suspended" | "cancelled" | "free"
currentPeriodEnd: timestamp (nullable)
nextBillingDate: timestamp (nullable)
lastPaymentMethod: text (nullable)
```

---

## 8. Design System

### globals.css Structure

```
@import "tailwindcss"

@theme { }           ← Design tokens (replaces tailwind.config.js)
.dark { }            ← Dark mode token overrides
@layer base { }      ← Global base styles, focus rings, scrollbar
@layer components { } ← Reusable component classes
```

### Key Design Tokens (`@theme {}`)

```css
--color-brand:        #069494
--color-brand-light:  #e6f7f7
--color-brand-mid:    #b3e5e5
--color-brand-dark:   #045f5f

--color-bg-page:      #f4f5f7    (dark: #0f1117)
--color-bg-card:      #ffffff    (dark: #161b27)
--color-bg-input:     #f8f9fa    (dark: #1a2030)
--color-border:       #e8ecf0    (dark: #2a3044)
--color-text-900:     #0f1117    (dark: #f0f4ff)
--color-text-700:     #2d3748    (dark: #c8d0e0)
--color-text-500:     #718096    (dark: #7888a0)
--color-text-400:     #a0aec0    (dark: #4a5568)

--font-display:       'Plus Jakarta Sans'
--font-body:          'Plus Jakarta Sans'
--font-mono:          'DM Mono'

--radius-xs: 6px | --radius-sm: 10px | --radius-md: 14px
--radius-lg: 20px | --radius-xl: 28px

--ease-smooth: cubic-bezier(0.22, 1, 0.36, 1)
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Reusable Component Classes (`@layer components {}`)

These are defined in `globals.css` and used throughout — always prefer these over ad-hoc Tailwind:

|Class|Use|
|---|---|
|`.card-base`|All dashboard cards — bg, border, radius, shadow|
|`.card-hover`|Cards that lift on hover|
|`.input-base`|All form inputs that aren't shadcn|
|`.badge-brand`|Teal badges|
|`.badge-success`|Green badges|
|`.badge-warning`|Amber badges|
|`.badge-danger`|Red badges|
|`.nav-item`|Sidebar navigation items|
|`.nav-item-active`|Active state for sidebar items|
|`.page-section`|Consistent dashboard section padding|
|`.skeleton`|Animated loading skeleton base|

### Dashboard Design Feel

- **Inspired by:** Sedap restaurant admin dashboard
- **Light mode:** White cards, soft shadows, rounded corners, colorful 3D-style icon backgrounds on stat cards
- **Dark mode:** Warm dark (not cold), same layout, tokens swap via `.dark` class
- **Color picker:** Business owners can change their chatbot's accent color from the dashboard navbar — updates sidebar active state, buttons, chart accents, usage bar, hover states
- **Charts:** Chart.js 4.x — donut charts (3 on overview), area chart (daily trend), dual-line chart (monthly comparison), grouped bar chart (weekly)

### Landing Page Design Feel

- **Inspired by:** Finora fintech landing page
- **Sections in order:**
    1. Navbar — pill-shaped nav links, teal active state
    2. Hero — centered, italic serif accent word in teal, scenic gradient bg, phone mockup, 3 floating animated cards, trust strip
    3. Features — **dark matte background (`#111`)** — 2×2 grid with mini UI previews inside cards
    4. How It Works — 3 steps, numbered circles connected by teal gradient line
    5. Testimonials — carousel with auto-advance, quote mark, dot indicators
    6. Pricing — 3 cards, middle featured with "Paling Populer" badge
    7. FAQ — smooth accordion
    8. CTA Banner — rounded white card with decorative watermark
    9. Footer — **dark background** matching features section
- **Font pairing:** Plus Jakarta Sans (body) + Instrument Serif italic (accent headlines only)
- **All copy in Bahasa Indonesia**

### Dark Mode Implementation

- **Library:** `next-themes` — standard with Next.js + shadcn/ui
- **Why not manual toggle:** Manual CSS class toggle causes flash-of-wrong-theme on page load due to SSR. `next-themes` handles hydration correctly with `suppressHydrationWarning`
- **Toggle mechanism:** `.dark` class on `<html>` element — `next-themes` manages this automatically
- **Token switching:** `.dark {}` block in `globals.css` overrides all `--color-*` tokens
- **Phase:** Dark mode is Phase 10 — but `next-themes` is installed in Phase 1 so the toggle infrastructure exists from the start
- **Color picker:** Business owners can change their chatbot's accent color from the dashboard navbar topbar. Updates sidebar active state, buttons, chart accents, usage bar, hover states — live without page reload. This is a per-org setting stored in `chatbots.accentColor`

### QR Code Generation

- **Library:** `qrcode` npm package
- **Approach:** On-the-fly server-side rendering via API route — no pre-generation, no storage
- **API Route:** `GET /api/qr/[orgSlug]` → returns SVG or PNG
- **Why on-the-fly:** Slug could change, color could change — on-the-fly always reflects current state
- **In dashboard:** Widget page shows live QR preview + download button (PNG)
- **Customization:** QR code uses org's `accentColor` as the foreground color Always reach for shadcn/ui components first before writing custom ones. Components to install from day one: Button, Card, Input, Label, Select, Dialog, Sheet, Tabs, Badge, Separator, Skeleton, Tooltip, Dropdown Menu, Avatar, Switch, Progress.

---

## 9. Performance & Optimization Rules

> Do these on Day 1, not Phase 3.

### Images

- Always `next/image` — never `<img>` tag
- `priority` prop only on above-the-fold images
- `sizes` prop on all responsive images
- `formats: ["image/avif", "image/webp"]` in `next.config.ts`
- `plaiceholder` library for blur placeholders on document thumbnails
- Allowed domains: `*.cloudfront.net` in `remotePatterns`

### Fonts

- Always `next/font/google` — never a `<link>` tag in HTML
- `display: "swap"` to prevent invisible text
- `variable` prop to expose as CSS variable

### Dynamic Imports (these components MUST be dynamically imported)

```ts
// Heavy — Chart.js ~60kb
MessageTrendChart, DonutChart, LineChart, BarChart

// Conditional — only shown sometimes
ColorPicker, WidgetPreview, PDFViewer

// Heavy third-party
AnalyticsDashboard (PostHog embed)
```

### Skeleton Loading

- Every async component gets a skeleton, built at the same time as the component
- Skeleton component lives in the same file as its real component (exported separately)
- Named: `ComponentNameSkeleton` — e.g., `StatCardSkeleton`, `ConversationTableSkeleton`

### Route-level Loading

- Every dashboard route folder has its own `loading.tsx`
- Every dashboard route folder has its own `error.tsx`

### Landing Page Sections

- Features, Pricing, FAQ, How It Works sections are dynamically imported (below the fold)

### Bundle

- `@next/bundle-analyzer` installed from day one
- Run before every major feature merge

---

## 10. Coding Standards & Requirements

These are non-negotiable. Every line of code in this project follows all nine.

### 1. Comments on Every Line

Short but descriptive. Not `// sets variable` — explain the _why_ or _what_ when it's not obvious.

```ts
// Scope query to current org — prevents cross-tenant data access
const docs = await db.select().from(documents).where(eq(documents.orgId, orgId))
```

### 2. Step by Step Learning Approach

During build sessions, Claude explains how each piece connects to the others before writing code for it.

### 3. Handoff Documents After Each Phase

After every phase: write the Phase Handoff document (Document 2). If information is missing, ask — never guess. Reference the Project Bible (this document) from every handoff.

### 4. One Phase, Broken Into Steps, In Chat

No walls of documentation mid-build. Conversational. Claude judges how many steps to include per reply based on complexity.

### 5. Zero `any` Types

Strict TypeScript throughout. Use generics, discriminated unions, and mapped types instead of `any`. ESLint rule `@typescript-eslint/no-explicit-any: error` is enforced.

### 6. globals.css Classes + shadcn/ui First

Always check `globals.css` reusable classes and shadcn/ui components before writing new styles or components. Don't reinvent what's already defined.

### 7. Semantic HTML + Accessibility

- Proper landmark elements: `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`, `<section>`, `<article>`
- `aria-label` on all icon-only buttons
- `aria-describedby` linking inputs to their error messages
- `aria-live="polite"` on dynamic content updates (new message, status changes)
- `aria-expanded` on accordions, dropdowns
- `role` only when semantic HTML isn't sufficient
- `<button>` vs `<div>` discipline — if it's clickable and performs an action, it's a `<button>`

### 8. Clean Code + Component Separation

- If a section is complex enough to name, it's a separate component file
- Reusable logic goes to `helpers/` — not buried in components
- A component file should rarely exceed 150 lines; if it does, extract sections
- File naming: `kebab-case.tsx` for components, `camelCase.ts` for utilities

### 9. Types in Their Own Folder

All TypeScript types live in `types/`. Imported into components. Never defined inline in component files.

```
types/
  db.ts       ← Drizzle inferred types + custom DB types
  api.ts      ← API request/response types
  chat.ts     ← Chat message, conversation, session types
  billing.ts  ← Plan names, subscription status, Midtrans types
```

### Environment Variable Validation Pattern

All env vars are validated at startup in `lib/env.ts`. This file throws with a clear message if any required variable is missing or has an invalid value. Import this file at the top of any `lib/` file that needs env vars — never access `process.env` directly outside of `lib/env.ts`.

```ts
// lib/env.ts
// Validates all required environment variables at startup
// Throws immediately with a clear message if anything is wrong

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  // Database
  databaseUrl: requireEnv("DATABASE_URL"),

  // Auth
  clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
  clerkWebhookSecret: requireEnv("CLERK_WEBHOOK_SECRET"),

  // AI — only required when not mock
  openaiApiKey: process.env.OPENAI_API_KEY, // optional — checked at runtime

  // Modes — validated as typed union
  aiMode: (() => {
    const m = process.env.KUNDESK_AI_MODE ?? "mock"
    if (m !== "mock" && m !== "openai") throw new Error(`Invalid KUNDESK_AI_MODE: "${m}"`)
    return m as "mock" | "openai"
  })(),

  // ... same pattern for all other modes and services
} as const
```

### Additional Conventions

```ts
// Utility function — always use this for className merging
import { cn } from "@/lib/utils"
// cn() = twMerge(clsx(...inputs))

// Server Actions — always validate first
export async function createDocument(rawInput: unknown) {
  const result = documentSchema.safeParse(rawInput)
  if (!result.success) return { error: result.error.flatten() }
  const { orgId } = await requireOrg()
  // ... proceed
}

// Environment variables — typed and validated at startup
// Use T3 env or a custom env.ts that throws on missing vars
```

---

## 11. Mock Mode System

> Same pattern used in Kun Bookshop (`CHAT_MODE=mock|openai`). Expanded here to cover every external paid or rate-limited service. The goal: build and test the entire product without spending money or hitting API limits until everything is working correctly.

### The Core Principle

Every external service has two modes — `mock` and `real`. The caller (component, Server Action, Route Handler) never checks the env variable directly. It just calls the function and gets the right behavior transparently. All mode-switching logic lives inside `lib/`.

### Services and Their Mock Behavior

|Service|Env Variable|Mock Behavior|
|---|---|---|
|OpenAI Chat|`KUNDESK_AI_MODE`|Returns a pre-written streaming response, simulates SSE token-by-token delay — UI streaming works identically|
|OpenAI Embeddings|`KUNDESK_EMBEDDING_MODE`|Returns a random `float[1536]` array — correct shape, meaningless values. Vector operations and similarity search still run|
|Midtrans Payments|`KUNDESK_PAYMENT_MODE`|Fires a fake notification with correct structure — webhook handler runs, state machine updates, subscription activates. No real money|
|AWS S3|`KUNDESK_STORAGE_MODE`|Saves files to local `/tmp/mock-uploads/[orgId]/`. Presigned URL becomes a local path. Processing pipeline still runs|
|Pusher Realtime|`KUNDESK_REALTIME_MODE`|`pusher.trigger()` calls are no-ops — logs to console. Dashboard doesn't receive live updates but all other logic works|
|Resend Email|`KUNDESK_EMAIL_MODE`|Email content logged to console — subject, body, recipient all visible. Nothing actually sent|

> **Clerk and Neon are always real.** Both have generous free tiers, zero cost during development. Mocking auth and database would create more problems than it solves.

### Why Separate Embedding Mode from Chat Mode

You might want real embeddings (to test actual vector similarity) while keeping chat mock (to avoid OpenAI costs on every test message). Keeping them independent gives full control over cost during development.

### Code Pattern

```ts
// lib/ai/stream.ts — caller never knows which mode is active
export async function streamChatResponse(
  messages: ChatMessage[],
  context: string[]
): Promise<ReadableStream> {
  // Check mode at the service boundary — nowhere else
  if (process.env.KUNDESK_AI_MODE === "mock") {
    return createMockStream() // simulated token-by-token stream
  }
  return createOpenAIStream(messages, context) // real OpenAI
}

// lib/ai/embed.ts
export async function embedText(text: string): Promise<number[]> {
  if (process.env.KUNDESK_EMBEDDING_MODE === "mock") {
    // Correct shape (1536 dims), random values — vector math still works
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
  }
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  })
  return response.data[0].embedding
}
```

### Type Safety on Mode Values

Mode values are typed and validated at startup — a typo throws immediately, not silently at runtime.

```ts
// types/config.ts
export type AIMode        = "mock" | "openai"
export type EmbeddingMode = "mock" | "openai"
export type StorageMode   = "mock" | "s3"
export type PaymentMode   = "mock" | "midtrans"
export type RealtimeMode  = "mock" | "pusher"
export type EmailMode     = "mock" | "resend"

// Validated at startup
export function getAIMode(): AIMode {
  const mode = process.env.KUNDESK_AI_MODE
  if (mode !== "mock" && mode !== "openai") {
    throw new Error(`Invalid KUNDESK_AI_MODE: "${mode}". Must be "mock" or "openai"`)
  }
  return mode
}
// Same pattern for all other modes
```

### Full `.env` Structure

```bash
# ─── AI ──────────────────────────────────────────────────────
KUNDESK_AI_MODE=mock              # mock | openai
KUNDESK_EMBEDDING_MODE=mock       # mock | openai
OPENAI_API_KEY=sk-...             # only needed when mode=openai

# ─── STORAGE ─────────────────────────────────────────────────
KUNDESK_STORAGE_MODE=mock         # mock | s3
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-southeast-1
CLOUDFRONT_URL=

# ─── PAYMENTS ────────────────────────────────────────────────
KUNDESK_PAYMENT_MODE=mock         # mock | midtrans
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

# ─── REAL-TIME ───────────────────────────────────────────────
KUNDESK_REALTIME_MODE=mock        # mock | pusher
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=ap1

# ─── EMAIL ───────────────────────────────────────────────────
KUNDESK_EMAIL_MODE=mock           # mock | resend
RESEND_API_KEY=

# ─── AUTH (always real — Clerk free tier) ────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# ─── DATABASE (always real — Neon free tier) ─────────────────
DATABASE_URL=

# ─── APP ─────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Development Workflow by Phase

```
Phase 1–4 (Foundation → Chat):
  ALL modes = mock
  Build and test everything without spending a single rupiah

Phase 5–7 (Dashboard → Billing):
  Switch KUNDESK_EMBEDDING_MODE=openai when testing real doc ingestion
  Keep KUNDESK_AI_MODE=mock until chat UI is complete
  Keep KUNDESK_PAYMENT_MODE=mock until billing logic is solid

Phase 8–9 (Widget → Testing):
  Switch KUNDESK_AI_MODE=openai — test real conversations
  Switch KUNDESK_STORAGE_MODE=s3 — test real file uploads
  Keep KUNDESK_PAYMENT_MODE=mock until ready for real payment testing

Phase 10 (Launch prep):
  All modes = real
  One env variable change per service — nothing else changes
```

---

## 12. Customer Delivery Channels

> This section is critical to understand before building Phase 4 and Phase 8. The web widget alone does not serve the Indonesian SME market — most SMEs have no website. The delivery strategy must match how Indonesians actually contact businesses.

### How Indonesians Contact Businesses (Reality)

1. **WhatsApp** — primary, always. Everyone has it.
2. **Instagram DM** — second, especially food, fashion, beauty
3. **Google Maps** — find location, then call or WhatsApp
4. **Tokopedia / Shopee chat** — retail and product businesses
5. **Website** — almost nobody, unless it's a proper company

### The Four Delivery Channels

#### Channel 1 — QR Code + Standalone Link (Core, all plans)

Every business gets a public chat page at `kundesk.app/chat/[orgSlug]` and a generated QR code that links to it.

**The customer journey:**

```
Customer sees QR code (on counter, packaging, menu, Instagram bio)
  ↓
Scans with phone camera
  ↓
Browser opens → Kundesk chat page for that business
  ↓
Customer asks question → AI replies instantly
```

**Why this works without a website:**

- The QR code IS the entry point — print it, put it anywhere physical
- The link can go in Instagram bio, WhatsApp broadcast, Google Maps description
- No app download needed — opens in browser
- Works for every type of business — warung, klinik, salon

**This is the MVP delivery channel.** Fast to build, zero external API dependency, genuinely solves a real problem.

#### Channel 2 — Web Embed Widget (Starter + Pro)

One `<script>` tag pasted into any website. A chat bubble appears in the corner. Customer clicks → chat opens as an iframe popup.

```html
<script
  src="https://kundesk.app/widget.js"
  data-org="kedai-bu-sari"
  data-color="#069494">
</script>
```

**Best for:** Klinik, properti, travel agent, dealer — businesses that do have websites. Not the primary channel but still valuable for that segment.

#### Channel 3 — WhatsApp Cloud API (Pro plan — Post-launch expansion)

Customer messages the business's WhatsApp number normally. Kundesk intercepts via Meta webhook, AI replies on behalf of the business, reply appears in customer's WhatsApp.

```
Customer opens WhatsApp → messages business number
  ↓
Meta Cloud API → webhook → Kundesk
  ↓
RAG pipeline → OpenAI → reply
  ↓
Kundesk → Meta Cloud API → customer's WhatsApp
```

**Why this is the killer feature:** Indonesians never leave WhatsApp. Zero friction for the customer. Business phone number unchanged. AI works 24/7 without the business owner doing anything.

**Technical requirements:**

- Business owner registers for WhatsApp Business API (Meta verification, takes a few days)
- They connect their number in Kundesk settings (OAuth-style flow)
- Meta's 24-hour conversation window rule applies
- First 1000 conversations/month free on Meta's tier

**This is NOT Phase 1–10.** Planned as Phase 11 or post-launch. BUT — the webhook architecture must be designed now so it's not a painful retrofit. The RAG pipeline and AI response logic is identical regardless of delivery channel. Only the entry/exit layer changes.

#### Channel 4 — Instagram DM (Future — beyond Phase 11)

Meta also provides Instagram Messaging API. Same architecture as WhatsApp once built. Especially powerful for F&B, fashion, beauty businesses with strong Instagram presence.

### Channel × Plan Matrix

|Channel|Free|Starter|Pro|
|---|---|---|---|
|QR Code + Public Link|✓|✓|✓|
|Web Embed Widget|—|✓|✓|
|WhatsApp Integration|—|—|✓|
|Instagram DM|—|—|Future|

### Architecture Impact

The RAG pipeline, database, and security model are **identical** for all channels. Only the delivery layer differs:

```
Web Widget / QR Link:
  Customer browser → Next.js API Route → RAG → SSE → browser

WhatsApp (future):
  Customer WhatsApp → Meta webhook → Next.js API Route → RAG → Meta API → WhatsApp
```

The middle — `Next.js API Route → RAG → response` — is the same function called from different entry points. Design it this way from the start.

---

## 13. Human Handoff Feature

> Planned for Phase 8–9. The AI handles ~97% of conversations automatically. Human handoff is the bridge for the remaining 3% — and a critical selling point.

### What It Is

When the AI cannot answer a question (or the business owner wants to step in), the business owner can take over the conversation manually from their Kundesk dashboard. The customer sees no interruption — same chat window, seamless transition.

### The Flow

```
AI handling conversation normally
  ↓
One of these triggers:
  a) AI responds with "please contact us directly" (fallback response)
  b) Business owner manually clicks "Take Over" in dashboard
  c) Customer explicitly asks "bisa bicara sama orangnya?"
  ↓
Business owner gets notification (dashboard live indicator + optional email)
  ↓
They open the Conversations page → click "Take Over" on that session
  ↓
They type replies manually — customer sees them in the same chat
  ↓
Business owner clicks "Return to AI" → AI resumes handling
```

### Dashboard Behavior During Takeover

- Conversation card shows orange "Manual" badge instead of green "AI"
- Business owner types in a reply box that appears in the conversation view
- `aria-live` announcement when a new message arrives from customer
- Pusher channel `org-[orgId]` fires `conversation:takeover` and `conversation:message` events

### Database Fields Required

```ts
// Added to conversations table
handoffStatus: "ai" | "human" | "pending_handoff"  // default "ai"
takenOverAt: timestamp (nullable)
takenOverBy: text (nullable) — Clerk userId of staff member
```

### Why Plan It Now

The conversation table needs `handoffStatus` from day one. Adding it later means a migration that touches live data. The Pusher channel architecture also needs to accommodate handoff events from the start.

### Works Across All Delivery Channels

Human handoff works identically whether the conversation came from the web widget, QR code link, or (in future) WhatsApp. The conversation is stored the same way — the delivery channel is just metadata.

---

## 14. Build Phases Overview

> Detailed step-by-step is in each Phase Handoff document (Document 2). This is the high-level map.

### Phase 1 — Foundation & Setup

Next.js 16 init, TypeScript strict config, Tailwind v4 + globals.css full setup, shadcn/ui install and base components, Clerk setup + proxy.ts, Neon + Drizzle setup + schema migration (including handoff fields from day one), folder structure, GitHub repo created, **CodeRabbit installed immediately after repo creation** (before any code is pushed), GitHub Actions CI/CD skeleton, ESLint strict config, environment variables structure + `lib/env.ts` validation, `cn()` utility, base types, `next-themes` installed, all mock mode infrastructure.

### Phase 2 — Auth & Multi-Tenancy

Clerk organization flow, org creation webhook handler, proxy.ts guards, dashboard layout shell with Clerk org context, org switcher UI, `requireOrg()` helper, org row in DB synced from Clerk webhook.

### Phase 3 — Document Upload & RAG Pipeline

AWS S3 setup (or mock), presigned URL generation, client-side upload flow with progress, document processing pipeline (parse → chunk → embed → pgvector), document status updates via polling, pgvector HNSW index confirmed, chunk storage with org_id isolation.

### Phase 4 — Chat & Streaming

Public chat page (`/chat/[orgSlug]`), SSE streaming route handler, RAG retrieval query (cosine similarity scoped to org_id), OpenAI streaming (or mock stream), prompt injection detection, rate limiting integration (all 4 limiters), conversation + message storage, QR code generation API route.

### Phase 5 — Dashboard Core

Dashboard layout (sidebar + topbar matching mockup), Overview page (stat cards, Chart.js donut + area + line + bar charts, conversation table, documents panel, usage bar), skeleton loading for every async component, `loading.tsx` per route, chatbot config page, documents management page.

### Phase 6 — Billing & Subscriptions

Midtrans integration (or mock), subscription plans, payment flow, notification URL webhook handler, idempotency check, subscription state machine, plan limit enforcement (atomic increment), Vercel Cron for renewal reminders, billing dashboard page.

### Phase 7 — Analytics & Monitoring

PostHog integration (per-tenant event tracking), analytics dashboard page with deeper charts, Sentry setup with PII scrubbing, Resend + React Email for transactional emails (welcome, billing alerts, usage warnings, handoff notifications).

### Phase 8 — Widget, Embed & Human Handoff

`widget.js` public script (iframe approach — decided), embed code generator page, org slug validation on widget load, widget customization (color, name, greeting), standalone public chat URL fully styled, **human handoff feature** (takeover button, manual reply box, return to AI, Pusher events, dashboard notifications).

### Phase 9 — Testing & CI/CD Completion

Vitest unit tests for all helpers and utilities, React Testing Library for key dashboard components, Playwright E2E for critical flows (sign up → create org → upload doc → chat → billing), GitHub Actions full pipeline with all checks, CodeRabbit workflow review.

### Phase 10 — Polish & Launch

Dark mode implementation (`next-themes` toggle, all tokens switch via `.dark`), color picker for tenant branding (stored in `chatbots.accentColor`), `@next/bundle-analyzer` audit, image optimization audit, accessibility audit (aria attributes, keyboard navigation), SEO metadata for landing page, final security review checklist.

### Phase 11 — WhatsApp Integration (Post-launch)

Meta WhatsApp Cloud API integration, business owner connects their WhatsApp number in settings, incoming message webhook handler, AI replies via Meta API, 24-hour conversation window handling, human handoff extended to WhatsApp channel.

---

## 15. Kun Borneo Context

**Kundesk is a child product of Kun Borneo.**

Kun Borneo is Kevin Mahendra's personal technology brand/studio based in Samarinda/Balikpapan, East Kalimantan, Indonesia.

Current child products:

- **Kun Bookshop** — already built. Full-stack bookshop with AI chatbot (KUN AI), OpenAI tool calling, SSE streaming, JWT auth, MongoDB, Redis, Stripe checkout. This project proved Kevin can build AI-integrated products.
- **Kundesk** — this project. AI customer service SaaS.

Future: A Kun Borneo landing page will introduce all child products. This is planned but NOT in scope for Kundesk's build phases. The footer of Kundesk's landing page already links to Kun Borneo as a soft introduction.

The Kun naming convention: **Kun** prefix + descriptive word. Kun Bookshop, Kundesk, and future products all follow this.

---

## 16. Mockup References

> The actual HTML mockup files are kept separately by Kevin. Reference them by name when building UI.

### `kunchat-homepage.html` → now renamed mentally to Kundesk homepage

Full landing page mockup. All sections built and functional:

- Pill navbar with teal active state
- Hero with scenic gradient background, phone mockup, 3 floating animated cards
- Trust logo strip (Indonesian businesses)
- Features section on **dark matte `#111` background** — 2×2 cards with mini UI previews
- How It Works — 3 numbered steps
- Testimonials carousel (auto-advance, dot indicators)
- Pricing — 3 cards in Rupiah
- FAQ accordion
- CTA banner (white rounded card, decorative italic watermark)
- Footer on dark background

### `kunchat-dashboard.html` → now renamed mentally to Kundesk dashboard

Dashboard mockup. Light mode only (dark mode is Phase 10):

- Sidebar with Clerk org switcher, nav items, teal active state, sidebar CTA card
- Topbar with search, icon buttons, working color picker (12 presets + custom hex)
- Color picker updates entire dashboard live — sidebar active, buttons, charts, usage bar
- Overview page: 4 stat cards with colored icon backgrounds (Sedap-style)
- 3 donut charts (answered rate, quota, rating)
- Area chart (daily trend, 30 days)
- Dual-line chart (monthly, 2025 vs 2026 comparison)
- Grouped bar chart (weekly, highlights today)
- Conversations table with status pills
- Bot status panel with usage bar
- Documents panel with upload zone

### Design Consistency Rules

When building real components, these mockups are the visual reference. Deviate only with intention. The feel should match — warm, professional, not cold/sterile, not generic AI-looking.