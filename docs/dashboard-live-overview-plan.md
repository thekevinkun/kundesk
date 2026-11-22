# Dashboard Live Overview Redesign — Approved Implementation Brief

> **Status:** Planning approved; implementation has not started.  
> **Scope:** Central content of `/dashboard` only. The existing Sidebar and Topbar remain unchanged.  
> **Start here:** Read this document with `docs/kundesk-project-bible.md`, `docs/kundesk-phase-handoff.md`, the full `docs/references/` directory, and the current implementation before writing code.

## 1. Product Goal

Redesign Kundesk's Dashboard Overview into a useful, real-time operations view for Indonesian SMEs. Its layout, visual language, information density, and responsive hierarchy should follow the supplied live-dashboard reference. Its content and interactions must be derived from existing Kundesk data and workflows, never from the reference's sample business, agents, messages, or metrics.

The centerpiece is a lightweight interactive **KUN Operations Board**: a friendly isometric/status visualization of KUN, the conversation queue, the human team, and knowledge. It is a product dashboard component, not a game or a simulation engine.

## 2. References and Their Intended Use

Read these files before implementation:

- `docs/references/kundesk_live_dashboard_overview.png` — primary desktop visual reference.
- `docs/references/code_kundesk_live_dashboard_overview.html` — desktop layout/style reference only; its buttons, data, people, and text are static mock content.
- `docs/references/kundesk_mobile_live_dashboard_overview.png` — primary mobile hierarchy reference.
- `docs/references/code_kundesk_mobile_live_dashboard_overview.html` — mobile layout/style reference only.
- `docs/references/DESIGN.md` — visual principles: tactile operational HUD, rounded surfaces, soft elevation, compact status chips, and responsive operational zones.

The reference palette is an inspiration, not a replacement for Kundesk's established CSS tokens, per-organization accent color, or dark mode. Continue to use the existing tokens in `app/globals.css`.

## 3. Existing System Facts to Preserve

The current overview is implemented by:

- `app/(dashboard)/dashboard/page.tsx` — authenticated server data loading and initial dashboard props.
- `components/dashboard/DashboardOverview.tsx` — client overview, TanStack Query state, stat cards, charts, conversations, and bot status.
- `components/dashboard/RecentConversationsPanel.tsx` — active conversation list, pending-handoff prioritization, relative time, and navigation into Conversations.
- `components/dashboard/BotStatusPanel.tsx` — KUN active state, documents/chunks, quota, configuration/chat links.
- `components/providers/pusher-provider.tsx` — realtime dashboard invalidation/events.
- `lib/db/queries/dashboard.ts` and `lib/actions/dashboard.ts` — tenant-scoped dashboard data and protected server actions.

Do not regress these properties:

- All database reads remain scoped to the active `orgId`; client inputs never select a tenant.
- Dashboard server actions continue to obtain the org from `requireOrg()`.
- Time-grouped data uses the owner's IANA timezone.
- Existing Pusher/TanStack Query updates remain functional.
- Existing Conversation takeover/reply/return/dismiss workflows remain the source of truth for state-changing handoff operations.
- Existing Sidebar, Topbar, role behavior, dark mode, accessibility patterns, and per-org accent color remain intact.

## 4. Real Data Mapping

| Reference concept | Kundesk source / presentation | Constraint |
| --- | --- | --- |
| Business/status header | Organization name, KUN active state, real quota, current metrics | Do not use the mock business or branch names. |
| `Pesan Hari Ini` | New timezone-aware count of customer messages today | Do not relabel the existing all-time `Total Pesan`. |
| `Auto-Bot` | Existing answered/automation rate | Retain its actual measurement window in its label or define a new explicit window. |
| `Avg Respon` | Existing average assistant response time | Preserve the current assistant-only definition. |
| Activity stream | Existing active conversations, message previews, handoff status, delivery channel, relative time | Pending handoffs stay first and visually urgent. |
| Knowledge card | Existing ready-document count and total chunks | Per-document usage, match percentage, and sync claims need dedicated data before display. |
| Quota card | Existing organization `messagesUsed` / `messagesLimit` | Preserve usage update behavior and Billing links. |
| Team station | Real team membership count and roles only | Do not claim staff are online, working, or assigned unless presence/task data exists. |
| Satisfaction / CSAT | Not available as a true customer-rating metric | Use a clearly named automation/handoff-health view if desired; do not call it CSAT. |

## 5. KUN Operations Board

### Purpose

The board provides at-a-glance operational state and fast navigation. It is not a duplicate conversation client and must not claim events or staff activity that Kundesk cannot verify.

### Visual Stations

1. **KUN station** — Uses the existing `public/images/kun_logo.png` asset. Displays actual KUN active/inactive state.
2. **Conversation queue station** — Displays actual active-conversation and pending-handoff state.
3. **Team station** — Represents the human team; it may show actual team count and roles, but not untracked online/presence status.
4. **Knowledge station** — Represents ready knowledge documents/chunks and links to Documents.

### Interaction Contract

- KUN station opens chatbot configuration/status.
- Conversation queue opens Conversations, filtered or focused on the relevant status where that filter is supported.
- Team station opens Team.
- Knowledge station opens Documents.
- The real selected-conversation summary below the board opens the existing Conversations workspace.
- The initial overview must not duplicate direct reply, KUN-send approval, or takeover UI. Those actions remain in the established conversation workflow, whose APIs already handle authorization and concurrent state transitions.

### Motion Contract

- Use Framer Motion only; all shared variants live in `lib/animations.ts`.
- Animate only changes that correspond to real state: a gentle active KUN idle treatment, a brief incoming-message transition, and an urgent pending-handoff state.
- Do not use a canvas, game engine, drag/drop mechanic, continuous particle effect, or fabricated task animation.
- Respect `prefers-reduced-motion`; static state must remain understandable.
- Provide a text alternative/status summary alongside the visual. All station actions must be keyboard accessible.

## 6. Approved PR Sequence

### PR 1 — `feat: add live overview dashboard data`

**Goal:** Establish a tenant-safe, timezone-aware live overview snapshot without a schema migration.

Expected work:

- Add only missing legitimate dashboard queries, beginning with customer messages received today and the summary counts the new overview requires.
- Seed the snapshot server-side in the dashboard page and refetch it through a protected server action.
- Extend Pusher/TanStack Query invalidation only for the new snapshot query key so the snapshot follows relevant conversation and usage events.
- Reuse existing query results where possible; do not create duplicate sources of truth.
- Add focused tests for tenant isolation, timezone day boundaries, zero states, and authorized server-action access.

**Not included:** visual redesign, board animation, database schema changes, staff presence, CSAT, or per-document retrieval telemetry.

### PR 2 — `feat: redesign dashboard overview as a live operations view`

**Goal:** Recompose the central dashboard content around the reference layout while preserving existing information and behavior.

Expected work:

- Keep Sidebar and Topbar unchanged.
- Introduce compact operational status/KPI presentation, live activity, selected conversation summary, knowledge/usage rail, and a lower performance section.
- Reuse/refactor the current stat cards, recent conversations, bot status, quota, and chart components rather than copy their data logic.
- Make activity filters and all navigational cards work with real data.
- Implement desktop and mobile hierarchy together; the mobile order is status → board location → selected conversation → activity → health/quota/performance.
- Add component and E2E coverage for key live-state navigation and responsive, non-empty/empty states.

**Not included:** the interactive operations-board animation itself.

### PR 3 — `feat: add interactive KUN operations board`

**Goal:** Add the lightweight, state-driven operations board to the redesigned overview.

Expected work:

- Use the approved KUN logo asset and the real live-overview snapshot.
- Build accessible, responsive stations and navigation actions.
- Add only the approved state-driven motion contract.
- Test reduced-motion behavior, station navigation, active/inactive state, zero queue, and pending-handoff urgency.

**Not included:** unimplemented presence/assignment tracking, real CSAT, response-confidence storage, document retrieval analytics, or a game/simulation subsystem.

## 7. Verification Required for Every PR

- Review `git status` before changes and preserve unrelated user work.
- Run the affected unit/component tests and E2E tests.
- Run `npm run typecheck` and `npm run lint` before commit.
- Review the final diff and confirm only intended files changed.
- Use a feature branch and a PR with a markdown description; do not commit or push without explicit instruction.

## 8. First New-Chat Request

Use this exact request in a new chat:

```text
Start the Dashboard Live Overview redesign. Read:
- docs/kundesk-project-bible.md
- docs/kundesk-phase-handoff.md
- docs/dashboard-live-overview-plan.md
- all docs/references files
- the current dashboard implementation

Do not write code yet. First verify the documented plan against the current implementation and give me the exact PR 1 plan, affected files, data contract, tests, and any discrepancies.
```

