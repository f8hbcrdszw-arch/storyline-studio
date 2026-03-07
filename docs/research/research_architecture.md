Now I have a thorough understanding of the plan and the broader company context. Let me provide my comprehensive architectural review.

---

# Architectural Review: Storyline Studio Web Survey Platform with Video Dial Testing

## 1. Architecture Overview

The plan proposes a Next.js 15 full-stack monolith deployed on Vercel, backed by Supabase (managed PostgreSQL), Cloudflare R2 for media, and Prisma as the ORM. The system has three main surfaces: a Study Builder (admin), a Survey Runner (respondent-facing), and a Results Dashboard (admin). It represents a ground-up rebuild of a ~2019 real-time, WebSocket-driven focus group tool into an asynchronous, self-paced survey model.

The product sits as Layer 3 ("Studio") of a four-layer product stack (Audiences, Engine, Studio, Strategy), which has significant implications for how this architecture should be designed -- it must eventually integrate with at least two adjacent systems.

---

## 2. Data Model Design

### 2.1 Study -> Question -> Response -> Answer Model

The relational spine is sound. The entity hierarchy (`Study` -> `Question` -> `Response` -> `Answer`) correctly reflects the domain. The separation of `Response` (a respondent's session) from `Answer` (a single question's data) is the right cardinality.

**Concern: `Answer` ties to `Response`, but `Response` ties to `Study`, not `Question`.** The ERD shows `Answer` -> `Question` as a direct FK, which is correct, but there is a latent integrity risk: nothing structurally prevents an `Answer` from referencing a `Question` that belongs to a different `Study` than the `Answer`'s parent `Response`. You should add either:

- A composite foreign key enforcing `(study_id, question_id)` on `Answer` via the `Response`, or
- A database-level CHECK constraint or trigger that validates this relationship, or
- At minimum, a unique constraint on `(response_id, question_id)` on the `Answer` table to prevent duplicate answers for the same question within a response.

The `(response_id, question_id)` unique constraint is the most critical missing piece -- without it, your "save per-question" persistence strategy could create duplicate Answer rows on retry or race conditions.

### 2.2 JSONB for Answer Values -- The Central Design Decision

This is the most architecturally significant decision in the plan and deserves careful analysis.

**What JSONB gets right:**

- A single `Answer` table handles 17+ question types without 17 tables or a wide sparse table.
- Schema evolution per question type does not require migrations.
- The write path is simple: one INSERT per answer regardless of type.
- For most question types (Likert, lists, write-in, numeric), the JSONB payloads are small and the primary query pattern is "get all answers for response X" -- which JSONB handles perfectly.

**Where JSONB creates real problems -- VIDEO_DIAL specifically:**

The `VIDEO_DIAL` answer shape is fundamentally different from every other type:

```json
{ "feedback": { "0": 50, "1": 62, "2": 48, ... }, "lightbulbs": [3.2, 17.8], ... }
```

For a 2-minute video, `feedback` has ~120 key-value pairs. For a 30-minute video, ~1800. This is fine for storage, but the critical query patterns for the Results Dashboard are aggregation queries:

- "Give me the average dial value at second 15 across all 500 respondents."
- "Give me the average dial value at second 15, but only for female respondents aged 25-34."
- "Give me the per-second average for segment A vs. segment B for the full video."

With JSONB, every one of these queries requires extracting keys from JSON across all rows, casting to numeric, and aggregating. A query like:

```sql
SELECT 
  key::int AS second,
  AVG((value)::numeric) AS avg_dial
FROM answers a
JOIN responses r ON a.response_id = r.id
CROSS JOIN LATERAL jsonb_each_text(a.value->'feedback') 
WHERE a.question_id = $1
  AND r.status = 'COMPLETED'
GROUP BY key::int
ORDER BY key::int;
```

This will work for small datasets but degrades significantly. For 500 respondents and a 2-minute video, you are doing `jsonb_each_text` on 500 rows and producing 60,000 intermediate rows. For 1,000 respondents and a 10-minute video, that is 600,000 intermediate rows.

**Recommendation: Introduce a dedicated `DialDataPoint` table for video dial feedback.**

```
DialDataPoint
--------------
id: uuid PK
answer_id: uuid FK -> Answer
second: int
value: int (0-100)

Index: (answer_id, second) UNIQUE
Index: question_id on Answer table (for join queries)
```

This gives you:

- Native SQL aggregation: `SELECT second, AVG(value) FROM dial_data_points dp JOIN answers a ON ... GROUP BY second` -- straightforward, indexable, fast.
- The ability to add a covering index on `(question_id, second, value)` via a join, making segmented aggregation queries extremely efficient.
- No change to the `Answer` table -- keep JSONB for lightbulbs, actions, annotations, and `slider_interacted`. Only the per-second feedback data moves out.
- Lightbulb aggregation can stay in JSONB because it is array-based (small, sparse) and typically visualized as a density/count overlay, not continuous time-series.

Alternatively, if you want to avoid the extra table, you could use a **materialized view** that pre-aggregates dial data per question/segment on a schedule, but this adds operational complexity and delays freshness.

**Keep JSONB for everything else.** For the other 16 question types, the aggregation patterns are simple (count of selected options, average of single values) and work fine with JSONB extraction on moderate row counts.

### 2.3 Missing Data Model Elements

- **No `User` or `AdminUser` table is defined.** The plan mentions Supabase Auth for admins but does not model this. If `Study.created_by` is a FK to auth users, make this explicit. This matters for the Phase 7 multi-user access control.
- **No `ExportJob` table.** The plan mentions background export processing with "notify when ready" but does not model the job queue state. You need at minimum: `id`, `study_id`, `type` (csv/video/json), `status` (pending/processing/completed/failed), `result_url`, `created_at`, `completed_at`, `error`.
- **`Question.is_screening` overlaps with `Question.phase == SCREENING`.** If screening questions can only appear in the SCREENING phase, `is_screening` is redundant. If a screening question can appear in other phases, clarify this. The plan says screening questions are also used as segmentation dimensions for results, so perhaps rename this to `is_segmentation_dimension` to clarify its purpose.

---

## 3. Next.js on Vercel -- Platform Fitness Analysis

### 3.1 What Fits Well

- **Admin SSR pages**: Server-rendered study builder and results dashboard -- this is Next.js's sweet spot.
- **API Routes**: CRUD operations for studies, questions, answers -- well-suited to serverless functions.
- **Survey Runner**: Static/client-side rendering for the respondent-facing survey -- excellent fit. The survey shell can be a client component that fetches study data once and renders progressively.
- **Edge deployment**: Vercel's edge network helps with global respondent access latency.

### 3.2 What Does Not Fit Well

**Problem 1: FFmpeg video export is incompatible with Vercel serverless.**

The plan acknowledges this in the risk table but does not resolve it architecturally. Vercel serverless functions have:
- 10-second default timeout (50s on Pro, 300s on Enterprise) for API routes
- No persistent filesystem (read-only except `/tmp`, 512MB limit)
- No FFmpeg binary available in the runtime
- Memory limits (1024MB default, 3008MB max)

FFmpeg video overlay for a multi-minute video with dial data will require:
- Downloading the source video (potentially hundreds of MB)
- Running FFmpeg (CPU-intensive, minutes of wall time)
- Uploading the result

**Recommendation**: Extract video export to a dedicated worker service. Options ranked by architectural fit:

1. **A lightweight queue + worker on a small dedicated VM or container** (e.g., a single Fly.io machine, Railway, or even a Hetzner VPS with a Node process consuming jobs from a Postgres-backed queue like `graphile-worker` or `pg-boss`). This is the simplest and most reliable path. It needs FFmpeg installed, access to R2 for source video, and write access to R2 for output.

2. **Supabase Edge Functions** -- these have the same serverless constraints (time/memory limits) as Vercel functions. They will not work for FFmpeg either.

3. **AWS Lambda with a container image containing FFmpeg** -- possible but adds AWS to your infrastructure dependencies, which the plan otherwise avoids.

The queue table (`ExportJob` mentioned above) lives in your Supabase Postgres. The worker polls it or uses Postgres LISTEN/NOTIFY.

**Problem 2: Real-time response monitoring.**

The plan calls for Supabase real-time subscriptions for live admin monitoring. This works, but note the architectural implication: the admin client subscribes directly to Supabase real-time (bypassing the Next.js API layer). This is acceptable, but document it as an intentional architectural decision -- your API routes are not the sole gateway to the database.

**Problem 3: Long-running aggregation queries for results dashboard.**

For large studies (1,000+ responses), the results dashboard will execute aggregation queries that may approach or exceed Vercel's function timeout. The plan mentions "server-side aggregation" but does not specify where.

**Recommendation**: Results aggregation should be implemented as Postgres functions/views, not in application code. Push the computation to the database. For the video dial specifically, if you adopt the `DialDataPoint` table, create a Postgres function:

```sql
CREATE FUNCTION dial_aggregation(p_question_id uuid, p_segment_filter jsonb DEFAULT NULL)
RETURNS TABLE(second int, avg_value numeric, response_count int)
```

This keeps the heavy computation in the database and returns only the aggregated result set to the API route, well within timeout limits.

### 3.3 Verdict on Next.js + Vercel

Next.js is a reasonable framework choice. Vercel is acceptable for the core application but you must plan for at least one external compute service for video export from day one. Do not treat this as a "we'll figure it out later" risk -- it is a hard constraint, not a soft one.

---

## 4. Supabase vs. Direct Postgres

### 4.1 What Supabase Adds

- **Managed Postgres**: No infrastructure management, backups, scaling handled.
- **Auth**: Admin authentication out of the box. Saves building auth from scratch.
- **Real-time subscriptions**: Used for live response monitoring. This is a genuine feature that would require significant effort to replicate (Postgres LISTEN/NOTIFY + a WebSocket server).
- **Row-Level Security (RLS)**: Mentioned in the tech stack but not elaborated in the plan. This needs clarification.

### 4.2 Concerns

**Concern: Prisma + Supabase is a double-abstraction layer.** You are using Prisma as the ORM (which manages its own connection pooling via Prisma Accelerate or PgBouncer, its own migration system, and its own query builder) and Supabase (which provides its own client library, its own connection pooler, and its own migration/schema management). This creates friction:

- Prisma migrations vs. Supabase migrations -- pick one. The plan says Prisma; that is fine, but then do not use Supabase's schema editor or SQL migrations for anything related to the application schema.
- Prisma's connection string must point to Supabase's connection pooler for serverless (PgBouncer mode), and use the direct connection for migrations. This is a common source of deployment issues.
- If you use Supabase RLS, Prisma queries bypass it by default (Prisma connects as the `postgres` service role, not as an authenticated user). You would need to use Supabase's client library for any query where RLS should apply, creating two different query paths in your codebase.

**Recommendation**: Choose a clear strategy:

- **Prisma as the primary data access layer** for all application queries. Use Prisma migrations. Do not use Supabase RLS for application-level authorization -- implement authorization in your API routes/middleware instead.
- **Supabase client library** used only for Auth and Real-time subscriptions. Not for data queries.
- Document this boundary explicitly so future developers do not blur it.

### 4.3 Verdict on Supabase

Supabase is a reasonable choice for this application. The real-time subscription feature provides genuine value for the live monitoring use case, and the managed Postgres eliminates infrastructure concerns for a small team. But the Prisma + Supabase layering must be architecturally disciplined to avoid a messy dual-client pattern.

---

## 5. Admin (SSR) vs. Survey Runner (Static/Client) Boundary

### 5.1 Assessment

This is the correct architectural boundary. The two surfaces have fundamentally different characteristics:

| Characteristic | Admin | Survey Runner |
|---|---|---|
| Users | Authenticated admins (few) | Anonymous respondents (many) |
| Data flow | Read-heavy, complex queries | Write-heavy, simple reads |
| Rendering | SSR appropriate (SEO irrelevant but data-fresh) | Client-side appropriate (interactive, stateful) |
| Performance priority | Rich functionality | Low latency, reliability |
| Caching | Per-user, short TTL | Study structure cacheable aggressively |

### 5.2 Refinements

**The survey runner should not be "static" in the Next.js sense.** The plan says "static for survey" but the survey requires:

- Fetching the study structure (questions, options, media URLs) on first load
- Generating signed media URLs (which expire)
- Creating/resuming Response records
- Submitting Answers

This is a client-rendered SPA pattern, not a statically-generated page. Use `"use client"` for the survey shell with an initial data fetch via an API route. Do not use `getStaticProps`/`generateStaticParams` -- study data changes (study can be paused/closed) and signed URLs expire.

**Recommendation**: The `/survey/[id]/page.tsx` should be a thin server component that verifies the study exists and is active, then renders a client-side `<SurveyShell>` component that manages all state. This gives you:

- Server-side validation of study status (404 or "closed" page rendered at the edge)
- Client-side state management for the survey progression
- No unnecessary re-renders or full-page navigations during the survey

### 5.3 API Route Security Boundary

The plan does not address API route authorization architecture. You need two classes of API routes:

1. **Admin routes** (`/api/studies/*`, `/api/questions/*`, `/api/export/*`): Require Supabase Auth session validation middleware.
2. **Respondent routes** (`/api/responses/*`, `/api/answers/*`): No auth, but require a valid `respondent_id` cookie + validation that the referenced study is active.

Implement this as a middleware pattern, not ad-hoc per-route checks. A file structure like:

```
/lib/middleware/requireAdmin.ts
/lib/middleware/requireRespondent.ts
```

---

## 6. Media Storage and Delivery Architecture

### 6.1 Cloudflare R2 -- Good Choice

R2's zero-egress-fee model is well-suited for video delivery. For a survey platform where the same video might be served to 500+ respondents, egress costs on S3 would be significant.

### 6.2 Concerns and Gaps

**Video preloading strategy is under-specified.** The plan says "Preload entire video before starting" but does not address:

- How large are these videos? If they are 1080p at 10 minutes, that is 500MB-1GB. Full preload is not viable on 4G connections.
- Progressive download (byte-range requests) is the correct approach. R2 supports range requests natively. The browser's `<video>` element handles this automatically if the server responds to `Range` headers correctly.
- The "no seek/pause" requirement means you need the video to buffer ahead of playback position, not necessarily fully preload.

**Recommendation**: Do not preload the entire video. Instead:

1. Serve videos from R2 with proper `Accept-Ranges` headers (R2 does this by default).
2. Set `preload="auto"` on the `<video>` element to encourage aggressive buffering.
3. Monitor `buffered` ranges via the video API. If the buffered range falls behind `currentTime`, pause the dial timer (the plan already accounts for this via `video.currentTime` tracking).
4. Consider transcoding uploaded videos to multiple bitrates (adaptive bitrate streaming via HLS/DASH) for production quality. This is a Phase 7+ optimization but should be architecturally anticipated.

**YouTube integration adds a separate delivery path.** This is a good decision for content owners who already have assets on YouTube. However, the unified `VideoPlayerAdapter` abstraction must handle a fundamental difference: YouTube videos are served from YouTube's CDN (no R2 involvement), while uploaded videos come from R2. The signed URL architecture only applies to R2 assets.

**Signed URL refresh.** With 4-hour expiry, a respondent who starts a survey, leaves, and returns 5 hours later will have expired media URLs. The survey runner must detect `403` responses on media loads and request fresh signed URLs from the API.

---

## 7. Scalability Considerations for 500+ Concurrent Respondents

### 7.1 Write Path Analysis

500 concurrent respondents progressing through a 20-question survey will generate:

- ~500 Response INSERT operations (spread over the entry period)
- ~10,000 Answer INSERT/UPDATE operations (500 respondents x 20 questions, spread over 10-15 minutes)
- For video dial questions: 500 batch inserts of ~120-entry JSONB objects

This is a modest write load for Postgres. Supabase's smallest plan handles this easily. **No scalability concern on the write path.**

### 7.2 Read Path Analysis (Survey Runner)

Each respondent needs:

- 1 study structure fetch (cacheable)
- 1 response lookup/create
- 1 signed URL generation per media asset

**Recommendation**: Cache the study structure aggressively. Use Next.js `unstable_cache` or a simple in-memory cache with a 60-second TTL on the API route that returns study data. The study structure (questions, options, phase ordering) rarely changes during active collection.

### 7.3 Read Path Analysis (Results Dashboard -- The Real Pressure Point)

If an admin is viewing live results while 500 respondents are submitting:

- Real-time subscription updates are handled by Supabase, not your API routes -- this is fine.
- Aggregation queries run against actively-written data. This can cause lock contention or slow queries.

**Recommendation**: For live monitoring, query only counts and status (fast: `SELECT status, COUNT(*) FROM responses WHERE study_id = $1 GROUP BY status`). Do not run full aggregation queries in real-time. Full aggregation should be triggered explicitly by the admin ("Refresh Results" button) or run on a 30-second polling interval.

### 7.4 Connection Pooling

Vercel serverless functions with Supabase require connection pooling. Each function invocation opens a connection. 500 concurrent respondents could mean 500 concurrent function invocations.

**Recommendation**: Ensure Prisma is configured with Supabase's PgBouncer connection pooler URL (port 6543, `?pgbouncer=true` in the connection string). The Prisma `connection_limit` should be set to 1 per serverless function instance. This is a deployment configuration detail but an architectural requirement.

---

## 8. Background Job Architecture for Video Export (FFmpeg)

### 8.1 The Core Problem

As discussed in Section 3.2, Vercel cannot run FFmpeg. The plan identifies this risk but does not resolve it. This is the single biggest architectural gap in the plan.

### 8.2 Recommended Architecture

```
Admin triggers export
        |
        v
  API Route: INSERT into ExportJob table (status: 'pending')
        |
        v
  Postgres NOTIFY on 'export_jobs' channel
        |
        v
  Worker Service (separate process, NOT on Vercel):
    - LISTEN on 'export_jobs' channel (or poll ExportJob table)
    - Download source video from R2
    - Query dial aggregation data from Postgres
    - Render overlay chart frames
    - Run FFmpeg to composite video + overlay
    - Upload result to R2
    - UPDATE ExportJob: status = 'completed', result_url = '...'
        |
        v
  Admin polls ExportJob status (or receives Supabase real-time notification)
        |
        v
  Admin downloads from R2 via signed URL
```

**Technology options for the worker**:

- **`pg-boss`** (Node.js library, Postgres-backed queue): Runs in a long-lived Node process. Install FFmpeg in the container/VM. Simple, battle-tested, no additional infrastructure beyond a process and FFmpeg.
- **BullMQ + Redis**: More powerful but adds Redis as a dependency. Unnecessary for this use case.
- **Temporal or Inngest**: Workflow orchestration engines. Overkill for a single job type, but if the AI roadmap features (automated highlight reels, AI analysis) are prioritized, a workflow engine becomes more justified.

**Recommendation**: Start with `pg-boss` on a small Fly.io machine or Railway container with FFmpeg installed. Total cost: ~$5-15/month. This handles CSV export too (which could also hit serverless timeouts for large studies).

### 8.3 CSV Export -- Do Not Assume It Fits in Serverless

For a study with 1,000 responses and 20 questions including video dial (120 columns of per-second data), the CSV could have 1,000 rows x ~200 columns. Building this requires loading all Answer records, parsing JSONB, pivoting, and serializing. This could exceed Vercel's 10-second timeout on the free plan.

**Recommendation**: Route all export operations through the same background job infrastructure, not just video export. The pattern is identical: create an `ExportJob`, process asynchronously, return a download URL.

---

## 9. Additional Architectural Concerns

### 9.1 Skip Logic Engine -- Keep It Simple, Keep It Server-Side

The plan correctly limits V1 to single-condition, forward-only skip logic. Good.

**Concern**: The plan does not specify where skip logic evaluation runs. If it runs purely client-side, a technically sophisticated respondent could bypass screening by manipulating the JavaScript state.

**Recommendation**: Screening termination must be validated server-side. When an answer is submitted, the API route should evaluate screening logic and return a `screened_out: true` response if applicable, updating the `Response.status` to `SCREENED_OUT`. Client-side skip logic for non-screening questions (which just affect navigation order) is acceptable for V1.

### 9.2 Respondent Identity and Fraud Prevention

The plan uses cookie + localStorage for respondent identity. This is the industry-standard approach for web surveys but has known weaknesses:

- Clearing cookies creates a new respondent (ballot-stuffing)
- Incognito mode bypasses duplicate prevention

The plan does not address this. For V1, this is acceptable if the platform is used with panel providers who have their own fraud prevention. But add IP-hash-based rate limiting: if the same IP hash creates more than N responses in M minutes, flag or throttle.

### 9.3 The `config: jsonb` on Question and `settings: jsonb` on Study

These are essentially schema-less extension points. This is a pragmatic choice for rapid development but creates a documentation burden: what keys are valid in `config` for each question type? What keys are valid in `settings`?

**Recommendation**: Define TypeScript types for every `config` shape and validate with Zod at the API boundary. For example:

```typescript
// In /lib/schemas/question-configs.ts
const VideoDialConfig = z.object({
  mode: z.enum(['sentiment', 'intensity']),
  actionButtons: z.array(z.object({ label: z.string(), key: z.string() })).max(4),
  showAnnotationPrompt: z.boolean(),
  annotationPrompt: z.string().optional(),
  // ...
});

const LikertConfig = z.object({
  min: z.number(),
  max: z.number(),
  minLabel: z.string(),
  maxLabel: z.string(),
});

// Discriminated union
const QuestionConfig = z.discriminatedUnion('type', [
  z.object({ type: z.literal('VIDEO_DIAL'), config: VideoDialConfig }),
  z.object({ type: z.literal('LIKERT'), config: LikertConfig }),
  // ...
]);
```

This gives you runtime validation without losing the JSONB flexibility.

### 9.4 Missing: Database Indexing Strategy

The plan defines no indexes beyond implicit primary keys and foreign keys. For the query patterns described, you need at minimum:

- `answers(question_id, response_id)` -- for aggregation queries
- `responses(study_id, status)` -- for filtered response counting
- `questions(study_id, order)` -- for ordered question retrieval
- `responses(respondent_id)` -- for session resume lookup

If you adopt the `DialDataPoint` table:
- `dial_data_points(answer_id, second)` -- UNIQUE, covers lookups
- A composite index via join to `answers.question_id` for aggregation

### 9.5 Future Integration Point: Product Stack Alignment

The plan mentions Storyline Studio is Layer 3 of 4 (Audiences -> Engine -> Studio -> Strategy). This has architectural implications:

- The data model should anticipate integration with "Storyline Engine" (AI analysis agents). This means the API should be designed as a clean, documented REST (or eventually GraphQL) boundary, not just internal Next.js API routes consumed by the Next.js frontend.
- The dial data format should be standardized as an exportable, well-documented schema -- not just "whatever JSONB shape we use internally." Other products will consume this data.
- Consider event-driven architecture from the start: when a response is completed, emit an event (even if just a Postgres trigger inserting into an `events` table). This enables future AI analysis pipelines to trigger automatically.

---

## 10. Summary of Recommendations

### Critical (Must Address Before Implementation)

| Issue | Recommendation |
|---|---|
| Video dial data in JSONB | Add a `DialDataPoint` table for per-second feedback to enable efficient aggregation queries |
| FFmpeg on Vercel | Design the background worker service from day one; do not defer this |
| Unique constraint on Answer | Add `UNIQUE(response_id, question_id)` to prevent duplicate answers |
| Screening validation | Server-side screening logic evaluation, not client-only |
| Connection pooling | Configure Prisma for Supabase PgBouncer; document the connection string requirements |

### Important (Should Address During Implementation)

| Issue | Recommendation |
|---|---|
| Prisma vs. Supabase client boundary | Use Prisma for all data queries; Supabase client only for Auth and Realtime |
| JSONB config validation | Define Zod schemas for every question type's `config` shape |
| Video preload strategy | Use progressive download with range requests, not full preload |
| Signed URL refresh | Handle expired media URLs gracefully in the survey runner |
| Database indexes | Define indexes for the primary query patterns (aggregation, lookup, ordering) |
| Export routing | Route all exports (CSV, JSON, video) through background job infrastructure |
| API authorization middleware | Create reusable middleware for admin vs. respondent route authorization |

### Advisory (Consider for Architecture Longevity)

| Issue | Recommendation |
|---|---|
| `is_screening` redundancy | Clarify whether this is redundant with `phase == SCREENING` or rename to `is_segmentation_dimension` |
| Event-driven hooks | Add a simple event system (even Postgres triggers) for response completion to enable future AI pipeline integration |
| API design for product stack | Design API routes as if they will be consumed externally; document contracts |
| `ExportJob` table | Add to data model for job queue state tracking |
| Adaptive bitrate streaming | Anticipate HLS/DASH transcoding in the architecture even if not implemented in V1 |

### What the Plan Gets Right

- The shift from synchronous WebSocket to asynchronous survey is the correct architectural decision for the stated requirements.
- Cloudflare R2 for media storage is well-chosen given the egress cost profile.
- The phased implementation plan is realistic and properly sequenced.
- The `VideoPlayerAdapter` abstraction for HTML5 vs. YouTube is a sound pattern.
- Per-question answer persistence (not batch-at-end) is the right resilience strategy.
- Video dial data tied to `video.currentTime` rather than wall clock is the correct design for data integrity.
- The study lifecycle state machine (DRAFT -> ACTIVE -> PAUSED -> CLOSED -> ARCHIVED) properly handles the editorial constraint problem.
- The plan's acknowledgment that partial video dial data is not analytically useful (and therefore acceptable to lose on abandonment) is a pragmatically correct data quality decision.