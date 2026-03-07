---
title: "Build Storyline Studio — Web Survey Platform with Video Dial Testing"
type: feat
date: 2026-03-06
updated: 2026-03-06
status: deepened
---

# Build Storyline Studio — Web Survey Platform with Video Dial Testing

## Overview

Build a modern web-based survey platform where video dial testing is a first-class question type. Respondents access studies via a link (like Qualtrics), progress through screening → pre-ballot → video dial testing → post-ballot, and submit independently. Admins build studies, monitor responses, view segmented results, and export data. No real-time synchronization between respondents — each response is asynchronous and self-paced.

This is a ground-up build inspired by the original Luntz/Storyline Studio codebase (~2019), which was a real-time moderated focus group tool. The key architectural shift: from synchronous WebSocket-driven sessions to an asynchronous survey model.

> **Research Reference**: Detailed research outputs from the plan deepening process are available in `docs/research/`. See [Research Index](#research-index) at the bottom of this document.

## Problem Statement / Motivation

Storyline Strategies needs to bring its proprietary dial testing methodology into a modern, scalable format. The original app required pre-defined groups, real-time moderator control, and iPad hardware — limiting scale and increasing operational complexity. A web survey model removes these constraints:

- **Scale**: Hundreds of respondents can take the survey simultaneously without infrastructure coordination
- **Cost**: No moderator needed during data collection; no specialized hardware
- **Speed**: Studies can be fielded and completed in hours, not days
- **Familiarity**: Respondents experience it like any online survey (Qualtrics, SurveyMonkey)
- **Data quality**: Same per-second dial data + lightbulb annotations, but with richer demographic segmentation from screening

### Competitive Landscape

Dialsmith (Portland, OR) is the dominant player with their Perception Analyzer brand (30+ year heritage, CNN debate coverage). They offer three tiers: in-person hardware dials, PA Online (full-service, 3-day setup), and Slidermetrix (self-service subscription). Key competitors include Touchstone Research (modern platform, dynamic watermarking), Conjointly (broader survey platform), and QuestionPro TubePulse.

**Storyline Studio's differentiation opportunities** (from competitive research):
- Modern UX vs. Dialsmith's dated interface
- Instant self-service with transparent pricing vs. "contact us" sales model
- Mobile-first slider design vs. Dialsmith's desktop-first with "some restrictions" on smartphones
- AI-powered analytics (automated moment detection, highlight reels, natural language querying)
- Content security (watermarking, short-lived signed URLs) — Dialsmith has no visible content protection
- Rich question types beyond dial testing — full survey platform, not just a dial tool
- API-first architecture for integration with data pipelines

> **Full analysis**: `docs/research/research_dialsmith.md`

## Proposed Solution

A Next.js full-stack application with three main surfaces:

1. **Study Builder** (Admin) — Create studies with ordered questions across phases, upload video assets, configure screening logic, publish to generate shareable links
2. **Survey Runner** (Respondent) — Self-paced survey interface with all question types including the video dial testing experience
3. **Results Dashboard** (Admin) — Aggregated results with demographic segmentation, video playback with overlaid dial lines, and CSV/video export

### Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js 15 + TypeScript | `^15.1.4+` | Full-stack React with API routes, SSR for admin, client-rendered for survey |
| React | React 19 | `^19.0.0` | Required for App Router in Next.js 15 |
| Database | PostgreSQL via Supabase | — | Managed Postgres with auth, real-time subscriptions for live monitoring |
| ORM | Prisma | `^6.2.1+` | Type-safe queries, migrations, schema-as-code. ESM-first client |
| JSON Types | prisma-json-types-generator | — | Type-safe JSONB field access |
| Media Storage | Cloudflare R2 (S3-compatible) | — | Cost-effective video storage with no egress fees |
| Media SDK | @aws-sdk/client-s3 + s3-request-presigner | `^3.x` | R2 S3-compatible API for presigned URLs |
| Styling | Tailwind CSS + shadcn/ui | — | Rapid UI development with accessible components; themed to Storyline brand |
| Fonts | Scto Grotesk A, Items, Phonic Monospaced | — | Self-hosted via `next/font/local` from `Web Fonts/` directory (Schick Toikka) |
| Charts | Recharts | — | Time-series dial data visualization (admin only) |
| Video Player | HTML5 `<video>` + YouTube IFrame API | — | Direct browser API for precise time tracking |
| Auth | Supabase Auth via `@supabase/ssr` | `^0.5.x+` | Admin authentication; respondents are anonymous |
| Validation | Zod | — | Runtime validation for all API inputs and JSONB shapes |
| Deployment | Vercel | — | Zero-config Next.js deployment |
| Background Jobs | pg-boss on Fly.io | — | Export processing (FFmpeg, large CSV) outside Vercel serverless |

> **Important**: `@supabase/auth-helpers` is deprecated. Use `@supabase/ssr` instead.

### Prisma + Supabase Boundary (Architectural Decision)

To avoid confusion from the double-abstraction layer:

- **Prisma** = primary data access layer for ALL application queries. Use Prisma migrations. Do NOT use Supabase's schema editor for application tables.
- **Supabase client** = used ONLY for Auth and Real-time subscriptions. Not for data queries.
- **Connection strings**: Prisma `DATABASE_URL` points to Supabase PgBouncer (port 6543, `?pgbouncer=true`). `DIRECT_URL` points to direct Postgres (port 5432) for migrations only.
- **RLS**: Do NOT rely on Supabase Row-Level Security for application authorization (Prisma connects as service role, bypasses RLS). Implement authorization in API route middleware instead.

> **Full stack guide**: `docs/research/research_nextjs.md`

### Brand & Design System (from Graphic Standards v1.0, Dec 2025)

The Storyline identity was designed by FÖDA Studio (Austin, TX). All typefaces are from Schick Toikka. Web font files are in `Web Fonts/`.

#### Typography

| Role | Typeface | Weights for Web | Usage |
|------|----------|-----------------|-------|
| **Primary (body)** | Scto Grotesk A | Regular, Regular Italic, Medium, Medium Italic | All body copy, functional text, UI labels. Sentence case, tracked at 0. |
| **Secondary (display)** | Items Normal | Light, Regular | Wordmark font. Sparingly for headlines, emphasis, display applications. Sentence case, tracked at 0. |
| **Tertiary (subheads)** | Phonic Monospaced | Regular | Short subheadings only, max 5 words. UPPERCASE, tracked at ~3px (50pt in print = ~0.05em CSS). |

**Font loading strategy:**
- Use `next/font/local` to self-host all three families — no external font requests
- **Survey route group**: Load only Scto Grotesk A Regular (~20KB woff2) to minimize bundle impact
- **Admin route group**: Load Scto Grotesk A (Regular, Medium) + Items (Light) + Phonic Monospaced (Regular)
- Use `.woff2` format (Items, Phonic) with `.woff` fallback (Scto Grotesk A — only woff available)
- Set `font-display: swap` for body fonts, `font-display: optional` for display/decorative

```typescript
// app/fonts.ts — centralized font definitions
import localFont from 'next/font/local';

export const sctoGrotesk = localFont({
  src: [
    { path: '../public/fonts/SctoGroteskA-Regular.woff', weight: '400', style: 'normal' },
    { path: '../public/fonts/SctoGroteskA-RegularItalic.woff', weight: '400', style: 'italic' },
    { path: '../public/fonts/SctoGroteskA-Medium.woff', weight: '500', style: 'normal' },
    { path: '../public/fonts/SctoGroteskA-MediumItalic.woff', weight: '500', style: 'italic' },
  ],
  variable: '--font-scto',
  display: 'swap',
});

export const items = localFont({
  src: [
    { path: '../public/fonts/Items-Light.woff2', weight: '300', style: 'normal' },
    { path: '../public/fonts/Items-Regular.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-items',
  display: 'optional',
});

export const phonicMono = localFont({
  src: [{ path: '../public/fonts/Phonic-MonospacedRegular.woff2', weight: '400', style: 'normal' }],
  variable: '--font-phonic',
  display: 'optional',
});
```

#### Color Palette

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--color-cream` | Cream | `#F4F3EF` | 244/243/239 | Light backgrounds, page base |
| `--color-navy` | Navy | `#100C21` | 16/12/33 | Primary dark, text on light backgrounds |
| `--color-blue` | Storyline Blue | `#121C8A` | 18/28/138 | Primary accent, links, buttons, wordmark |

**Tailwind CSS theme extension:**

```typescript
// tailwind.config.ts (partial)
theme: {
  extend: {
    colors: {
      cream: '#F4F3EF',
      navy: '#100C21',
      'storyline-blue': '#121C8A',
    },
    fontFamily: {
      sans: ['var(--font-scto)', 'system-ui', 'sans-serif'],
      display: ['var(--font-items)', 'Georgia', 'serif'],
      mono: ['var(--font-phonic)', 'ui-monospace', 'monospace'],
    },
  },
},
```

**Note on shadcn/ui theming:** shadcn/ui uses CSS variables for theming. Map Storyline brand colors to shadcn's `--primary`, `--background`, `--foreground` variables during Phase 1 setup. The three-color palette (cream/navy/blue) maps naturally: `--background: cream`, `--foreground: navy`, `--primary: blue`.

#### Identity

- The Storyline wordmark (∴ Storyline) is a custom vector asset — use provided SVG/PNG, never recreate in CSS
- Wordmark uses Items Normal with custom kerning — do not attempt to typeset it
- Wordmark clearspace: 3x "S" width horizontal, 2x "S" width vertical
- Default: dark wordmark on light background, or light wordmark on dark background

> **Full brand guide**: `Storyline_Graphic Standards_p1.pdf`

## Technical Approach

### Data Model

```
┌─────────────────────────────────────────────────────┐
│                      Study                          │
│─────────────────────────────────────────────────────│
│ id, title, description, status (draft/active/closed)│
│ created_by, created_at, updated_at                  │
│ settings: { allow_back_navigation, show_progress,   │
│   completion_redirect_url, quota }                  │
└──────────────────────┬──────────────────────────────┘
                       │ 1:N
              ┌────────▼────────┐
              │    Question     │
              │─────────────────│
              │ id, study_id    │
              │ phase: enum     │
              │  (SCREENING,    │
              │   PRE_BALLOT,   │
              │   STIMULUS,     │
              │   POST_BALLOT)  │
              │ type: enum      │
              │ order: int      │
              │ title, prompt   │
              │ config: jsonb   │
              │ required: bool  │
              │ is_screening    │
              │ skip_logic jsonb│
              └───────┬─────────┘
                      │
         ┌────────────┼────────────┐
         │ 1:N        │            │
┌────────▼────────┐   │   ┌────────▼────────┐
│   MediaItem     │   │   │  QuestionOption  │
│─────────────────│   │   │─────────────────│
│ id, question_id │   │   │ id, question_id │
│ source (UPLOAD/ │   │   │ label, value    │
│  YOUTUBE)       │   │   │ order, image_url│
│ url, youtube_id │   │   └─────────────────┘
│ filename        │   │
│ type (video,    │   │
│  image, audio)  │   │
│ duration_secs   │   │
│ thumbnail_url   │   │
└─────────────────┘   │
                      │ 1:N
              ┌───────▼─────────┐
              │    Response     │
              │─────────────────│
              │ id, study_id    │
              │ respondent_id   │
              │ status: enum    │
              │  (IN_PROGRESS,  │
              │   SCREENED_OUT, │
              │   COMPLETED,    │
              │   ABANDONED)    │
              │ started_at      │
              │ completed_at    │
              │ metadata: jsonb │
              │  (user_agent,   │
              │   ip_hash, etc) │
              └───────┬─────────┘
                      │ 1:N
              ┌───────▼─────────┐
              │     Answer      │
              │─────────────────│
              │ id, response_id │
              │ question_id     │
              │ value: jsonb    │
              │ answered_at     │
              └───────┬─────────┘
                      │ 1:N (VIDEO_DIAL only)
              ┌───────▼─────────┐
              │  DialDataPoint  │
              │─────────────────│
              │ id, answer_id   │
              │ question_id     │
              │ response_id     │
              │ second: int     │
              │ value: int 0-100│
              └─────────────────┘
```

#### New: DialDataPoint Table (from Architecture + Performance Reviews)

Video dial per-second feedback is stored in **two places** (dual-write):

1. **`Answer.value` JSONB** — canonical record with full payload (`feedback`, `lightbulbs`, `actions`, `annotations`). Used for per-respondent drill-down and CSV export.
2. **`DialDataPoint` normalized table** — one row per second per respondent. Used for aggregation queries (avg dial value at second N, segmented by demographics).

This solves the critical performance problem: aggregating 1,000 respondents × 180 seconds of JSONB requires parsing 180,000 JSON blobs. With `DialDataPoint`, it's a simple `AVG(value) GROUP BY second` with an index-only scan (< 50ms).

```sql
-- Fast aggregation query (vs. JSONB extraction)
SELECT second, AVG(value) as avg_value
FROM dial_data_points
WHERE question_id = $1
GROUP BY second ORDER BY second;

-- Segmented aggregation with single JOIN
SELECT dp.second, AVG(dp.value) as avg_value
FROM dial_data_points dp
JOIN responses r ON r.id = dp.response_id
JOIN answers seg ON seg.response_id = r.id AND seg.question_id = $segment_question_id
WHERE dp.question_id = $video_question_id
  AND seg.value->>'selected' = ANY($segment_values)
GROUP BY dp.second ORDER BY dp.second;
```

#### New: ExportJob Table (from Architecture Review)

Background job tracking for exports that may exceed Vercel serverless timeouts:

```
ExportJob
─────────
id: uuid PK
study_id: uuid FK
type: enum (CSV, VIDEO, JSON)
status: enum (PENDING, PROCESSING, COMPLETED, FAILED)
result_url: text (R2 signed URL for download)
config: jsonb (segment filters, options)
created_by: uuid FK
created_at: timestamp
completed_at: timestamp
error: text
```

#### New: AuditLog Table (from Security Review)

```
AuditLog
────────
id: uuid PK
user_id: uuid FK
action: string (e.g., "study.publish", "export.create", "study.delete")
resource_type: string
resource_id: uuid
metadata: jsonb
created_at: timestamp
```

#### Critical Constraints (from Architecture Review)

- **`UNIQUE(response_id, question_id)` on Answer** — prevents duplicate answers on retry/race conditions
- **`UNIQUE(study_id, respondent_id)` on Response** — one response per respondent per study
- **`UNIQUE(study_id, order)` on Question** — enforces unique ordering
- **`UNIQUE(answer_id, second)` on DialDataPoint** — prevents duplicate dial data points

> **Full Prisma schema**: `docs/research/research_prisma.md` (production-ready with all indexes, types, and annotations)

#### Answer `value` shapes by question type

| Type | `value` JSON shape |
|------|-------------------|
| `VIDEO_DIAL` | `{ feedback: { "0": 50, "1": 62, ... }, lightbulbs: [3.2, 17.8], actions: { "tune_out": [5.1, 22.3], "would_buy": [14.0] }, annotations: ["text..."], slider_interacted: true }` |
| `STANDARD_LIST` / `WORD_LIST` | `{ selected: ["option_id_1", "option_id_2"] }` |
| `LIKERT` | `{ value: 7 }` |
| `MULTI_LIKERT` | `{ values: { "item_id_1": 4, "item_id_2": 8 } }` |
| `NUMERIC` | `{ value: 34 }` |
| `WRITE_IN` | `{ text: "respondent text..." }` |
| `IMAGE_AB` / `TEXT_AB` | `{ selected: "option_a", annotation: "why I chose..." }` |
| `LIST_RANKING` | `{ ranked: ["option_3", "option_1", "option_2"] }` |
| `GRID` | `{ values: { "row_1": "col_2", "row_2": "col_3" } }` |
| `COMPARISON` | `{ values: { "statement_1": "option_a", "statement_2": "option_b" } }` |
| `IMAGE_LIST` | `{ selected: ["option_id_1"] }` |
| `AD_MOCK_UP` | `{ positive: ["opt_1"], negative: ["opt_3"], pos_annotation: "...", neg_annotation: "..." }` |
| `OVERALL_REACTION` | `{ rating: 8, selected: ["opt_1"], annotation: "..." }` |
| `SELECT_FROM_SET` | `{ selected: { "set_0": "opt_1", "set_1": "opt_3" } }` |
| `MULTI_AD` | `{ selected: { "set_0": ["img_1", "img_2"] } }` |
| `CREATIVE_COPY` | `{ annotations: ["marked text sections..."] }` |

**Every answer type MUST have a Zod validation schema** enforced at the API boundary. Example:

```typescript
// lib/schemas/answer-schemas.ts
const VideoDialAnswer = z.object({
  feedback: z.record(z.coerce.number().int().min(0), z.number().int().min(0).max(100)),
  lightbulbs: z.array(z.number().min(0)).max(500),
  actions: z.record(z.string(), z.array(z.number().min(0))).optional(),
  annotations: z.array(z.string().max(5000)).max(10).optional(),
  slider_interacted: z.boolean(),
});

const LikertAnswer = z.object({
  value: z.number().int().min(0).max(100),
});

// Discriminated union validated per question type
```

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Vercel (Next.js 15)                       │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ (admin)/ *       │  │ (survey)/    │  │ /api/*            │  │
│  │ Study Builder    │  │ survey/[id]  │  │ REST API Routes   │  │
│  │ Results Dashboard│  │ Survey Runner│  │                   │  │
│  │ [SSR, heavy JS]  │  │ [client SPA] │  │ admin/* → auth MW │  │
│  │ shadcn, dnd-kit  │  │ minimal JS   │  │ survey/* → no auth│  │
│  │ Recharts         │  │ dynamic load │  │                   │  │
│  └──────────────────┘  └──────────────┘  └───────────────────┘  │
│                                                                  │
│  Route Group Isolation: survey bundle NEVER includes admin deps  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
  ┌───────▼──────┐  ┌─────▼────┐  ┌────────▼─────────┐
  │  Supabase    │  │  R2/S3   │  │  Supabase Auth   │
  │  PostgreSQL  │  │  Media   │  │  (admin only)    │
  │  [via Prisma]│  │  + CDN   │  │  [via @supa/ssr] │
  └──────────────┘  └──────────┘  └──────────────────┘
          │
  ┌───────▼──────────┐
  │  Fly.io Worker   │
  │  pg-boss + FFmpeg│
  │  Export processing│
  └──────────────────┘
```

**Key architectural boundary** (from research):
- Survey runner is a **client-rendered SPA**, not static/SSG. Study data changes (can be paused/closed) and signed URLs expire.
- `/survey/[id]/page.tsx` = thin server component that verifies study exists and is active, then renders `<SurveyShell>` client component.
- Admin and survey are in **separate Next.js route groups** `(admin)` and `(survey)` to ensure completely independent bundles.

### API Route Authorization (from Security Review)

Two middleware patterns, not ad-hoc per-route:

```
lib/middleware/
  requireAdmin.ts      → validates Supabase Auth session
  requireRespondent.ts  → validates respondent_id cookie + study is active
```

Admin routes (`/api/studies/*`, `/api/questions/*`, `/api/export/*`): require admin auth.
Respondent routes (`/api/responses/*`, `/api/answers/*`): no auth, but require valid respondent cookie + active study.

## Key Design Decisions

### Respondent Identity & Link Model

- **Shared survey link** (e.g., `storylinestudio.com/s/abc123`) — not per-respondent tokens
- Anonymous respondents identified by a server-generated `respondent_id` (UUID) stored in cookie + localStorage
- Cookie-based duplicate prevention: if the same browser returns, resume existing response rather than creating a new one
- No authentication required for respondents
- Optional: completion redirect URL with respondent ID parameter substitution (for panel provider incentive reconciliation, e.g., `?rid={respondent_id}`)
- **Cookie security attributes** (from security review): `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/survey/`
- **Optional per-respondent unique links** for high-security studies: `storylinestudio.com/s/abc123?t=unique-token` (V1 if time permits)

**Fraud prevention** (from security review):
- Browser fingerprinting via FingerprintJS as secondary deduplication signal (flag, not block)
- Server-side deduplication heuristics: flag responses from same IP hash with similar screening answers
- Surface duplicate indicators on results dashboard for admin filtering

### Video Playback Rules

- **Linear playback only** — no pause, rewind, seek, or fast-forward
- **Click-to-play overlay** before video starts (required by browser autoplay policies)
- If video buffers mid-playback, the dial timer pauses with the video — capture is tied to `video.currentTime`, not wall clock
- **Slider default**: center (50). System stores a `slider_interacted: boolean` flag in the answer
- **Lightbulb**: each tap logs a timestamp. No cooldown/debounce. Brief glow animation confirms tap

#### Per-Second Capture: `requestVideoFrameCallback` (from Video Dial Research)

**Do NOT use `timeupdate`** (4-66 Hz, unpredictable) or `setInterval` (drifts over time).

**Primary method**: `requestVideoFrameCallback` — fires at video frame rate with precise `metadata.mediaTime`.
**Fallback**: `requestAnimationFrame` polling `video.currentTime` for browsers without RVFC support.

```typescript
class VideoTimeSampler {
  constructor(videoElement, onSecondTick) {
    this.video = videoElement;
    this.onSecondTick = onSecondTick;
    this.lastRecordedSecond = -1;
  }

  start() {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      this._useRVFC();
    } else {
      this._useRAF();
    }
  }

  _useRVFC() {
    const tick = (now, metadata) => {
      const currentSecond = Math.floor(metadata.mediaTime);
      if (currentSecond !== this.lastRecordedSecond && !this.video.paused) {
        this.lastRecordedSecond = currentSecond;
        this.onSecondTick(currentSecond, metadata.mediaTime);
      }
      this._rvfcId = this.video.requestVideoFrameCallback(tick);
    };
    this._rvfcId = this.video.requestVideoFrameCallback(tick);
  }

  _useRAF() {
    const tick = () => {
      if (!this.video.paused && !this.video.ended) {
        const currentSecond = Math.floor(this.video.currentTime);
        if (currentSecond !== this.lastRecordedSecond) {
          this.lastRecordedSecond = currentSecond;
          this.onSecondTick(currentSecond, this.video.currentTime);
        }
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }
}
```

> **Full implementation guide**: `docs/research/research_videodial.md`

#### YouTube IFrame API Configuration (from YouTube Research)

```typescript
const playerVars: YT.PlayerVars = {
  controls: 0,        // Hide all player controls
  disablekb: 1,       // Disable keyboard shortcuts
  fs: 0,              // No fullscreen button
  rel: 0,             // Minimize related videos at end
  iv_load_policy: 3,  // Hide annotations/cards
  playsinline: 1,     // Inline playback on iOS (CRITICAL)
  enablejsapi: 1,     // Enable JS API control
  autoplay: 0,        // We control play via JS after user interaction
  origin: window.location.origin,
};
```

- Use `youtube-nocookie.com` domain for privacy-enhanced embedding
- Sandbox YouTube iframes: `sandbox="allow-scripts allow-same-origin allow-presentation"`
- Seek detection: monitor `onStateChange` — if seek detected via time jump, seek back
- Time polling: `player.getCurrentTime()` via `setInterval(250)` (YouTube has no time events)
- Document to admins: unlisted YouTube videos are NOT truly private. For unreleased content, direct upload to R2 is the only secure option.

> **Full YouTube API guide**: `docs/research/research_youtube.md`

### Session Persistence & Resume

- Answer data is **saved per-question** as the respondent progresses (not batched at the end)
- If a respondent closes the browser and returns (same cookie), they resume from the last unanswered question
- Video dial data exception: stored locally during playback, submitted as batch when video ends. If abandoned mid-video, that data is lost (acceptable — partial dial data is not analytically useful)
- Sessions expire after 24 hours of inactivity

### Study Lifecycle & Editing

- **States**: `DRAFT` → `ACTIVE` → `PAUSED` → `CLOSED` → `ARCHIVED`
- Draft studies are fully editable
- Active studies with 0 responses can be edited freely
- Active studies with responses: only cosmetic edits. Structural changes require duplicating to a new study
- Paused studies stop accepting new respondents but allow in-progress responses to complete
- Closed studies show a "this survey is no longer accepting responses" page

### Content Security (Updated from Security Review)

- Video and image assets served via **signed URLs with 15-30 minute expiry** (reduced from 4 hours)
- **Session-validated media proxy**: `/api/media/[questionId]` validates respondent session cookie before issuing fresh signed URL. Never embed signed URLs directly in HTML source.
- **CORS restrictions** on R2 bucket: only `storylinestudio.com` origin can fetch video assets
- No DRM or watermarking in V1 (future: per-respondent invisible watermark)
- Right-click download prevention (CSS `pointer-events` on video overlay) — a deterrent, not foolproof
- **Video preloading**: Do NOT preload entire video. Use progressive download with `Accept-Ranges` headers (R2 supports natively). Set `preload="auto"` to encourage aggressive buffering. Monitor `buffered` ranges and pause dial if buffer falls behind.

### Privacy & Consent

- Configurable consent screen before screening questions begin (includes cookie disclosure and YouTube tracking disclosure)
- Consent acceptance logged with timestamp in the Response record
- Respondent data is pseudonymous (UUID, no PII collected by default)
- IP addresses hashed with **HMAC-SHA256 using per-study salt** (not stored in plaintext)
- Data retention: configurable per study, default 12 months
- **Data deletion endpoint**: `DELETE /api/responses/:respondent_id` for GDPR compliance
- Ensure DPAs in place with Supabase, Cloudflare, and Vercel before processing EU respondent data

### Skip Logic Model (V1)

- Simple per-question rules: "If answer to Q[x] equals [value], then skip to Q[y] or terminate"
- Single condition, equality operator only, forward jumps only
- No compound conditions (AND/OR) in V1
- Circular reference prevention: skip targets must be later in the question order
- **Screening termination MUST be validated server-side** (from architecture review). When an answer is submitted, the API evaluates screening logic and returns `screened_out: true` if applicable, updating `Response.status`. Client-side skip logic for non-screening questions (navigation order) is acceptable.
- Skip logic JSONB validated against strict schema on save:
  ```json
  { "condition": { "question_id": "uuid", "operator": "equals", "value": "string" },
    "action": "skip_to | terminate", "target_question_id": "uuid | null" }
  ```
- Never use `eval()` or `new Function()` for skip logic evaluation

### Browser Back Button

- Survey uses `history.pushState` to manage navigation state
- Back button goes to previous question (if enabled in study settings)
- Returning to a completed video question shows "You've already answered this question" — does NOT replay

## Implementation Phases

### Phase 1: Foundation + Security Baseline (3-4 days)

**Goal:** Project scaffolding, data model, auth, security controls, and basic CRUD.

> **Critical change from original plan**: Security controls (input validation, CSRF, rate limiting framework, error handling) are now in Phase 1, not Phase 7. These are foundational, not polish.

- [ ] Initialize Next.js 15 project with TypeScript, Tailwind, shadcn/ui
  - Route group structure: `app/(admin)/admin/`, `app/(survey)/survey/[id]/`, `app/api/`
  - **Brand setup**: Configure `next/font/local` with Scto Grotesk A, Items, Phonic Monospaced (see Brand & Design section)
  - Copy web fonts from `Web Fonts/` to `public/fonts/` (woff2 preferred, woff fallback)
  - Tailwind theme: extend with Storyline colors (`cream`, `navy`, `storyline-blue`) and font families (`sans`, `display`, `mono`)
  - Map brand colors to shadcn/ui CSS variables (`--background`, `--foreground`, `--primary`)
  - Route groups ensure separate bundles — survey never includes admin deps
- [ ] Set up Supabase project (Postgres + Auth)
- [ ] Define Prisma schema with all models, enums, indexes, and constraints
  - Core models: `Study`, `Question`, `QuestionOption`, `MediaItem`, `Response`, `Answer`, `DialDataPoint`
  - Supporting models: `ExportJob`, `AuditLog`
  - All UNIQUE constraints (`response_id + question_id` on Answer, etc.)
  - Configure dual connection strings (PgBouncer pooled + direct for migrations)
- [ ] Run initial migrations
- [ ] Set up Supabase Auth for admin users (email/password + **MFA required**)
- [ ] Implement API middleware: `requireAdmin.ts`, `requireRespondent.ts`
- [ ] **Security baseline:**
  - Global error handler returning generic messages (never expose Prisma/Postgres errors)
  - Zod validation framework for all API request bodies
  - CSRF protection on all state-changing endpoints (double-submit cookie pattern)
  - Security headers: CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy
  - Cookie security: HttpOnly, Secure, SameSite=Lax
  - Rate limiting infrastructure (can use Vercel KV or upstash/ratelimit)
- [ ] Create admin layout with sidebar navigation
- [ ] Implement Study CRUD (create, list, edit title/description, delete draft)
- [ ] Set up R2/S3 bucket for media with presigned upload URLs
  - CORS restrictions: only application domain
  - File type validation (client-side MIME + server-side magic bytes)
  - File size limits on presigned URL policy (2GB video, 10MB images)
  - Store files with UUID names; keep original filename for display only
- [ ] Configure environment variables and deployment pipeline
- [ ] Implement session-validated media proxy endpoint (`/api/media/[questionId]`)
- [ ] Signed URL generation with 15-30 minute expiry

**Key files:**
- `prisma/schema.prisma`
- `app/fonts.ts` (centralized font definitions)
- `tailwind.config.ts` (brand colors + font families)
- `app/(admin)/admin/layout.tsx`
- `app/(admin)/admin/studies/page.tsx`
- `app/api/studies/route.ts`
- `lib/supabase/server.ts` (auth only)
- `lib/prisma.ts` (singleton client)
- `lib/storage.ts`
- `lib/middleware/requireAdmin.ts`
- `lib/middleware/requireRespondent.ts`
- `lib/schemas/` (Zod schemas)
- `public/fonts/` (self-hosted Scto Grotesk A, Items, Phonic Monospaced)

### Phase 2: Question Builder (4-5 days)

**Goal:** Admin can build a complete study with all question types, ordered across phases.

- [ ] Build question list view within study editor (drag-drop reordering via `@dnd-kit`)
- [ ] Phase tabs/sections: Screening, Pre-Ballot, Stimulus, Post-Ballot
- [ ] Question type selector (dropdown with all 17 types + icons)
- [ ] Question configuration forms per type:
  - **List types** (STANDARD_LIST, WORD_LIST, IMAGE_LIST): options editor, selection limit
  - **Likert types** (LIKERT, MULTI_LIKERT): scale range, label customization, multi-item editor
  - **Text/Write types** (WRITE_IN, CREATIVE_COPY): prompt config
  - **Comparison types** (TEXT_AB, IMAGE_AB, COMPARISON): A/B option editor with annotation prompts
  - **Complex types** (GRID, AD_MOCK_UP, OVERALL_REACTION, SELECT_FROM_SET, MULTI_AD, LIST_RANKING): specialized config UIs
  - **Video Dial** (VIDEO_DIAL): video source (upload file OR YouTube URL), prompt text, intensity vs. sentiment mode toggle, action buttons config (up to 4), multi-prompt support
  - **Numeric** (NUMERIC): min/max/step config
- [ ] **Zod config schemas per question type** — validate config JSONB on save
- [ ] Video source flow: upload file (presigned URL → R2) or paste YouTube URL
- [ ] YouTube URL validation (parse `watch?v=`, `youtu.be/`, `embed/` formats), preview thumbnail/title/duration via oEmbed
- [ ] Image upload for image-based question types
- [ ] Mark questions as screening/segmentation questions
- [ ] Skip logic builder: if answer to Q[x] equals [value], skip to Q[y] or terminate
  - Validate referential integrity on save (target exists, is later in order)
- [ ] Study preview mode (read-only walk-through)
- [ ] Study lifecycle management: Draft → Active → Paused → Closed → Archived
- [ ] Publish study → generates shareable link, sets status to `active`
- [ ] Lock structural edits on studies with existing responses

**Key files:**
- `app/(admin)/admin/studies/[id]/edit/page.tsx`
- `app/(admin)/admin/studies/[id]/edit/components/QuestionList.tsx`
- `app/(admin)/admin/studies/[id]/edit/components/QuestionEditor.tsx`
- `app/(admin)/admin/studies/[id]/edit/components/question-types/*.tsx`
- `app/(admin)/admin/studies/[id]/edit/components/VideoUploader.tsx`
- `app/api/questions/route.ts`
- `app/api/upload/route.ts`
- `lib/schemas/question-configs.ts`

### Phase 3: Survey Runner — Standard Questions (3-4 days)

**Goal:** Respondents can access a study link and complete all non-video question types.

- [ ] Configurable consent/privacy screen (includes cookie + YouTube tracking disclosure)
- [ ] Handle link edge cases: inactive → "not accepting responses", nonexistent → 404
- [ ] Public survey route: `/survey/[studyId]`
  - Thin server component verifies study active status
  - Renders client-side `<SurveyShell>` that manages all state
  - Generates anonymous `respondent_id` (UUID in HttpOnly cookie)
  - Creates `Response` record on first question load
  - Duplicate prevention: cookie check resumes existing response
- [ ] **Rate limiting on public endpoints** (from security review — NOT deferred to Phase 7):
  - 1 new response per minute per IP
  - 60 answer submissions per minute per IP
  - 5 new respondent IDs per IP per hour
  - Response velocity checks: flag suspiciously fast completions
- [ ] **Bot detection**: invisible reCAPTCHA v3 before first question
- [ ] **Single API call** to fetch all study questions on load (cache in client state)
- [ ] Session resume: returning respondent picks up from last unanswered question
- [ ] Survey shell: section-based progress bar, question counter, next/back navigation
  - One-question-at-a-time (OQAAT) pattern with smooth transitions
  - Bottom-anchored "Next" button within thumb reach
  - Estimated time remaining instead of raw question count
- [ ] Browser back button handling via `history.pushState`
- [ ] **Dynamic imports** for question type components (only load current type's code)
- [ ] Render each question type as respondent-facing component:
  - All 16 non-video types with touch-friendly targets (min 44x44 CSS px)
  - Single-column mobile layout, no horizontal scrolling
- [ ] Answer persistence: save each answer via API as respondent progresses
  - Validate answer against Zod schema for question type
  - Validate answer options against actual question configuration
- [ ] **Server-side screening logic evaluation** on answer submission
- [ ] Client-side skip logic evaluation for non-screening navigation
- [ ] Completion screen (configurable thank-you, optional redirect URL)
  - **Validate redirect URL** against allowlist of approved domains (from security review)
- [ ] Mobile-responsive layout

**Key files:**
- `app/(survey)/survey/[id]/page.tsx`
- `app/(survey)/survey/[id]/components/SurveyShell.tsx`
- `app/(survey)/survey/[id]/components/question-types/*.tsx` (dynamically imported)
- `app/api/responses/route.ts`
- `app/api/answers/route.ts`
- `lib/skip-logic.ts`
- `lib/schemas/answer-schemas.ts`

> **Survey UX best practices**: `docs/research/research_surveyux.md`

### Phase 4: Video Dial Testing Question Type (4-5 days)

**Goal:** The core differentiator — respondents watch a video while providing real-time slider feedback.

- [ ] `VideoPlayerAdapter` unified interface wrapping both HTML5 video and YouTube IFrame API:
  - `play()`, `pause()`, `getCurrentTime()`, `onStateChange`, `onBuffering`
  - HTML5: `requestVideoFrameCallback` with `requestAnimationFrame` fallback
  - YouTube: `player.getCurrentTime()` polled via `setInterval(250)`
- [ ] `Html5VideoPlayer.tsx`:
  - Custom controls overlay (no native controls)
  - `preload="auto"` with `Accept-Ranges` progressive download (NOT full preload)
  - Monitor `buffered` ranges; pause dial if buffer falls behind
  - `playsinline` attribute for iOS
- [ ] `YouTubeVideoPlayer.tsx`:
  - Use `youtube-nocookie.com` domain
  - Sandbox iframe: `allow-scripts allow-same-origin allow-presentation`
  - Seek detection via `onStateChange` — if time jump detected, seek back
  - All playerVars configured per research (controls:0, disablekb:1, fs:0, etc.)
- [ ] **Dial slider** (`DialSlider.tsx`):
  - Horizontal slider (0-100) with red→yellow→green gradient track
  - Two modes: `sentiment` (Negative ← → Positive) and `intensity` (0 → 100)
  - Tooltip showing current value above thumb
  - Starting position: center (50)
  - Track `slider_interacted` boolean
  - Touch-friendly: larger hit target for mobile/tablet (min 48px thumb)
  - Numeric labels for color-blind accessibility
- [ ] **Click-to-play overlay** before video starts
- [ ] **Per-second capture** via `VideoTimeSampler` class (RVFC → RAF fallback)
  - Tied to video time, pauses on buffer
  - Store as `Record<number, number>` in React state
- [ ] **Lightbulb button**: tap logs `video.currentTime`, glow animation confirms
- [ ] **Configurable "Take Action" buttons**: up to 4 custom buttons, each tap logs timestamped event
- [ ] **Inactivity warning**: slider untouched for 3 seconds → flash warning banner
- [ ] Video plays to completion — no seeking, no pause
- [ ] On video end: optional annotation prompt (text input)
- [ ] **Dual-write submission**: save `Answer.value` JSONB AND insert `DialDataPoint` rows
- [ ] Multi-prompt support: multiple prompt segments within one video
- [ ] Handle video loading failures (retry with exponential backoff, error message)
- [ ] Landscape-optimized layout
- [ ] **Signed URL refresh**: detect `403` on media load → request fresh URL from `/api/media/[questionId]`

**Key files:**
- `app/(survey)/survey/[id]/components/question-types/VideoDial.tsx`
- `app/(survey)/survey/[id]/components/question-types/DialSlider.tsx`
- `app/(survey)/survey/[id]/components/question-types/LightbulbButton.tsx`
- `app/(survey)/survey/[id]/components/question-types/VideoPlayerAdapter.tsx`
- `app/(survey)/survey/[id]/components/question-types/Html5VideoPlayer.tsx`
- `app/(survey)/survey/[id]/components/question-types/YouTubeVideoPlayer.tsx`
- `app/(survey)/survey/[id]/components/question-types/VideoTimeSampler.ts`

> **Full implementation guide**: `docs/research/research_videodial.md` + `docs/research/research_youtube.md`

### Phase 5: Results Dashboard (5-6 days)

**Goal:** Admin can view aggregated results with demographic segmentation and video dial playback.

- [ ] Study results overview page:
  - Response count, completion rate, screen-out rate
  - Average completion time
  - Response timeline (responses over time)
- [ ] Per-question result views:
  - **List/selection types**: bar charts, filterable by segments
  - **Likert types**: distribution histogram, mean/median, segment comparison
  - **Numeric**: distribution, mean/median/mode
  - **Write-in/annotations**: scrollable verbatim list with search/filter
  - **Ranking**: average rank per item, rank distribution
  - **Grid**: heatmap of row × column selections
  - **Comparison**: side-by-side win rates
- [ ] **Video dial results** (the hero feature):
  - Video player with overlaid time-series line chart (average dial per second)
  - **Aggregation queries use `DialDataPoint` table** (fast, indexed)
  - Multiple lines for demographic segments (color-coded)
  - Lightbulb density indicator (aggregate count per second)
  - Play video with dial line animating in real-time
  - Hover on timeline to see value at any second
  - Segment selector: filter by any screening question answer
  - Pre-ballot vs. post-ballot comparison view
- [ ] **Materialized view** for overall aggregation (refreshed on demand or every 60s during active collection):
  ```sql
  CREATE MATERIALIZED VIEW dial_aggregation AS
  SELECT question_id, second, COUNT(*) as n,
         AVG(value) as mean_value,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median_value,
         STDDEV(value) as std_dev
  FROM dial_data_points dp
  JOIN responses r ON r.id = dp.response_id
  WHERE r.status = 'COMPLETED'
  GROUP BY dp.question_id, dp.second;
  ```
- [ ] Demographic segmentation engine:
  - Any screening question can be used as a segment dimension
  - Cross-tabulation support
  - Filter responses by segment
- [ ] Real-time response monitoring (Supabase real-time subscriptions)
  - Live count of responses in progress / completed / screened out
  - **Live monitoring = counts only**. Full aggregation triggered by admin ("Refresh Results" button) or 30-second polling
  - Real-time subscriptions restricted to admin-only channels, authenticated via Supabase JWT
  - Never expose individual respondent answer data via real-time channels
- [ ] **Sanitize respondent text** (write-in, annotations) on display to prevent stored XSS

**Key files:**
- `app/(admin)/admin/studies/[id]/results/page.tsx`
- `app/(admin)/admin/studies/[id]/results/components/VideoDialResults.tsx`
- `app/(admin)/admin/studies/[id]/results/components/DialChart.tsx`
- `app/(admin)/admin/studies/[id]/results/components/SegmentSelector.tsx`
- `app/(admin)/admin/studies/[id]/results/components/QuestionResults.tsx`
- `app/(admin)/admin/studies/[id]/results/components/ResponseMonitor.tsx`
- `lib/aggregation.ts`

### Phase 6: Export + Background Worker (2-3 days)

**Goal:** Export study data via background job infrastructure.

> **All exports route through background jobs** (from architecture review). Even CSV can hit serverless timeouts for large studies.

- [ ] **Set up Fly.io worker** with pg-boss + FFmpeg installed
  - Polls `ExportJob` table (or uses Postgres LISTEN/NOTIFY)
  - Processes jobs asynchronously, updates status, writes results to R2
- [ ] **ExportJob API**: `POST /api/export` creates job, `GET /api/export/[id]` checks status
- [ ] **CSV export** (matching original app's format):
  - Rows = respondents, columns = questions
  - Video dial → one column per second + lightbulb columns
  - Include screening/demographic columns + metadata
  - **Exclude IP hashes by default** (opt-in with confirmation)
- [ ] **Video overlay export**:
  - Uploaded videos: FFmpeg composites video + dial line chart overlay
  - YouTube videos: export as interactive web player (shareable URL) — cannot burn into file (ToS)
  - Support segment-specific overlays
- [ ] **Raw JSON export**: full response data (NDJSON streaming for large studies)
- [ ] Admin polls ExportJob status (or receives Supabase real-time notification)
- [ ] **Authenticate and authorize** all export endpoints
- [ ] **Rate limit exports**: max 10 per admin per hour
- [ ] **Log all export events** in AuditLog

**Key files:**
- `app/api/export/route.ts`
- `app/api/export/[id]/route.ts`
- `worker/` (Fly.io worker service)
- `worker/jobs/csv-export.ts`
- `worker/jobs/video-export.ts`
- `worker/jobs/json-export.ts`
- `lib/csv-builder.ts`

### Phase 7: Polish & Production Readiness (3-4 days)

**Goal:** Production-quality UX, performance, and operational readiness.

- [ ] Error boundaries and error states throughout
- [ ] Loading skeletons for all data-fetching views
- [ ] Study duplication (clone an existing study)
- [ ] Study archiving (soft delete)
- [ ] Respondent quotas (close study after N completes)
- [ ] Accessibility audit (WCAG 2.1 AA)
  - Full keyboard navigation for all question types
  - Screen reader ARIA labels on custom controls
  - 4.5:1 contrast ratio for text, 3:1 for interactive elements
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge, mobile Safari, Chrome Android)
- [ ] Performance optimization:
  - Verify route group isolation (survey bundle < 80KB gzipped)
  - Lazy loading for results charts
  - Pagination for large response sets
  - `next/font` for self-hosted fonts (no external font requests)
  - Survey data caching (60-second TTL on study structure)
- [ ] Admin user management (invite team members)
- [ ] Study-level access control (OWNER, ADMIN, VIEWER roles)
- [ ] Audit logging for admin actions
- [ ] Automated data retention cleanup (scheduled job)
- [ ] `npm audit` in CI/CD pipeline
- [ ] Dependabot/Renovate for automated dependency updates

## Acceptance Criteria

### Functional Requirements

- [ ] Admin can create a study with questions across 4 phases
- [ ] Admin can add all 17 question types plus VIDEO_DIAL
- [ ] Admin can upload video files OR use YouTube URLs for dial testing
- [ ] Admin can publish a study and get a shareable link
- [ ] Respondent can access the survey link and complete it without authentication
- [ ] Respondent can answer all question types including video dial testing
- [ ] Video dial captures per-second slider values and lightbulb timestamps
- [ ] Screening questions can terminate unqualified respondents (server-side validation)
- [ ] Results dashboard shows aggregated data for all question types
- [ ] Video dial results show animated line chart overlaid on video, segmentable by demographics
- [ ] CSV export produces analysis-ready data with proper column mapping
- [ ] Multiple respondents can take the survey simultaneously without interference

### Non-Functional Requirements

- [ ] Survey page loads in < 2 seconds on 4G (survey bundle < 80KB gzipped)
- [ ] Video starts playing within 3 seconds of reaching the question
- [ ] Dial data capture has < 100ms latency (no dropped seconds)
- [ ] Supports 500+ concurrent respondents per study
- [ ] Works on desktop (Chrome, Safari, Firefox) and mobile (iOS Safari, Chrome Android)
- [ ] All API inputs validated via Zod schemas
- [ ] Rate limiting active on all public endpoints
- [ ] Security headers configured (CSP, HSTS, etc.)

### Performance Targets (from Performance Analysis)

| Metric | Target |
|--------|--------|
| Survey First Contentful Paint (4G) | < 1.2s |
| Survey Largest Contentful Paint (4G) | < 2.0s |
| Survey JS bundle (gzipped) | < 80KB |
| Unsegmented dial aggregation (1K respondents) | < 50ms |
| Single-segment dial aggregation (1K respondents) | < 150ms |
| Materialized view refresh (1K respondents × 3 videos) | < 2s |

## Dependencies & Risks

### Dependencies

- Supabase account and project setup
- Cloudflare R2 bucket for media storage (with CORS configured)
- Vercel deployment account
- Fly.io account for background worker (FFmpeg + pg-boss)
- FingerprintJS (optional, for fraud detection)

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Browser autoplay restrictions block video | High | Click-to-play overlay; detect autoplay support |
| Mobile slider UX is poor for dial testing | Medium | 48px+ touch targets; test extensively on phones |
| Video loading latency frustrates respondents | Medium | Progressive download with range requests; retry logic |
| Large studies (1000+ responses) slow down results | Medium | DialDataPoint table + materialized views for aggregation |
| FFmpeg not available on Vercel serverless | Medium — **resolved** | Fly.io worker with pg-boss job queue |
| iOS Safari video playback quirks | Medium | `playsinline` attribute; test early |
| Red-yellow-green slider inaccessible to color-blind users | Low | Numeric labels always visible |
| YouTube ToS restrictions on video manipulation | Low | Clearly separate uploaded vs. YouTube video paths |
| Signed URL leakage for pre-release content | High | 15-min TTL, session-validated proxy, CORS restrictions |
| Bot/data poisoning on public endpoints | High | Rate limiting + reCAPTCHA in Phase 3, not Phase 7 |

## Success Metrics

- Admin can build and publish a study in < 15 minutes
- Respondent completes a 20-question study (incl. 1 video) in < 12 minutes
- Dial data capture accuracy: 100% of seconds captured for > 95% of respondents
- Survey completion rate > 80% (excluding screen-outs)
- CSV export matches expected format for direct import into analysis tools

## Future Considerations

### Near-Term Platform Features

- **A/B video testing**: Randomly assign respondents to different video versions
- **Embeddable dial widget**: iFrame/embed for Qualtrics integration (Dialsmith's key partnership — match it)
- **Advanced branching logic**: Compound conditions (AND/OR)
- **Panel integration**: Direct integration with Cint, Lucid for automated recruiting
- **Dynamic watermarking**: Per-respondent invisible watermark for leak prevention
- **Adaptive bitrate streaming**: HLS transcoding (360p/720p/1080p) on upload
- **White-labeling**: Custom branding per client/study
- **Multi-language support**: Translated surveys with per-language video assets
- **Collaborative editing**: Multiple admins editing simultaneously
- **API access**: Programmatic study creation and data retrieval

### AI Roadmap — Dial Testing in the AI Era

#### Tier 1: AI-Powered Analysis (3-6 months post-launch)

- **Automated moment detection**: peaks, valleys, inflection points, segment divergences
- **Multimodal content-to-reaction correlation**: AI watches video + correlates with dial movements
- **Automated highlight reels**: top positive/negative moments as shareable video clips
- **AI-generated executive summary**: first-draft insight narrative
- **Natural language querying**: *"Show me where women 25-34 diverged from men 45+ by 15+ points"*
- **Write-in analysis**: clustering, theming, sentiment correlation

#### Tier 2: AI-Augmented Data Collection (6-12 months)

- **AI-moderated personalized follow-up**: tailored questions based on individual dial patterns
- **Real-time quality scoring**: flag flatliners, speeders, suspicious patterns
- **Attention detection**: browser focus/blur + interaction frequency correlation
- **Adaptive quotas**: AI adjusts panel recruitment in real-time

#### Tier 3: Synthetic Audiences (12-18 months)

- **Predictive dial curves**: synthetic audience models before real fielding
- **Synthetic baseline comparison**: delta between predicted and actual = key insights
- **Audience expansion**: 50 real → project 500 based on patterns
- **Always-on testing**: continuous content testing without recruiting

#### Tier 4: Platform Intelligence (18+ months)

- **Cross-study benchmarks**: percentile scoring against all platform content
- **Content pattern recognition**: what video openings/techniques score highest
- **Predictive content performance**: estimate performance from content analysis
- **Auto-generated client decks**: AI-built presentations with key moments

## References

### Original Codebase (Spec Reference)

- Exercise types and config shapes: `Luntz-WebPortal/client/src/components/logic/exerciseTypes.js`
- Results computation and segmentation: `Luntz-WebPortal/client/src/components/logic/playSessionLogic.js`
- Study builder logic: `Luntz-WebPortal/client/src/components/logic/buildSessionLogic.js`
- Video dial iOS implementation: `Luntz-iOS/Luntz-iOS-develop/Luntz-iOS/Group/VideoStimulus/VideoStimulusViewController.swift`
- Dial slider design: `Luntz-iOS/Luntz-iOS-develop/Luntz-iOS/Group/VideoStimulus/VideoFeedbackSlider.swift`
- CSV export logic: `Luntz-Backend/Luntz-Backend-dev-tunnel-2/api_export.go`

### Context

- Storyline Strategies company context: `Storyline Strategies AI Context 3046901ba17480c0a2e3e31cdc914ddf.md`
- Product vision: Storyline Studio is layer 3 of 4 in the Human × AI product stack (Audiences → Engine → **Studio** → Strategy)

### Research Index

All research files from the plan deepening process are in `docs/research/`:

| File | Contents |
|------|----------|
| `research_architecture.md` | Architecture review: data model analysis, Vercel fitness, Supabase strategy, scalability, background job design |
| `research_dialsmith.md` | Competitive analysis: Dialsmith products, pricing, features, weaknesses, differentiation opportunities |
| `research_nextjs.md` | Next.js 15 + Supabase + Prisma + R2 best practices: server/client components, auth patterns, connection pooling, server actions |
| `research_performance.md` | Performance analysis: dial data aggregation, survey page load targets, video delivery, connection pooling, indexing strategy |
| `research_prisma.md` | Production-ready Prisma schema with all models, enums, indexes, TypeScript types, and Zod validation patterns |
| `research_security.md` | Security review: 30 findings (critical to low), remediation roadmap, security requirements checklist |
| `research_specflow.md` | User flow analysis: 7 flows mapped, 30+ gaps identified, edge cases, flow permutation matrix |
| `research_surveyux.md` | Survey UX best practices: question progression, progress indicators, mobile-first design, accessibility, drag-drop builders |
| `research_videodial.md` | Video dial browser implementation: timing APIs, slider design, buffering handling, cross-browser testing, touch interaction |
| `research_youtube.md` | YouTube IFrame API: player parameters, seek prevention, time polling, mobile behavior, ToS compliance, React/TypeScript implementation |
