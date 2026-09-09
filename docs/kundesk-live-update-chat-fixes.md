# Kundesk Live Update & Chat Fixes Supplement

> **Document Type:** Supplementary — read alongside `kundesk-phase-handoff.md`, not instead of it.
> **Covers:** Work done after Phase 12e. Two merged PRs + ongoing work.
> **Last Updated:** June 2026

---

## What Was Fixed

### 1. Dashboard Live Update (The Big One)

**Problem:** Stats, charts, and conversation panel never updated while staying on the dashboard. Everything only updated after switching tabs — because `refetchOnWindowFocus` was the only thing triggering refetches.

**Root causes found and fixed (in order of discovery):**

#### A. Double Pusher subscription
`PusherProvider` (layout) AND `DashboardOverview` both called `usePusherChannel`. Two subscriptions racing on the same channel — events were being dropped. Fixed by removing `usePusherChannel` from `DashboardOverview` entirely. All invalidation logic now lives only in `PusherProvider`.

#### B. Stale closures in `usePusherChannel`
All Zustand actions (`setPendingHandoff`, `addUnreadConversation`, `incrementUnread`) and `queryClient` were captured in the async `import("pusher-js").then()` closure at mount time. Never updated. Fixed with a single `stableRef` pattern — one ref holding everything, updated every render via a no-dep `useEffect`. All channel bind handlers read from `stableRef.current`. Dep array reduced to `[orgId]` only.

```ts
const stableRef = useRef({ incrementUnread, addUnreadConversation, setPendingHandoff, queryClient, callbacks });
useEffect(() => { stableRef.current = { ... }; }); // no deps — runs every render
```

#### C. Neon cold start delay (25-30 seconds)
`triggerUsageUpdated`, `triggerConversationMessage`, and `triggerConversationTakeover` were all firing AFTER `await db.insert/update` calls. Neon serverless goes cold between requests causing 25-30s delays before Pusher events fired.

**Fix pattern — fire Pusher BEFORE DB writes in human/handoff paths:**

```ts
// CORRECT order for human mode and handoff paths:
triggerConversationMessage(...).catch(console.error); // 1. Pusher first — instant
await db.insert(messages)...;                         // 2. DB after — Neon cold start doesn't block UI
await db.update(orgs)...;                             // 3. Quota increment last
```

**AI mode is different** — Pusher fires AFTER the transaction because:
- Step 8 (`freshOrgQuota` query) already warms Neon before the transaction
- Messages must exist in DB before stats refetch reads them (otherwise Total Pesan shows 0 on first message)

#### D. `staleTime` and `refetchOnWindowFocus`
- Global `staleTime: 60_000` — keeps this, prevents polling on `getPendingHandoffCount` etc.
- `refetchOnWindowFocus: false` — disabled globally. Was masking the real issue.
- Pusher-driven queries get explicit `staleTime: 0` + `initialDataUpdatedAt: 0` so `invalidateQueries` always triggers an immediate refetch.

**Queries with `staleTime: 0`:**
- `["dashboard", orgId, "stats"]`
- `["dashboard", orgId, "charts"]`
- `["conversations", "recent"]`
- `["conversations", "human-unread"]`

#### E. Chart debounce timer
`chartInvalidateTimer` was declared inside `PusherProvider` component body — recreated as `null` on every render. Moved to **module level** so it actually survives re-renders.

```ts
// Module level — outside the component
let chartInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
```

#### F. `RecentConversationsPanel` — now self-fetching
Removed the prop-drilling pattern (`newConversation`, `latestMessage`, `latestStatusUpdate` props from `DashboardOverview`). Panel now has its own `useQuery(["conversations", "recent"])`. `PusherProvider` invalidates this key on every relevant event.

---

### 2. Accent Color Sync

**Problem:** Charts rendered with wrong color on first visit. "Gagal memuat warna brand" toast on load. Accent color bled into landing page on browser back navigation.

**Fix:** Created `AccentColorProvider` in dashboard layout. Applies `--color-brand` synchronously from server-known value. Cleanup removes inline style on unmount so landing page falls back to `globals.css` default.

```tsx
// components/providers/accent-color-provider.tsx
useEffect(() => {
  document.documentElement.style.setProperty("--color-brand", accentColor);
  setAccentColor(accentColor); // also write to Zustand store
  return () => {
    document.documentElement.style.removeProperty("--color-brand"); // landing page reset
  };
}, [accentColor, setAccentColor]);
```

All chart components (`BarChart`, `AreaChart`, `LineChart`, `DonutCharts`) accept optional `accentColor` prop. Added to `useEffect` deps so charts rebuild when color changes live.

Removed async `getChatbotConfig()` fetch from `Topbar` — was the source of the error toast.

---

### 3. Chat Icon Dot — DB-Driven Unread (localStorage → DB)

**Problem:** `unreadConversationIds` was backed by localStorage — per-device. Opening dashboard on laptop cleared the dot on mobile.

**Fix:** Replaced entirely with `getHumanUnreadConversationIds` DB query.

```sql
SELECT c.id FROM conversations c
WHERE c.org_id = $orgId
  AND c.handoff_status IN ('human', 'pending_handoff')
  AND (SELECT m.role FROM messages m WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC LIMIT 1) = 'user'
  AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id
              AND m.created_at > NOW() - INTERVAL '24 hours')
```

- **`pending_handoff`** included — dot always shows when customer is waiting
- **`human`** with last message `role = 'user'` — customer replied, staff hasn't responded
- Both `ConversationCountBadge` (sidebar) and `Topbar` chat icon read from `["conversations", "human-unread"]` query
- `refetchInterval: 60_000` on both — safety net for missed Pusher events

**Clearing behavior:**
- **PENDING** → dot clears only after staff replies (`handleStaffReplied` invalidates query)
- **MANUAL** → dot clears immediately on row click via optimistic cache update:

```ts
// Do NOT use invalidateQueries here — DB still returns the ID until staff replies
// Optimistic removal gives immediate feedback
queryClient.setQueryData<number[]>(
  ["conversations", "human-unread"],
  (prev) => (prev ?? []).filter((id) => id !== convo.id),
);
```

**Removed from `conversation-store.ts`:** All localStorage logic, `unreadConversationIds`, `addUnreadConversation`, `clearUnreadConversation`, `hydrateUnreadConversationIds`, `activeOrgId`.

**Removed from `use-pusher-channel.ts`:** `addUnreadConversation` from `stableRef` and all call sites.

---

### 4. Chat/Handoff UX Fixes

#### Duplicate message bug (PENDING → MANUAL transition)
When `ConversationDialog` remounts after `pending_handoff → human` transition, `lastProcessedMessageId` ref reset to `null` causing the Pusher message to be appended twice.

**Fix:** Initialize ref with current `newMessage` id:
```ts
// ConversationDialog.tsx
const lastProcessedMessageId = useRef<number | null>(newMessage?.id ?? null);
```

#### Footer hint not updating on "Ambil Alih"
`api/conversations/[id]/takeover` only fired on the org channel — customer's `ChatPage` never received it. Fixed by also firing `triggerPublicConversationEvent` on `conversation-{channelToken}` channel.

`ChatPage` now also binds `conversation:takeover` on the widget channel:
```ts
channel.bind("conversation:takeover", (payload: { handoffStatus?: string }) => {
  if (payload.handoffStatus === "human") setHandoffStatus("human");
});
```

#### Footer hint wrong on dismiss
`conversation:message` handler was always calling `setHandoffStatus("human")` for `human_agent` role — even for dismiss canned messages which have `handoffStatus: "ai"`. Fixed:
```ts
if (payload.role === "human_agent") {
  addHumanAgentMessage(payload.content);
  if (payload.handoffStatus !== "ai") { // ← guard added
    setHandoffStatus("human");
  }
}
```

#### Canned messages for takeover and return
- **Takeover** — two bubbles sent sequentially with 500ms gap:
  1. "Staff kami sudah siap membantu kamu! 😊 Silakan lanjutkan pesanmu."
  2. "Ada yang bisa dibantu kak?"
- **Return** — "KUN kembali menangani percakapan ini. Ada yang bisa aku bantu? 😊"
- **Dismiss** — already existed: "Mohon maaf, admin tidak bisa membalas pesanmu sekarang..."

All canned messages: inserted as `role: "assistant"` in DB (KUN identity preserved, renders as KUN bubble on history reload), sent via Pusher as `role: "human_agent"` (triggers `addHumanAgentMessage` in live session).

---

### 5. KUN Wrong Day Bug

**Problem:** KUN answered "Jumat" (Friday) when it was actually Tuesday. No date/time was injected into the system prompt — KUN was guessing.

**Fix:** Inject current WIB date and time into `buildSystemPrompt` in `lib/ai/rag.ts`:

```ts
const now = new Date();
const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const monthNames = ["Januari", "Februari", ...];
const currentDateTime = `${dayNames[jakartaTime.getDay()]}, ${jakartaTime.getDate()} ${monthNames[jakartaTime.getMonth()]} ${jakartaTime.getFullYear()} — ${String(jakartaTime.getHours()).padStart(2, "0")}.${String(jakartaTime.getMinutes()).padStart(2, "0")} WIB`;
```

Added to `INSTRUKSI PENTING`:
```
- Waktu dan tanggal saat ini adalah: ${currentDateTime}. Gunakan ini sebagai referensi waktu — jangan menebak hari atau jam.
```

WIB (`Asia/Jakarta`) used as default — covers most Indonesian SMEs. If owner timezone support is needed later, pass `timezone` cookie into `buildSystemPrompt`.

---

## Architecture Notes

### Pusher Event Order — Critical Rules

| Path | Pusher fires | DB writes |
|---|---|---|
| AI mode (`handleStreamComplete`) | AFTER transaction | Transaction first (Neon warm from step 8) |
| Human mode (step 7) | BEFORE DB writes | After Pusher |
| Handoff request (step 6b) | BEFORE DB writes | After Pusher |
| Takeover API | BEFORE DB writes | Transaction first (small) |
| Return API | BEFORE DB writes | Transaction first (small) |
| Dismiss API | BEFORE DB writes | Transaction first (small) |

### Query Key Map

| Key | Invalidated by | `staleTime` | `refetchInterval` |
|---|---|---|---|
| `["dashboard", orgId, "stats"]` | `handleUsageUpdated` (immediate) | 0 | — |
| `["dashboard", orgId, "charts"]` | `handleUsageUpdated` (2s debounce) | 0 | — |
| `["conversations", "recent"]` | `handleMessage`, `handleTakeover`, `handleReturn`, `handleConversationNew` | 0 | — |
| `["conversations", "pending-count"]` | `handleTakeover`, `handleReturn`, `handleDismiss`, staff actions | 60s | 60s |
| `["conversations", "human-unread"]` | `handleMessage`, `handleTakeover`, `handleReturn`, `handleStaffReplied`, row click | 0 | 60s |

### Files Changed Across These PRs

```
hooks/use-pusher-channel.ts                           — stableRef pattern, [orgId] dep only
components/providers/pusher-provider.tsx              — all invalidation, module-level chart timer
components/providers/accent-color-provider.tsx        — new, synchronous color apply + cleanup
components/providers/query-provider.tsx               — staleTime 60s, refetchOnWindowFocus false
components/dashboard/DashboardOverview.tsx            — no Pusher, reads Zustand for usage
components/dashboard/RecentConversationsPanel.tsx     — self-fetching, staleTime 0
components/dashboard/charts/BarChart.tsx              — accentColor prop + dep
components/dashboard/charts/AreaChart.tsx             — accentColor prop + dep
components/dashboard/charts/LineChart.tsx             — accentColor prop + dep
components/dashboard/charts/DonutCharts.tsx           — accentColor prop + dep
components/dashboard/Topbar.tsx                       — no async fetch, initialAccentColor prop, human-unread query
components/dashboard/badge/ConversationCountBadge.tsx — human-unread query replaces localStorage
components/dashboard/conversations/ConversationRow.tsx — hasUnread prop, optimistic cache clear
components/dashboard/conversations/ConversationDialog.tsx — lastProcessedMessageId init fix
components/dashboard/ConversationsPage.tsx            — human-unread query, passes hasUnread prop
components/chat/ChatPage.tsx                          — takeover bind, handoffStatus guard on message
stores/conversation-store.ts                          — localStorage removed, messagesUsed/accentColor added
app/api/chat/route.ts                                 — Pusher before DB in human/handoff, after in AI
app/api/conversations/[id]/takeover/route.ts          — widget channel event, canned messages (2 bubbles)
app/api/conversations/[id]/return/route.ts            — canned message, Pusher before DB
app/api/conversations/[id]/dismiss/route.ts           — unchanged (already had correct pattern)
app/(dashboard)/dashboard/layout.tsx                  — fetches accentColor, passes to providers
lib/db/queries/dashboard.ts                           — getHumanUnreadConversationIds added
lib/actions/dashboard.ts                              — getHumanUnreadConversationIdsAction + getRecentActiveConversationsAction
lib/ai/rag.ts                                         — current WIB datetime injected into system prompt
```

---

## Deferred / Known Gaps

| Item | Notes |
|---|---|
| Neon pooled connection | Already using `-pooler` URL — no action needed |
| Debug logs removed | `console.log("[getHumanUnreadConversationIds]", ...)` and `console.log("[DashboardOverview] orgId:", ...)` must be removed before next deploy |
| KUN bold formatting | Greeting uses `**KUN**` and `**${orgName}**` — hardcoded only. KUN's own replies use plain text intentionally |
| Owner timezone for KUN date | Currently hardcoded to WIB. Post-launch: pass `tz` cookie into `buildSystemPrompt` if multi-timezone support needed |