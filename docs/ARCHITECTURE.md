# Kundesk Architecture

> **Document type:** Technical reference. Explains the "why" and "how" of Kundesk's design. Use this alongside the Project Bible and Phase Handoff documents for complete context.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Multi-Tenancy Design](#multi-tenancy-design)
3. [RAG Pipeline](#rag-pipeline)
4. [Document Processing](#document-processing)
5. [Payment Flow](#payment-flow)
6. [Live Updates (Pusher)](#live-updates-pusher)
7. [Security Model](#security-model)
8. [Database Schema](#database-schema)
9. [Mock Mode System](#mock-mode-system)
10. [Scaling Considerations](#scaling-considerations)
11. [Common Pitfalls & Lessons](#common-pitfalls--lessons)

---

## System Overview

### The Core Loop

```
┌─────────────────────────────────────────────────────────────┐
│ CUSTOMER SIDE                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Customer asks KUN via:                                    │
│    • Web chat widget (QR code link)                        │
│    • Embed iframe                                          │
│    • (Future) WhatsApp                                     │
│                                                             │
│  Message → browser → /api/chat (SSE)                       │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ KUNDESK API                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Rate limit check (IP + org)                            │
│  2. Prompt injection detection (15 regex patterns)         │
│  3. Quota check (messagesUsed < messagesLimit)             │
│  4. Embed question (OpenAI text-embedding-3-small)         │
│  5. Vector search (pgvector cosine similarity)             │
│  6. Build system prompt with KUN identity + top 5 chunks   │
│  7. Stream response (OpenAI gpt-4o-mini via SSE)           │
│  8. Save messages to DB (transaction)                      │
│  9. Fire Pusher event (dashboard notification)             │
│  10. Update usage count (atomic increment)                 │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ BUSINESS OWNER SIDE                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dashboard (/dashboard):                                   │
│    • Real-time stats (TanStack Query + Pusher)             │
│    • Document upload → processing pipeline → RAG ready     │
│    • Human handoff (take over conversation manually)       │
│    • Analytics (daily, weekly, monthly trends)             │
│    • Billing (Midtrans subscription + renewal)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow (Detailed)

**1. Customer sends message**
```
Browser (ChatPage)
  → validate input (500 char max)
  → POST /api/chat with conversationId, message, orgSlug
  → stream SSE response token-by-token
  → optionally get back conversationId + handoffStatus on final event
```

**2. Server-side RAG + streaming**
```
/api/chat route handler:
  → requireOrg() — validate tenant
  → check rate limits (4 limiters)
  → detect prompt injection (regex patterns)
  → check quota (messagesUsed < limit)
  → embed question (OpenAI)
  → pgvector search (WHERE org_id = $orgId)
  → build system prompt (KUN identity + chunks)
  → stream OpenAI response
  → handleStreamComplete():
      - db.transaction() [FIRST — fast, prevents stale reads]
      - insert messages (user + assistant)
      - increment messagesUsed
      - triggerOrgEvent() [AFTER transaction]
      - triggerUsageUpdated() [AFTER transaction]
      - checkQuotaThresholds()
```

**3. Dashboard receives update via Pusher**
```
TanStack Query invalidates ["dashboard", orgId, "stats"]
  → getOrgStats refetches
  → Topbar + StatCards re-render with new count
```

---

## Multi-Tenancy Design

### The Core Principle

**Shared database, isolated by `org_id` at the application layer.**

Every table with tenant data has an `org_id` column. Every query filters by `org_id` first. This is enforced via the `requireOrg()` helper in every Server Action and Route Handler.

### IDOR Protection

Never query by ID alone. Always use `AND org_id = $orgId`:

```typescript
// ✓ CORRECT — prevents IDOR
const [doc] = await db
  .select()
  .from(documents)
  .where(
    and(
      eq(documents.id, docId),
      eq(documents.orgId, orgId)  // ← critical
    )
  )

if (!doc) throw new Error("Not found") // same error for missing or forbidden

// ✗ WRONG — massive security hole
const doc = await db
  .select()
  .from(documents)
  .where(eq(documents.id, docId))  // Missing org_id filter!
```

### Where `orgId` Comes From

**Always from Clerk server session, never from client:**

```typescript
const { orgId, userId } = await auth()  // ← server session

if (!orgId) throw new Error("No active organization")  // ← throws if missing

// Never do this:
const orgId = request.body.orgId  // ✗ WRONG — client-controlled!
```

### Org Syncing from Clerk

Clerk webhook fires on:
- Org created → insert into `orgs` table with `slug`, `name`, `plan: "free"`, `messagesLimit: 100`
- Org deleted → soft-delete (set `deletedAt`)
- Org metadata updated → sync to `orgs` table

This keeps `orgs` table in sync with Clerk as the source of truth.

### Query Scoping Pattern

Every user-facing query follows this pattern:

```typescript
export async function getUserDocuments() {
  const { orgId } = await requireOrg()  // ← throws if missing

  // Query scoped to org
  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))

  return docs
}
```

---

## RAG Pipeline

### Overview

**RAG = Retrieval-Augmented Generation.** Instead of KUN relying on generic OpenAI knowledge, it retrieves relevant chunks from the business owner's documents, then answers based only on those chunks.

### Three Phases

#### Phase 1: Document Upload & Processing

```
Business owner uploads PDF/TXT
  ↓
Browser: presigned URL upload to S3 (client-side, fast)
  ↓
Server: POST /api/documents with upload confirmation
  ↓
Document row inserted with status: "processing"
  ↓
Background: download from S3 → parse → chunk → embed
  ↓
Document status: "ready", chunks inserted into pgvector
```

**Details:**

```typescript
// 1. Generate presigned URL (5-min expiry, PUT only)
const presignedUrl = await generatePresignedUrl(
  `orgs/${orgId}/documents/${timestamp}-${filename}`
)

// 2. Client uploads directly to S3 via presigned URL
// (no server bottleneck, instant for user)

// 3. Server notified: POST /api/documents/process
// → Start pipeline async (don't wait for completion)

// 4. Pipeline (wrapped in try-catch):
const file = await downloadFromS3(s3Key)
const text = await parseFile(file)  // pdf-parse or plain text
const chunks = await chunkText(text, {
  targetTokens: 300,
  overlapTokens: 30,
  charsPerToken: 3  // ← calibrated for Indonesian text
})
const embeddings = await batchedAsync(
  chunks,
  10,  // batch size
  (chunk) => embedText(chunk.content)
)
await db.transaction(async (tx) => {
  await tx.insert(chunks).values(
    embeddings.map((emb, i) => ({
      orgId,
      documentId,
      content: chunks[i].content,
      embedding: emb,
    }))
  )
  await tx.update(documents)
    .set({ status: "ready", chunkCount: embeddings.length })
    .where(eq(documents.id, documentId))
})

// 5. Fire Pusher event → dashboard updates live
```

#### Phase 2: Customer Asks a Question

```
Customer: "Apa jam buka?"
  ↓
Server embeds question → same 1536-dim space as documents
  ↓
pgvector cosine similarity: MOST SIMILAR 5 CHUNKS
  ↓
Top 5 chunks passed to OpenAI as "context"
```

**The Query:**

```sql
SELECT
  id,
  content,
  1 - (embedding <=> $1) as similarity
FROM chunks
WHERE org_id = $2
ORDER BY embedding <=> $1 DESC
LIMIT 5
```

- `<=>` is pgvector's cosine distance operator
- `1 - distance` converts to similarity (0–1 scale)
- Scoped to `org_id` — prevents cross-tenant leaks

**In code:**

```typescript
export async function retrieveChunks(
  embedding: number[],
  orgId: string
): Promise<string[]> {
  const results = await db.execute(
    sql`
      SELECT content
      FROM chunks
      WHERE org_id = ${orgId}
      ORDER BY embedding <=> ${embedding}::vector DESC
      LIMIT 5
    `
  )

  return results.map((r) => r.content)
}
```

#### Phase 3: Stream Response via OpenAI

```typescript
const chunks = await retrieveChunks(embedding, orgId)

const systemPrompt = buildSystemPrompt(chunks, orgId)
// System prompt includes:
// - KUN identity (name, tone, voice — "Kak" rules)
// - Explicit instruction: "answer ONLY from the provided chunks"
// - If question not in chunks: "Jujur saja, aku tidak tahu..."

const stream = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: systemPrompt },
    ...conversationHistory,  // last 6 messages only
    { role: "user", content: userMessage }
  ],
  stream: true,
})

// SSE stream to browser
const readable = OpenAIStream(stream)  // converts to ReadableStream
return new Response(readable, {
  headers: { "Content-Type": "text/event-stream" }
})
```

### Why pgvector, Not a Separate Vector DB?

**Pros of pgvector:**
- No new infrastructure dependency
- One connection string, one bill
- Transactional consistency (chunks + embeddings updated together)
- HNSW index for sub-ms search

**Cons:**
- Slower than Pinecone/Weaviate at petabyte scale
- Requires PostgreSQL expertise

**Trade-off:** We optimized for typical SME use case (100MB–1GB of documents). If Kundesk scales to massive vector corpora, migrating to a specialized DB is a refactor, not a rewrite.

---

## Document Processing

### The Pipeline (Detailed)

```
POST /api/documents/process
  ↓
[Validate] file exists in S3, org owns it
  ↓
[Parse] pdf-parse or plain text extraction
  ↓
[Chunk] break into ~300-token chunks, 50-token overlap
  ↓
[Batch Embed] OpenAI API, 10 chunks/batch
  ↓
[Insert] pgvector chunks to DB
  ↓
[Update Status] document.status = "ready"
  ↓
[Pusher Event] dashboard refetch
```

### Chunking Strategy

**Target:** ~300 tokens per chunk, 50 token overlap

**Why 300?** 
- Small enough to fit in context windows alongside question + conversation
- Large enough to preserve semantic meaning
- Overlap prevents breaking mid-sentence

**Indonesian Text Calibration:**
```typescript
const CHARS_PER_TOKEN = 3  // Indonesian avg (English is 4)
const TARGET_CHUNK_TOKENS = 300
const OVERLAP_TOKENS = 30

const chunkSize = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN  // ~900 chars
const overlapSize = OVERLAP_TOKENS * CHARS_PER_TOKEN      // ~90 chars
```

### Error Handling

Wrapped in `Promise.race()` with 55-second timeout:

```typescript
try {
  await Promise.race([
    runProcessingPipeline(documentId, orgId, s3Key),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Processing timeout")), 55000)
    )
  ])
} catch (err) {
  console.error(`[documents] Processing failed for ${documentId}:`, err)
  await markFailed(documentId)  // ← called ONCE in outer catch
}
```

**Why 55 seconds?** Vercel function timeout is 60s on free tier. 55s leaves 5s buffer.

---

## Payment Flow

### Subscription Model

Kundesk uses **manual subscription renewal** (Midtrans has no native recurring billing).

```
Day 0: Customer chooses plan → Midtrans charge created
       → Customer pays (GoPay, OVO, DANA, BCA VA, etc.)
       → Webhook: settlement + fraud_status ✓
       → orgs.subscriptionStatus = "active"
       → orgs.nextBillingDate = TODAY + 30 days
       ↓
Day 30: Vercel Cron runs → finds orgs where nextBillingDate = TODAY
        → Creates NEW Midtrans charge
        → Sends payment link via Resend email
        → Customer pays again
        ↓
Day 33: If not paid → orgs.subscriptionStatus = "past_due"
        → Features limited (less aggressive than suspended)
        ↓
Day 37: If still not paid → orgs.subscriptionStatus = "suspended"
        → Pro features blocked, Free plan only
        ↓
On payment: → Webhook settlement
            → subscriptionStatus = "active"
            → nextBillingDate reset to +30 days
```

### State Machine

```
┌─────────┐
│  free   │ ← new org, 100 messages/month
└────┬────┘
     │ (customer chooses plan, pays)
     ▼
┌─────────┐
│ active  │ ← subscription valid, full features
└────┬────┘
     │ (renewal date arrives, payment link sent)
     │ (customer doesn't pay for 3 days)
     ▼
┌──────────┐
│past_due  │ ← payment overdue, features still available
└────┬─────┘
     │ (unpaid for 7 days total)
     ▼
┌───────────┐
│suspended  │ ← payment overdue 7+ days, Pro features blocked
└────┬──────┘
     │ (customer pays)
     ▼
┌─────────┐
│ active  │
└─────────┘
```

### Webhook Verification (Critical)

Midtrans sends POST to `/api/webhooks/midtrans` with signature:

```typescript
const signature = SHA512(
  orderId + statusCode + grossAmount + serverKey
)

if (signature !== request.headers["X-Signature"]) {
  return new Response("Unauthorized", { status: 401 })
}
```

### Idempotency (Critical)

Midtrans retries notifications multiple times. If you process twice:

```
Order: KUNDESK-abc-STARTER-1234567890-P5
Amount: 149000
Status: settlement
  ↓ webhook 1
messagesUsed incremented 100 → 101  ✓
  ↓ webhook 2 (retry)
messagesUsed incremented 101 → 102  ✗ WRONG (should stay 101)
  ↓ webhook 3 (retry)
messagesUsed incremented 102 → 103  ✗ WRONG
```

**Prevention:**

```typescript
// Check idempotency table BEFORE processing
const existing = await db
  .select()
  .from(processedWebhooks)
  .where(eq(processedWebhooks.externalId, orderId))

if (existing.length > 0) {
  console.log(`[midtrans] Already processed ${orderId}`)
  return new Response("OK", { status: 200 })  // ← return 200, don't retry
}

// Process the webhook
await activateSubscription(orgId, plan, amount)

// Record that we processed it
await db.insert(processedWebhooks).values({
  externalId: orderId,
  source: "midtrans",
  processedAt: new Date()
})
```

### Promo Code Logic

Promo codes are stored in `promoCodes` table:

```typescript
{
  id: "promo-5",
  code: "JAKARTA50",
  applicablePlans: ["starter", "pro"],  // ← can't use on free
  discountPercent: 50,
  maxUses: 100,
  usedCount: 47,
  validFrom: "2026-01-01",
  validTo: "2026-03-31",
}
```

**Lookup (case-insensitive):**

```typescript
const promo = await db
  .select()
  .from(promoCodes)
  .where(
    sql`LOWER(${promoCodes.code}) = LOWER(${code})`
  )

if (!promo || usedCount >= maxUses) {
  return { error: "Invalid or expired promo code" }
}

// Encode promo ID in order_id for webhook tracking
const orderId = `KUNDESK-${orgSlice}-${plan}-${timestamp}-P${promo.id}`
```

**On successful payment:**
```typescript
// Increment usedCount (in webhook handler)
await db
  .update(promoCodes)
  .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
  .where(eq(promoCodes.id, promoId))
```

---

## Live Updates (Pusher)

### The Problem We Solved (Phase 14)

**Symptom:** Dashboard stat cards lagged one message behind. When customer sent message #5, the card showed count 4 instead of 5.

**Root cause:** Pusher event fired BEFORE database transaction committed. TanStack Query refetched immediately, but the write hadn't committed yet — stale read.

**Solution:** Different Pusher ordering for different paths.

### Pusher Ordering Rules

| Path | Pusher fires | DB writes | Why |
|---|---|---|---|
| **AI mode (`handleStreamComplete`)** | **AFTER** transaction | Transaction first (fast, ms) | Stream already finished — no user-facing latency. Firing after guarantees refetch sees committed data. |
| **Human mode (staff reply)** | BEFORE DB writes | After Pusher | User is actively waiting; single small insert; cold-start risk is real. |
| **Handoff request** | BEFORE DB writes | After Pusher | Same as above. |
| **Takeover / Return / Dismiss** | BEFORE DB writes | Transaction first (small) | Same as above — small atomic transactions, staff-initiated. |

**Code example (AI mode):**

```typescript
const handleStreamComplete = async (assistantResponse: string) => {
  try {
    const newMessagesUsed = freshOrgQuota.messagesUsed + 1

    // DB TRANSACTION FIRST
    await db.transaction(async (tx) => {
      await tx.insert(messages).values({
        orgId: org.id,
        conversationId,
        role: "assistant",
        content: assistantResponse,
      })
      await tx
        .update(orgs)
        .set({ messagesUsed: sql`${orgs.messagesUsed} + 1` })
        .where(eq(orgs.id, org.id))
    })

    // PUSHER AFTER TRANSACTION
    triggerOrgEvent(org.id, "conversation:message", {
      conversationId,
      role: "assistant",
      handoffStatus: "ai",
    }).catch(console.error)

    triggerUsageUpdated(org.id, {
      messagesUsed: newMessagesUsed,
      messagesLimit: freshOrgQuota.messagesLimit,
    }).catch(console.error)
  } catch (err) {
    console.error("[chat] Failed to save messages:", err)
  }
}
```

### Channel Architecture

```
Org channel: org-{orgId}
  └─ events:
     ├─ conversation:new       → new conversation started
     ├─ conversation:message   → new message (with role + handoffStatus)
     ├─ conversation:takeover  → staff took over
     ├─ conversation:return    → AI resumed
     ├─ conversation:dismiss   → pending handoff rejected
     ├─ usage:updated          → quota incremented
     └─ notification:new       → in-dashboard notification

Customer channel: conversation-{channelToken}
  └─ events:
     ├─ conversation:message   → new message in this conversation
     ├─ conversation:takeover  → staff taking over
     ├─ conversation:return    → AI resuming
     └─ conversation:dismiss   → pending request dismissed
```

### Channel Auth

```typescript
// Dashboard connects to org-{orgId}
// Must verify user belongs to org

// Customer widget connects to conversation-{channelToken}
// channelToken is a UUID issued per conversation
// Token is only valid for that conversation + org
// Prevents customer A from listening to customer B's conversation
```

**Auth endpoint (`/api/pusher/auth`):**

```typescript
export async function POST(request: Request) {
  const { socket_id, channel_name } = await request.json()

  const { orgId } = await auth()  // ← verify via Clerk
  if (!orgId) throw new Error("Unauthorized")

  if (channel_name.startsWith("org-")) {
    // Dashboard channel — user must belong to this org
    if (!channel_name.includes(orgId)) {
      return new Response("Unauthorized", { status: 401 })
    }
  } else if (channel_name.startsWith("conversation-")) {
    // Customer channel — token must exist and belong to org
    const token = channel_name.replace("conversation-", "")
    const convo = await getConversationByToken(token, orgId)
    if (!convo) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const auth = pusher.authenticate(socket_id, channel_name)
  return new Response(JSON.stringify(auth))
}
```

### Cold Start Mitigation

Neon serverless sleeps after inactivity. First query wakes it: 2–5 second latency. This is why Pusher fires BEFORE small writes in human/handoff paths:

```
User waiting for staff reply
  ↓
API: Fire Pusher immediately (ms)
  ↓
Dashboard updates instantly (UI snappy)
  ↓
Meanwhile: DB transaction hits cold start (2–5s)
  ↓
DB transaction completes (eventual consistency)
  ↓
UI already updated — user doesn't notice the DB latency
```

---

## Security Model

### 11 Layers of Defense

#### Layer 1: Network Boundary (`proxy.ts`)

Routes are categorized:

```typescript
// Dashboard routes — require Clerk auth + org
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const { userId, orgId } = await auth()
    if (!userId || !orgId) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }
  }

  // Webhook routes — skip auth, use signature verification
  if (request.nextUrl.pathname.startsWith("/api/webhooks")) {
    return NextResponse.next()
  }

  // Public chat routes — skip auth
  if (request.nextUrl.pathname.startsWith("/chat")) {
    return NextResponse.next()
  }
}
```

#### Layer 2: Tenant Isolation (`requireOrg()`)

```typescript
export async function requireOrg() {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  if (!orgId) throw new Error("No active organization")
  return { orgId, userId }
}
```

Called at the top of every Server Action and Route Handler. Without it, no database access.

#### Layer 3: Input Validation (Zod v4)

Every Server Action validates input before touching DB:

```typescript
const messageSchema = z.object({
  conversationId: z.number().int().positive(),
  message: z.string().min(1).max(500),
  orgSlug: z.string().regex(/^[a-z0-9-]+$/),
})

export async function sendMessage(input: unknown) {
  const result = messageSchema.safeParse(input)
  if (!result.success) {
    return { error: result.error.flatten() }
  }

  const { orgId } = await requireOrg()
  // Proceed with validated data
}
```

#### Layer 4: Prompt Injection Detection

15 regex patterns check for common injection attempts:

```typescript
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt/i,
  /forget everything/i,
  // ... 12 more patterns
]

function detectPromptInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message))
}
```

If detected, return a natural deflection response (HTTP 200, don't tip off attacker):

```typescript
if (detectPromptInjection(message)) {
  console.warn(`[chat] Prompt injection detected from ${ip}`)
  return new Response(
    `data: ${JSON.stringify({
      role: "assistant",
      content: "Pertanyaan kamu agak aneh deh. Tanya soal bisnis aja yuk!",
    })}\n\n`,
    { headers: { "Content-Type": "text/event-stream" } }
  )
}
```

#### Layer 5: Rate Limiting (4 Upstash Limiters)

```typescript
// Rate limiter 1: per IP (global)
const chatRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  key: `rl:chat:ip:${ip}`,
})

// Rate limiter 2: per org (prevent cost abuse)
const orgMessageLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  key: `rl:org:${orgId}`,
})

// Rate limiter 3: uploads
const uploadRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  key: `rl:upload:${orgId}`,
})

// Rate limiter 4: auth endpoints
const authRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  key: `rl:auth:${ip}`,
})
```

#### Layer 6: Webhook Verification

**Midtrans:** SHA512 signature check
**Clerk:** Svix signature verification (built into `@clerk/nextjs`)

#### Layer 7: File Upload Security

```typescript
// 1. Allowed MIME types only
const ALLOWED_TYPES = ["application/pdf", "text/plain"]
if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error("Invalid file type")
}

// 2. Max file size
if (file.size > 10 * 1024 * 1024) {
  throw new Error("File too large")
}

// 3. File path scoped to org
const s3Key = `orgs/${orgId}/documents/${timestamp}-${sanitizeFilename(file.name)}`

// 4. Magic byte verification (after S3 upload)
const buffer = await downloadFromS3(s3Key)
const fileType = await FileTypeFromBuffer(buffer)
if (!ALLOWED_TYPES.includes(fileType.mime)) {
  await deleteFromS3(s3Key)
  throw new Error("File content doesn't match MIME type")
}
```

#### Layer 8: Plan Limit Enforcement

```typescript
// Atomic check + increment in single SQL query
const result = await db
  .update(orgs)
  .set({ messagesUsed: sql`${orgs.messagesUsed} + 1` })
  .where(
    and(
      eq(orgs.id, orgId),
      sql`${orgs.messagesUsed} < ${orgs.messagesLimit}`,  // ← atomic guard
    )
  )
  .returning()

if (result.length === 0) {
  return new Response(
    JSON.stringify({ error: "Quota exceeded" }),
    { status: 402 }
  )
}
```

#### Layer 9: Security Headers

```typescript
export async function GET(request: NextRequest) {
  const response = new NextResponse(/* ... */)
  
  // Prevent clickjacking (except for chat widget — that's intentional)
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  
  // HTTPS only
  response.headers.set("Strict-Transport-Security", "max-age=31536000")
  
  // No MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")
  
  // CSP (Content Security Policy)
  response.headers.set("Content-Security-Policy", "...")
  
  // Permissions
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  
  return response
}
```

#### Layer 10: Org Slug Enumeration Protection

Never reveal whether a slug doesn't exist OR the chatbot is inactive:

```typescript
export async function GET(request: NextRequest, { params }) {
  const { orgSlug } = await params
  const org = await getOrgBySlug(orgSlug)

  // Same response whether org missing or chatbot inactive
  if (!org || !org.chatbot?.isActive) {
    notFound()  // ← generic 404, no detail
  }

  return new Response(/* chat page */)
}
```

#### Layer 11: Logging & Monitoring

```typescript
// Sensitive fields redacted from logs
const REDACTED_FIELDS = [
  "password",
  "token",
  "secret",
  "embedding",
  "content",
]

function sanitizeForLogging(obj: Record<string, any>) {
  const sanitized = { ...obj }
  for (const field of REDACTED_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]"
    }
  }
  return sanitized
}

// Sentry beforeSend hook
Sentry.beforeSend((event, hint) => {
  if (event.request?.data) {
    event.request.data = sanitizeForLogging(event.request.data)
  }
  return event
})
```

---

## Database Schema

### Tables Overview

```
┌──────────────────────────────────────────┐
│ orgs                                     │
├──────────────────────────────────────────┤
│ id (PK) → Clerk orgId                   │
│ slug (unique) → used in /chat/[slug]    │
│ name                                     │
│ plan: "free" | "starter" | "pro"        │
│ subscriptionStatus                       │
│ messagesUsed / messagesLimit             │
│ currentPeriodEnd / nextBillingDate       │
└────────┬─────────────────────────────────┘
         │
         ├─→ ┌────────────────────┐
         │   │ chatbots           │
         │   ├────────────────────┤
         │   │ orgId (FK)         │
         │   │ accentColor        │
         │   │ language           │
         │   │ isActive           │
         │   └────────────────────┘
         │
         ├─→ ┌────────────────────┐
         │   │ documents          │
         │   ├────────────────────┤
         │   │ orgId (FK)         │
         │   │ s3Key              │
         │   │ status             │
         │   │ chunkCount         │
         │   └────────────────────┘
         │        │
         │        └─→ ┌──────────────────┐
         │            │ chunks           │
         │            ├──────────────────┤
         │            │ orgId (FK)       │
         │            │ documentId (FK)  │
         │            │ content          │
         │            │ embedding (pgvec)│
         │            │ INDEX: hnsw      │
         │            └──────────────────┘
         │
         ├─→ ┌────────────────────┐
         │   │ conversations      │
         │   ├────────────────────┤
         │   │ orgId (FK)         │
         │   │ sessionId          │
         │   │ handoffStatus      │
         │   │ takenOverAt        │
         │   │ takenOverBy (FK)   │
         │   └────────────────────┘
         │        │
         │        └─→ ┌──────────────────┐
         │            │ messages         │
         │            ├──────────────────┤
         │            │ orgId (FK)       │
         │            │ conversationId   │
         │            │ role             │
         │            │ content          │
         │            │ tokensUsed       │
         │            └──────────────────┘
         │
         ├─→ ┌────────────────────┐
         │   │ payments           │
         │   ├────────────────────┤
         │   │ orgId (FK)         │
         │   │ midtransOrderId    │
         │   │ plan               │
         │   │ amount             │
         │   │ status             │
         │   └────────────────────┘
         │
         ├─→ ┌────────────────────┐
         │   │ promoCodes         │
         │   ├────────────────────┤
         │   │ code (unique)      │
         │   │ applicablePlans    │
         │   │ discountPercent    │
         │   │ validFrom/To       │
         │   │ maxUses / usedCount│
         │   └────────────────────┘
         │
         └─→ ┌────────────────────┐
             │ notifications      │
             ├────────────────────┤
             │ orgId (FK)         │
             │ type (8 types)     │
             │ body               │
             │ isRead             │
             │ createdAt          │
             └────────────────────┘

┌──────────────────────────────────────┐
│ processedWebhooks (idempotency)     │
├──────────────────────────────────────┤
│ externalId (unique)                 │
│ source: "midtrans" | "clerk" | ...  │
│ processedAt                         │
└──────────────────────────────────────┘
```

### Key Relationships

**Org → Everything:** Every table with tenant data has `org_id`. This is THE isolation boundary.

**Document → Chunks:** One document has many chunks. Deleting a document cascades to its chunks.

**Conversation → Messages:** One conversation has many messages (chronological order).

**Promo Code Tracking:** Codes track `usedCount` for enforcement. Webhook handler increments on successful payment.

### Indexes

```sql
-- Prevent hot rows on org stats
CREATE INDEX IF NOT EXISTS orgs_plan_idx ON orgs(plan);
CREATE INDEX IF NOT EXISTS orgs_subscription_status_idx ON orgs(subscriptionStatus);

-- Speed up chunk retrieval
CREATE INDEX IF NOT EXISTS chunks_org_id_idx ON chunks(org_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);

-- Speed up conversation queries
CREATE INDEX IF NOT EXISTS conversations_org_id_idx ON conversations(org_id);
CREATE INDEX IF NOT EXISTS conversations_org_handoff_status_idx ON conversations(org_id, handoff_status);

-- Speed up message queries (for retention + analytics)
CREATE INDEX IF NOT EXISTS messages_org_created_idx ON messages(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);

-- Speed up notification queries
CREATE INDEX IF NOT EXISTS notifications_org_created_idx ON notifications(org_id, created_at DESC);
```

---

## Mock Mode System

### Why Mock Mode?

Building and testing without spending money on OpenAI, Midtrans, S3, Pusher, Resend. Entire product works with only Clerk and Neon (both have generous free tiers).

### How It Works

Every external service has a mode env var:

```bash
KUNDESK_AI_MODE=mock              # mock | openai
KUNDESK_EMBEDDING_MODE=mock       # mock | openai
KUNDESK_STORAGE_MODE=mock         # mock | s3
KUNDESK_PAYMENT_MODE=mock         # mock | midtrans
KUNDESK_REALTIME_MODE=mock        # mock | pusher
KUNDESK_EMAIL_MODE=mock           # mock | resend
```

The caller never checks the mode. Mode-switching logic lives in `lib/`:

```typescript
// lib/ai/stream.ts
export async function streamChatResponse(
  messages: ChatMessage[],
  context: string[]
): Promise<ReadableStream> {
  if (process.env.KUNDESK_AI_MODE === "mock") {
    return createMockStream()  // pre-written responses, token delay
  }
  return createOpenAIStream(messages, context)  // real OpenAI
}

// lib/ai/embed.ts
export async function embedText(text: string): Promise<number[]> {
  if (process.env.KUNDESK_EMBEDDING_MODE === "mock") {
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
  }
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  })
  return resp.data[0].embedding
}
```

### Mock Implementations

| Service | Mock Behavior |
|---|---|
| **OpenAI Chat** | Pre-written response ("Apa ada yang lain?"), SSE token delay simulated |
| **OpenAI Embed** | Random `float[1536]` array, correct shape for pgvector |
| **Midtrans** | Fake webhook with correct structure, subscription activates |
| **S3** | Save to `/tmp/mock-uploads/[orgId]/`, presigned URL → local path |
| **Pusher** | No-op `trigger()` call, logged to console |
| **Resend** | Email content logged to console, nothing actually sent |

### Development Workflow

```
Phase 1–4: All modes = mock
  → Build & test without spending money

Phase 5–7: Switch EMBEDDING_MODE=openai for real doc testing
  → Keep AI_MODE=mock (save OpenAI costs)

Phase 8: Switch AI_MODE=openai for conversation testing
  → Real-time user feedback, real AI quality

Phase 10: All modes = real
  → Production deployment
```

---

## Scaling Considerations

### Current Limits

**Vercel Free Tier:**
- Function timeout: 10 seconds
- Cold start: 5–10 seconds
- Memory: 128 MB

**Neon Serverless:**
- Connections per pool: ~100
- Cold start: 2–5 seconds
- Query timeout: default 30s

**Upstash Redis:**
- Rate limit: 100 req/s (scales with plan)
- Max value size: 512 MB

**OpenAI:**
- Rate limits per org depend on API key
- Batch size: 10 embeddings/call (current)

### Scaling Path

**If 100 orgs:**
- Upgrade Vercel to Pro ($20/mo) → 60s timeout
- No DB changes needed (pgvector scales to 1B+ vectors)
- Monitor Pusher usage (currently free tier, $49/mo at 50k connections)

**If 1000 orgs:**
- Dedicated Neon Pro ($600/mo) → more connections, higher QPS
- CloudFront CDN ($100 AWS credit + variable cost)
- Separate vector DB (Pinecone/Weaviate) if document corpus > 10GB

**If 10,000 orgs:**
- Migrate off Vercel to containerized infrastructure (ECS, Kubernetes)
- Postgres replica for read scaling
- Message archival (move old messages to cold storage, keep hot data fresh)
- User-facing analytics cache (materialized views)

### Optimization Points

1. **Document chunking:** Reduce chunk size if corpus grows (300 → 200 tokens)
2. **Vector search:** Add pre-filtering by document tags (org_id + tag_id) to reduce search space
3. **Conversation archival:** Delete messages > 90 days (already done via cron)
4. **Rate limiter tuning:** Monitor abuse, adjust sliding windows as needed

---

## Common Pitfalls & Lessons

### 1. Pusher Ordering

**Lesson:** Different paths need different Pusher ordering based on user-waiting vs async context.

**Pitfall:** Blanket-applying "fire Pusher before DB" to all paths causes stale reads in background tasks.

**Rule:** AI mode fires Pusher AFTER transaction. Human/handoff paths fire BEFORE (small writes, user waiting).

### 2. Idempotency on Webhooks

**Lesson:** Midtrans (and Clerk) retry notifications. Without idempotency, webhook #2 double-processes.

**Pitfall:** Logging "already processed" to console then STILL running the payment logic.

**Rule:** Check `processedWebhooks` table BEFORE doing anything. Return 200 OK if already seen.

### 3. Org Scoping on Every Query

**Lesson:** Forgetting `org_id` in WHERE clause = catastrophic IDOR vulnerability.

**Pitfall:** "We'll fix it later" → deployed to production with cross-tenant data leaks possible.

**Rule:** `requireOrg()` called first in every Server Action. Every DB query includes `WHERE org_id = ?`.

### 4. Silent Failures in Webhooks

**Lesson:** Quota webhook failure was totally silent because `.catch(console.error)` upstream swallowed the constraint error.

**Pitfall:** Spent hours debugging why quota alerts never fired, but the code was correct — just the enum was wrong.

**Rule:** Validate all enum values at startup (TypeScript + database constraints). Make failures loud.

### 5. Message Role Consistency

**Lesson:** DB role and Pusher role must match, always.

**Pitfall:** Stored `human_agent` in DB but fired `assistant` to Pusher → customer UI handler didn't render it.

**Rule:** Single source of truth for message role. Check table in Phase 14 Handoff before adding canned messages.

### 6. Cold Start Timing

**Lesson:** Neon serverless sleeps, then wakes with 2–5s latency on first query.

**Pitfall:** Blaming Pusher for dashboard lag when actually the issue was DB cold start.

**Rule:** Cold start is acceptable for background tasks (fire Pusher first for user-waiting scenarios). Monitor `DURATION` header in logs.

### 7. Chunking for Indonesian Text

**Lesson:** English defaults produce chunks that are too large for Indonesian documents.

**Pitfall:** Using `CHARS_PER_TOKEN=4` (English average) resulted in 400-token chunks (too coarse).

**Rule:** `CHARS_PER_TOKEN=3` for Indonesian. Recalibrate if adding other languages.

---

## References

- **Project Bible:** `kundesk-project-bible.md` — comprehensive product + tech reference
- **Phase Handoff:** `kundesk-phase-handoff.md` — current build state + recent lessons
- **GitHub:** `https://github.com/thekevinkun/kundesk` — source code

---

**Last updated:** June 2026  
**Maintained by:** Kevin Mahendra