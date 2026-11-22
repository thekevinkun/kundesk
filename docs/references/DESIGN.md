---
name: Playful SME Operations HUD
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.5rem
  gutter-mobile: 0.75rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system caters to Indonesian micro, small, and medium enterprise (UMKM) founders, customer support team leads, and live agents supervising KUN—an autonomous customer engagement AI. The aesthetic bridges the professional rigor of enterprise SaaS with the tactile, high-engagement delight of a tactical isometric management simulation.

The experience replaces dry administrative overhead with intuitive visual feedback: agents feel like living team members, automated tasks register as interactive operations, and performance metrics provide visible progress loops. 

### Design Philosophy
- **Tactile Gamification:** Subtle soft-elevation cards, rounded pill badges, characterful avatar indicators, and interactive status chips give the dashboard a living, dynamic feel reminiscent of modern simulation interfaces.
- **Approachable Utility:** Clean, uncluttered layouts ensure critical customer messages, automation levels, and system health can be parsed in seconds by non-technical shop owners.
- **Warm Contemporary Tone:** Cool refreshing mint teals provide trust and focus, accented by welcoming status tones (amber, coral, active emerald) against comfortable cream-tinted slate backdrops.

## Colors

The palette establishes an energetic yet dependable workspace. The signature mint/teal spectrum anchors trust and digital competence, balanced by an ambient canvas of warm off-white tones that reduce screen fatigue during long support shifts.

### Palette Architecture
- **Primary Teal (`#0D9488` / `#14B8A6`):** Drives prominent interactive triggers, key metrics, active tab highlights, and primary brand indicators.
- **Tinted Canvas Surface (`#F8FAFC` to `#F0FDFA`):** Soft foundational background with subtle oceanic warmth rather than stark hospital whites.
- **Gamified Status Palette:**
  - *Active / Ready:* Emerald (`#10B981`) indicates online state, auto-pilot resolution, and positive customer ratings.
  - *Pending / Processing:* Amber (`#F59E0B`) highlights incoming handoffs, human intervention queues, and threshold alerts.
  - *Urgent / Coral:* Carmine (`#EF4444`) signals dropped queries, manual failovers, or quota limits.
  - *Gamified Special:* Lavender Violet (`#6366F1`) and Sky Blue (`#0EA5E9`) serve role-based tags and specialty agent avatars.
- **Neutral Hierarchy:** Slate `#0F172A` delivers high-contrast legibility for headings, paired with `#64748B` for secondary labels, timestamps, and metadata.

## Typography

Typography uses **Plus Jakarta Sans** across all roles to achieve geometric clarity, warm open counters, and high readability in dense data arrangements.

### Rules & Hierarchy
- **Metric Emphasis:** Primary numbers and KPI cards combine `headline-xl` or `headline-lg` with tight negative letter tracking (`-0.02em`) to echo game HUD counters.
- **Conversational Lists:** Customer and agent chat previews utilize `body-md` in regular weight, juxtaposed against `label-sm` monoline badge indicators for agent IDs and response clocks.
- **Section Headers:** Card titles combine `headline-sm` with muted subtext in `body-sm` to maintain a distinct spatial boundary between interactive segments.

## Layout & Spacing

The layout is built upon a flexible 12-column grid structure engineered for multi-panel desktop workspaces, collapsing systematically for mobile and tablet handoffs.

### Layout Principles
- **Shell Structure:** Persistent navigation sidebar (width: 240px desktop, condensed to 64px icon rail on small screens), anchored with a top HUD system bar (height: 64px) housing live global clocks, profile status, and quick-action toggles.
- **Operational Zones:**
  - *Hero Metric Strip:* 4-column balanced card deck spanning the top section.
  - *Main Canvas:* 8-column primary stage for operational charts, live isometric simulation viewport, and agent activity feeds.
  - *Action Stream:* 4-column right-hand panel dedicated to the incoming queue, handoffs, and direct manual chat intervention.
- **Rhythm & Padding:** Component interiors standardize on `space-md` (`1rem`) to `space-lg` (`1.5rem`) padding, ensuring that information density never compromises tap target security or visual composure.

## Elevation & Depth

Visual hierarchy uses a refined tactile approach: soft, tinted ambient game-card elevation combined with translucent glass borders. Avoid flat monochrome lines or harsh drop shadows.

### Depth Layers
- **Level 0 (Canvas Base):** Deep ambient tint `#F8FAFC`, non-elevated.
- **Level 1 (Operational Cards & Modules):** Pure white `#FFFFFF` surface resting over the canvas. Shadow: `0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.02)`. Border: 1px solid `#F1F5F9`.
- **Level 2 (Hoverable Game Tiles & Active HUD Elements):** Raised actionable modules. Shadow: `0 10px 25px -4px rgba(13, 148, 136, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)`.
- **Level 3 (Modals, Isometric Tooltips & Overlays):** Interactive floating inspector dialogues. Shadow: `0 20px 30px -8px rgba(15, 23, 42, 0.12), 0 8px 10px -4px rgba(15, 23, 42, 0.04)`.

## Shapes

The interface embraces friendly, rounded corner radii that reflect the approachable charm of gaming interfaces while maintaining structured UI alignment.

### Corner Radii Distribution
- **Cards and Panels (`rounded-xl`):** `1.25rem` (20px) to give outer containers a distinct, buoyant, tactile identity.
- **Buttons and Inputs (`rounded-lg`):** `0.75rem` to `1rem` (12px–16px) for comfortable touch ergonomics.
- **Badges, Chips, and Indicators (`rounded-full`):** Full 9999px pill radii to deliver distinct gamified status signals.
- **Isometric Mini-Avatars & Icon Mats:** Smooth squircle geometry (`0.75rem` border radius) backing core metrics and agent heads.

## Components

### Buttons
- **Primary Action:** Solid `#0D9488` background, white label, full pill or rounded-xl shape, with a subtle top highlight reflection and an active tactile depression on press (`transform: translateY(1px)`).
- **Secondary / HUD Button:** Pure white surface with `#E2E8F0` border, muted text `#0F172A`, teal hover state with a soft mint background wash (`#F0FDFA`).
- **Icon Actions:** 40x40px rounded-lg squares with soft background fills (`#F1F5F9`), transitioning to primary teal on hover.

### Badges & Status Chips
- **HUD Pill Chips:** Micro containers with a 6px pulsating status dot.
  - *Active KUN:* Mint green tint `#DCFCE7`, text `#15803D`.
  - *Manual Escalation:* Soft amber tint `#FEF3C7`, text `#B45309`.
  - *Offline / System Warning:* Coral tint `#FEE2E2`, text `#B91C1C`.
- **Level & Counter Badges:** High-contrast pill badges positioned on the upper-right corners of navigation items and list cells.

### Cards & Metrics
- **HUD Metric Deck:** Features a rounded squircle icon container with a pastel gradient background (e.g., mint-to-teal, soft amber-to-orange), a bold numerical reading in `headline-lg`, and a companion pill chip at the footer showing trend deltas (`+14% vs minggu lalu`).
- **Activity Stream Item:** Soft list card featuring a subtle 1px border, avatar tag, real-time message snippet, and an inline action button allowing human team takeover.

### Input Fields & Controls
- **Search HUD:** Pill-shaped search bar `#F1F5F9` background, inset search icon, clear typography placeholder (`Cari percakapan, dokumen...`), transitioning to a crisp teal border ring (`#14B8A6`) on focus.
- **Toggle Switches:** Gamified capsule track with smooth ball transition, shifting from soft gray `#E2E8F0` to active mint `#0D9488`.

### Specialized Simulation Modules
- **Agent Roster Card:** Displays the isometric agent avatar, role chip (e.g., `Analyst`, `Developer`, `Orkestrator`), live work status badge, and immediate task narrative in `body-sm`.
- **Progress Gauge:** Smooth progress tracks with rounded end-caps and dual-tone gradient fills highlighting AI token usage, quota consumption, and weekly automated resolution rates.