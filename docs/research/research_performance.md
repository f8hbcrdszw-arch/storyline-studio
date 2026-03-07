I have read the full plan. Let me now provide a comprehensive performance analysis covering all seven areas you identified, plus additional concerns I found in the plan.

---

# Performance Analysis: Storyline Studio Web Survey Platform

## 1. Performance Summary

The plan describes a Next.js 15 + Supabase + Prisma + Vercel serverless application with a data model centered on JSONB `value` fields in the `Answer` table. The architecture is sound for moderate scale, but there are several performance cliffs that will hit between 100 and 1,000 concurrent respondents if not addressed proactively. The most critical bottleneck is the **video dial data aggregation path**, which combines high data volume, JSONB querying overhead, and serverless cold-start latency into a compounding performance problem.

The seven areas you identified are real and require deliberate architectural decisions before implementation begins. Below is the analysis.

---

## 2. Critical Issue #1: Video Dial Data Aggregation

### The Problem

Each `VIDEO_DIAL` answer stores a JSONB object like:
```json
{ "feedback": { "0": 50, "1": 62, "2": 48, ... }, "lightbulbs": [3.2, 17.8], "actions": {...} }
```

For a 3-minute video with 1,000 respondents, the `feedback` map alone is 180 key-value pairs per row, across 1,000 rows. Aggregating the average dial value at second 45 requires PostgreSQL to parse all 1,000 JSONB blobs, extract the key `"45"`, cast it to numeric, and average it. Doing this for every second of every video for every segment is O(respondents x seconds x segments).

**Projected query cost at scale:**
- 1,000 respondents, 3 videos at 3 minutes each: ~540,000 data points
- With 4 demographic segments: the dashboard must compute ~2,160 time-series lines (540,000 x 4 segment filters)
- JSONB key extraction (`value->'feedback'->>'45'`) cannot use standard B-tree indexes efficiently

### Recommendation: Hybrid Pre-Aggregation + Normalized Storage

**Do not store per-second dial data only in JSONB.** Instead, use a dual-write strategy:

**A. Normalized `DialDataPoint` table for aggregation queries:**
```sql
CREATE TABLE dial_data_point (
    id          BIGSERIAL PRIMARY KEY,
    answer_id   UUID NOT NULL REFERENCES answer(id),
    response_id UUID NOT NULL,
    question_id UUID NOT NULL,
    second      SMALLINT NOT NULL,
    value       SMALLINT NOT NULL,
    UNIQUE(answer_id, second)
);

CREATE INDEX idx_dial_data_question_second 
    ON dial_data_point(question_id, second);

CREATE INDEX idx_dial_data_response 
    ON dial_data_point(response_id);
```

This transforms the aggregation query from JSONB parsing to:
```sql
SELECT second, AVG(value) as avg_value
FROM dial_data_point
WHERE question_id = $1
GROUP BY second
ORDER BY second;
```

With a composite index on `(question_id, second)`, this is an index-only scan. For 1,000 respondents x 180 seconds = 180,000 rows, PostgreSQL handles this in under 50ms.

**B. Segmented aggregation with a single JOIN:**
```sql
SELECT dp.second, AVG(dp.value) as avg_value
FROM dial_data_point dp
JOIN response r ON r.id = dp.response_id
JOIN answer seg ON seg.response_id = r.id AND seg.question_id = $segment_question_id
WHERE dp.question_id = $video_question_id
  AND seg.value->>'selected' = ANY($segment_values)
GROUP BY dp.second
ORDER BY dp.second;
```

**C. Pre-aggregation materialized view for the results dashboard:**
```sql
CREATE MATERIALIZED VIEW dial_aggregation AS
SELECT 
    dp.question_id,
    dp.second,
    COUNT(*) as n,
    AVG(dp.value) as mean_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dp.value) as median_value,
    STDDEV(dp.value) as std_dev
FROM dial_data_point dp
JOIN response r ON r.id = dp.response_id
WHERE r.status = 'COMPLETED'
GROUP BY dp.question_id, dp.second;
```

Refresh this materialized view either on a schedule (every 60 seconds during active collection) or on-demand when an admin opens the results page. For segmented views, compute on-the-fly against the normalized table -- the index makes it fast enough.

**D. Keep the JSONB in the `Answer.value` field too** -- it serves as the canonical record and is useful for per-respondent drill-down and CSV export where you need the full time series for one respondent.

**Performance targets:**
- Unsegmented aggregation query: < 50ms for 1,000 respondents
- Single-segment aggregation query: < 150ms for 1,000 respondents
- Materialized view refresh: < 2 seconds for 1,000 respondents x 3 videos

**Indexing strategy for JSONB fields on the `Answer` table:**

For the non-dial question types that remain in JSONB, add a GIN index:
```sql
CREATE INDEX idx_answer_value ON answer USING GIN (value);
```

This supports `@>` containment queries like `WHERE value @> '{"selected": ["option_id_1"]}'` efficiently. However, for segmentation filtering, the most common query pattern is "find responses where the answer to question X equals Y." This is better served by a partial B-tree index on the extracted value:
```sql
CREATE INDEX idx_answer_question_id ON answer(question_id, response_id);
```

This allows the segmentation JOIN to find all answers to the screening question quickly, then extract the JSONB value in the filter.

---

## 3. Critical Issue #2: Survey Runner Page Load (< 2 seconds on 4G)

### The Problem

The plan bundles the admin Study Builder (with drag-drop via `@dnd-kit`, 17 question type editors, Recharts/Chart.js, rich configuration UIs) and the Survey Runner in the same Next.js application. Without aggressive code splitting, the survey runner will load admin-only code.

### Benchmark Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| First Contentful Paint | < 1.2s on 4G | Respondent sees content immediately |
| Largest Contentful Paint | < 2.0s on 4G | Question is interactive |
| Total JS bundle (survey pages) | < 80KB gzipped | 4G at ~1.5 Mbps = ~425ms for 80KB |
| Time to Interactive | < 2.5s on 4G | Respondent can start answering |

### Recommendations

**A. Route group isolation:** Next.js 15 app directory already supports this. Structure as:
```
app/
  (admin)/           # Admin route group
    admin/
      layout.tsx     # Loads shadcn, dnd-kit, charts
  (survey)/          # Survey route group  
    survey/
      [id]/
        layout.tsx   # Minimal layout, no admin deps
```

Route groups with parentheses ensure the survey bundle never includes admin dependencies. Verify with `next build` output -- each route group should show independent chunk sizes.

**B. Dynamic imports for question type components:**
```typescript
// In SurveyShell.tsx -- only load the component for the current question type
const questionTypeComponents = {
  STANDARD_LIST: dynamic(() => import('./question-types/StandardList')),
  VIDEO_DIAL: dynamic(() => import('./question-types/VideoDial'), {
    loading: () => <VideoDialSkeleton />,
  }),
  LIKERT: dynamic(() => import('./question-types/Likert')),
  // ...
};
```

This means a respondent answering a LIKERT question never downloads the VIDEO_DIAL code until they reach that question.

**C. Eliminate heavy dependencies from the survey bundle:**
- `@dnd-kit`: Admin only (question reordering). Never imported in survey pages.
- `Recharts` / `Chart.js`: Admin only (results dashboard). Never imported in survey pages.
- `shadcn/ui`: Use only the minimal components needed in the survey (Button, Slider, RadioGroup). Tree-shake the rest.

**D. Survey data prefetch strategy:**
```typescript
// On initial survey load, fetch all questions for the study in one request
// Cache in client state -- no per-question API calls
const { questions } = await fetch(`/api/studies/${id}/survey-data`);
```

One API call returns the complete question set (without answers from other respondents). This avoids per-question network round trips.

**E. Font optimization:** Use `next/font` to self-host fonts. Eliminate any Google Fonts external requests that block rendering.

---

## 4. Critical Issue #3: Video Delivery

### The Problem

Video files of 100MB-1GB served to hundreds of concurrent respondents. The plan mentions Cloudflare R2 with CDN, which is a good start, but there are several missing considerations.

### Recommendations

**A. Adaptive bitrate streaming (HLS) -- strongly recommended:**

Do not serve raw MP4 files to respondents. Transcode uploaded videos to HLS (HTTP Live Streaming) with multiple quality tiers:
```
360p  - ~500 Kbps  (mobile on poor connection)
720p  - ~2.5 Mbps  (mobile on good connection / desktop)
1080p - ~5 Mbps    (desktop on fast connection)
```

Tools: FFmpeg transcoding triggered on upload. Store the HLS manifests (`.m3u8`) and segments (`.ts`) in R2 alongside the original.

Why this matters:
- A 1GB raw MP4 on 4G (~1.5 Mbps) takes **~90 minutes** to download. The plan says "preload entire video before starting" -- this is not viable for large files.
- HLS allows the video to start playing within 2-3 seconds while continuing to buffer.
- If the respondent's connection degrades mid-video, HLS drops to a lower quality rather than stalling -- critical because the plan requires linear playback with no pause.

**B. For YouTube videos, this is handled automatically.** The YouTube IFrame Player API delivers adaptive bitrate natively. This is a significant advantage of the YouTube option.

**C. Cloudflare CDN configuration:**

Since R2 is already on Cloudflare, use Cloudflare's CDN natively:
- Enable Cloudflare caching on video segments with a long TTL (24 hours minimum)
- Use `Cache-Control: public, max-age=86400, s-maxage=86400`
- Set up a custom domain for media delivery (e.g., `media.storylinestudio.com`) to avoid cookie overhead on video requests
- R2 has no egress fees, but Cloudflare CDN further reduces origin hits

**D. Video preloading strategy (revised from the plan):**

The plan says "buffer video fully before showing." Instead:
```typescript
// Preload the first 10 seconds when the respondent is 2 questions away
// from the video question
const preloadVideo = (videoUrl: string) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'video';
  link.href = videoUrl;
  document.head.appendChild(link);
};

// In the survey progression logic:
if (currentQuestionIndex >= videoQuestionIndex - 2) {
  preloadVideo(videoQuestion.mediaItems[0].url);
}
```

With HLS, preloading the manifest and first few segments is sufficient. The video can start within the 3-second target.

**E. Signed URL refresh:**

The plan specifies 4-hour signed URL expiry. For a long survey, the URL could expire before the respondent reaches the video. Fetch a fresh signed URL when the respondent is 1 question away from the video, not at initial survey load.

**Performance targets:**
- Video start time after clicking "Start Video": < 3 seconds on 4G
- Zero buffering stalls during playback at 720p on 4G
- Origin server hit rate: < 5% (95%+ CDN cache hit rate)

---

## 5. Critical Issue #4: Real-Time Dashboard Scaling

### The Problem

Supabase Realtime uses PostgreSQL's `LISTEN/NOTIFY` under the hood. Each subscription opens a WebSocket connection to Supabase's Realtime server. With 500+ respondents submitting answers, the `Answer` table receives a high write rate, and Supabase must broadcast notifications to all admin subscribers.

### Scalability Analysis

The bottleneck is not the WebSocket connections to admins (there are few admins), but the PostgreSQL notification volume:
- 500 respondents x 20 questions = 10,000 answer inserts over ~15 minutes
- ~11 inserts per second sustained
- Each insert triggers a `NOTIFY` that Supabase broadcasts

This is within Supabase's capabilities on Pro plan, but there are optimization opportunities.

### Recommendations

**A. Do not subscribe to individual row changes. Subscribe to aggregated events:**

Instead of subscribing to the `Answer` table directly (which fires on every answer from every respondent), create a lightweight "event" mechanism:

```typescript
// Admin dashboard subscribes to Response-level changes only
const channel = supabase
  .channel('study-responses')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'response',
    filter: `study_id=eq.${studyId}`,
  }, (payload) => {
    // Update response counts: in_progress, completed, screened_out
    updateResponseCounts(payload);
  })
  .subscribe();
```

This reduces notification volume by ~20x (one event per response status change instead of one per answer).

**B. Polling hybrid for result charts:**

For live-updating result charts, do not use Realtime subscriptions. Instead, poll every 10-15 seconds:
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const results = await fetch(`/api/studies/${id}/results/summary`);
    setResults(await results.json());
  }, 15000);
  return () => clearInterval(interval);
}, [id]);
```

This is more efficient than processing individual answer notifications and re-aggregating client-side. The server can cache the aggregation result and invalidate it on writes.

**C. Supabase plan consideration:**

On Supabase Free tier, Realtime is limited to 200 concurrent connections. On Pro, it is 500. If you need more than 500 concurrent WebSocket connections (unlikely since only admins connect, not respondents), you need to upgrade or use a different Realtime provider.

**Performance targets:**
- Response count updates: < 2 second latency from respondent submission
- Result chart refresh: < 15 second staleness (polling)
- Admin dashboard load time: < 1 second for study with 1,000 responses

---

## 6. Critical Issue #5: Results Dashboard Video Overlay Rendering

### The Problem

The "hero feature" renders a time-series chart overlaid on video playback. For a 3-minute video with 4 demographic segments, the chart must render 4 lines x 180 data points = 720 SVG path points, animated in sync with video playback.

### Scalability Analysis

This is a client-side rendering concern, not a server-side one. The key risks:
1. SVG rendering of 720+ data points per frame during video playback
2. Recharts/Chart.js re-rendering on every animation frame
3. Lightbulb density overlay adding additional markers

### Recommendations

**A. Use Canvas rendering, not SVG, for the dial chart overlay:**

Recharts renders to SVG, which becomes slow with hundreds of data points animating at 60fps. Instead, use an HTML5 Canvas overlay:

```typescript
// DialChartCanvas.tsx
const DialChartCanvas: React.FC<{
  segments: { label: string; color: string; data: number[] }[];
  currentSecond: number;
  videoDuration: number;
}> = ({ segments, currentSecond, videoDuration }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw only the visible portion
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (const segment of segments) {
      ctx.strokeStyle = segment.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const visibleEnd = Math.min(currentSecond, segment.data.length);
      for (let s = 0; s <= visibleEnd; s++) {
        const x = (s / videoDuration) * canvas.width;
        const y = canvas.height - (segment.data[s] / 100) * canvas.height;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [currentSecond, segments, videoDuration]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
};
```

Canvas rendering for 720 points per frame is trivially fast (< 1ms). SVG with Recharts re-rendering the React component tree would take 5-15ms per frame, causing jank.

**B. Decouple chart animation from React state:**

Use `requestAnimationFrame` tied to `video.currentTime`, not React state updates:
```typescript
const animate = () => {
  const second = Math.floor(videoRef.current.currentTime);
  if (second !== lastSecondRef.current) {
    lastSecondRef.current = second;
    drawChart(second); // Direct canvas draw, no setState
  }
  animationFrameRef.current = requestAnimationFrame(animate);
};
```

This avoids React re-renders during playback entirely.

**C. Pre-compute aggregated data server-side:**

Send the chart exactly the data it needs -- an array of averages per second per segment:
```json
{
  "segments": [
    { "label": "Women 25-34", "color": "#3b82f6", "data": [50, 52, 55, 48, ...] },
    { "label": "Men 45+", "color": "#ef4444", "data": [50, 49, 51, 53, ...] }
  ],
  "lightbulbs": [
    { "second": 3, "count": 42 },
    { "second": 18, "count": 87 }
  ]
}
```

Do not send raw per-respondent data to the client and aggregate there. Pre-aggregate on the server.

**D. Hover interaction:** For the "hover to see value at any second" feature, compute the tooltip data on-demand from the pre-computed arrays. Do not query the server on hover.

**Performance targets:**
- Chart render: < 2ms per frame (Canvas)
- Video + chart playback: 60fps with no dropped frames
- Initial chart data load: < 200ms from server (pre-aggregated)

---

## 7. Critical Issue #6: CSV Export for Large Studies

### The Problem

1,000 respondents x 20 questions, where video dial questions expand to one column per second. A 3-minute video = 180 columns just for one question. Total matrix could be 1,000 rows x 400+ columns. Building this in-memory on a Vercel serverless function (which has a 10-second timeout on Hobby, 60 seconds on Pro, and 1GB memory limit) is risky.

### Scalability Analysis

- Row data fetching: 1,000 responses with 20,000 answers (20 per response)
- Memory for raw JSON: ~20MB for answer JSONB data
- CSV string construction: ~10-15MB for the output file
- Total peak memory: ~50-80MB -- within Vercel's limits
- Processing time: 5-15 seconds depending on JSONB extraction complexity

The risk is not memory but **execution time on Vercel**. JSONB extraction for 20,000 rows with 1,000 of them being large video dial objects takes time.

### Recommendations

**A. Stream the CSV, do not build it in memory:**

```typescript
// app/api/export/csv/route.ts
export async function GET(request: Request) {
  const studyId = getStudyIdFromRequest(request);
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 1. Fetch questions to build header
      const questions = await prisma.question.findMany({
        where: { studyId },
        orderBy: { order: 'asc' },
        include: { mediaItems: true },
      });
      
      const header = buildCsvHeader(questions);
      controller.enqueue(encoder.encode(header + '\n'));
      
      // 2. Stream responses in batches of 100
      let cursor: string | undefined;
      while (true) {
        const responses = await prisma.response.findMany({
          where: { studyId, status: 'COMPLETED' },
          take: 100,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: { answers: true },
          orderBy: { id: 'asc' },
        });
        
        if (responses.length === 0) break;
        cursor = responses[responses.length - 1].id;
        
        for (const response of responses) {
          const row = buildCsvRow(response, questions);
          controller.enqueue(encoder.encode(row + '\n'));
        }
      }
      
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="study-${studyId}-export.csv"`,
    },
  });
}
```

Streaming in batches of 100 keeps peak memory at ~5MB regardless of study size.

**B. For the normalized `DialDataPoint` table approach, the video columns become a simple query:**
```sql
SELECT second, value 
FROM dial_data_point 
WHERE answer_id = $1 
ORDER BY second;
```

This is far faster than parsing a 180-key JSONB object per row.

**C. Background processing for very large exports:**

If studies exceed 5,000 respondents, move to background processing:
1. Admin clicks "Export CSV"
2. API creates an export job record in the database
3. A Supabase Edge Function or Vercel Cron Job processes the export
4. Writes the CSV to R2 storage
5. Notifies the admin via the dashboard (polling or Realtime subscription)
6. Admin downloads the completed file from R2

This avoids serverless timeout limits entirely.

**D. Consider the video overlay export separately:**

FFmpeg video rendering cannot run on Vercel serverless. The plan already notes this risk. Use a dedicated worker:
- Supabase Edge Functions (limited compute, may not support FFmpeg)
- A dedicated container service (Fly.io, Railway, or a small DigitalOcean droplet) running FFmpeg
- Or use a service like Mux or Transloadit for video composition

**Performance targets:**
- CSV export for 1,000 respondents: < 30 seconds
- CSV export streaming start: < 1 second (header appears immediately)
- Maximum memory usage during export: < 100MB
- Background export for 5,000+ respondents: < 5 minutes

---

## 8. Critical Issue #7: Database Connection Management

### The Problem

Prisma + Vercel serverless creates a new database connection on every cold start. With Supabase's default connection limit (direct connections) and Vercel's serverless model, you can exhaust connections quickly during traffic spikes.

### The Connection Math

- Supabase Pro plan: 60 direct connections
- Vercel serverless: can spin up 50+ concurrent function instances during a traffic spike
- Each Prisma client instance opens a connection pool (default 5 connections)
- 50 instances x 5 connections = 250 attempted connections -- far exceeding the limit

### Recommendations

**A. Use Supabase's PgBouncer (connection pooler) -- mandatory:**

Supabase provides a built-in PgBouncer pooler on port 6543. Configure Prisma to use it:

```
# .env
# Direct connection for migrations only
DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres"

# Pooled connection for application queries
DATABASE_URL_POOLED="postgresql://user:pass@db.xxx.supabase.co:6543/postgres?pgbouncer=true"
```

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL_POOLED")
  directUrl = env("DATABASE_URL")
}
```

The `directUrl` is used for migrations (which need direct connections). The pooled URL is used for all runtime queries.

**B. Set Prisma connection pool size to 1 in serverless:**

```
DATABASE_URL_POOLED="postgresql://...?pgbouncer=true&connection_limit=1"
```

Each serverless function instance only needs 1 connection. PgBouncer handles multiplexing across instances.

**C. Use Prisma's `@prisma/extension-accelerate` or connection pooling middleware:**

Prisma Accelerate provides a managed connection pool and query cache. If the latency between Vercel's edge and Supabase is significant, Accelerate can help. However, it adds another dependency and cost. Evaluate based on measured latency.

**D. Consider using Supabase's JavaScript client for simple reads:**

For the survey runner (respondent-facing), you may not need Prisma at all. The Supabase JS client uses the PostgREST API, which handles connection pooling on Supabase's side:

```typescript
// For respondent-facing queries, use Supabase client (no connection pool pressure)
const { data: questions } = await supabase
  .from('question')
  .select('*, options:question_option(*), media:media_item(*)')
  .eq('study_id', studyId)
  .order('order');

// For admin operations, use Prisma (type safety, complex queries)
const study = await prisma.study.findUnique({
  where: { id: studyId },
  include: { questions: { include: { options: true, mediaItems: true } } },
});
```

This splits the connection load: respondent traffic goes through PostgREST (unlimited, managed by Supabase), admin traffic goes through Prisma with pooled connections.

**Performance targets:**
- Database connection establishment: < 50ms (via PgBouncer)
- No connection exhaustion errors under 500 concurrent respondents
- Cold start overhead from Prisma: < 200ms

---

## 9. Additional Performance Concerns Found in the Plan

### 9A. N+1 Query Risk in Survey Data Loading

The data model has Study -> Question -> QuestionOption + MediaItem. Loading a survey requires fetching all questions with their options and media. With Prisma, ensure eager loading:

```typescript
// GOOD: Single query with includes
const surveyData = await prisma.study.findUnique({
  where: { id: studyId, status: 'ACTIVE' },
  include: {
    questions: {
      orderBy: { order: 'asc' },
      include: {
        options: { orderBy: { order: 'asc' } },
        mediaItems: true,
      },
    },
  },
});

// BAD: Loading questions then options in a loop
const questions = await prisma.question.findMany({ where: { studyId } });
for (const q of questions) {
  q.options = await prisma.questionOption.findMany({ where: { questionId: q.id } });
  // N+1 pattern: 1 query for questions + N queries for options
}
```

### 9B. Answer Persistence Write Amplification

The plan says "save each answer via API as respondent progresses." With 500 concurrent respondents each submitting answers, the `Answer` table write rate during peak is:

- 500 respondents advancing through questions at ~1 question per 30 seconds
- ~17 writes per second to the `Answer` table
- Plus the video dial batch write: 1 large INSERT per respondent per video

This is manageable for PostgreSQL, but ensure:

1. **Upsert, not insert-then-update:** If a respondent goes back and changes an answer, use `ON CONFLICT`:
```sql
INSERT INTO answer (id, response_id, question_id, value, answered_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (response_id, question_id) 
DO UPDATE SET value = EXCLUDED.value, answered_at = NOW();
```

This requires a unique constraint on `(response_id, question_id)`.

2. **Batch the dial data write:** When the video ends, the client sends one large payload. Insert the normalized `DialDataPoint` rows in a single batch:
```typescript
await prisma.dialDataPoint.createMany({
  data: Object.entries(feedback).map(([second, value]) => ({
    answerId,
    responseId,
    questionId,
    second: parseInt(second),
    value: value as number,
  })),
});
```

`createMany` generates a single INSERT with multiple value tuples, far more efficient than 180 individual inserts.

### 9C. Skip Logic Evaluation Performance

The plan describes skip logic as JSONB on each question. For a 20-question survey, the worst case is evaluating skip rules at every question transition. Ensure skip logic evaluation happens client-side after the initial data load:

```typescript
// Evaluate skip logic in the browser, not via API
function getNextQuestion(
  currentIndex: number, 
  questions: Question[], 
  answers: Map<string, AnswerValue>
): number {
  let next = currentIndex + 1;
  while (next < questions.length) {
    const q = questions[next];
    if (q.skipLogic && shouldSkip(q.skipLogic, answers)) {
      next++;
      continue;
    }
    return next;
  }
  return -1; // Survey complete
}
```

This avoids a round trip to the server on every "Next" button click.

### 9D. Signed URL Generation Overhead

Generating signed URLs for media assets involves HMAC computation. If a study has 10 media items and the signed URLs are generated on every survey page load, that is 10 HMAC operations per request. This is negligible (< 1ms per URL), but ensure URLs are cached:

```typescript
// Cache signed URLs in the survey data response
// Generate once when the respondent starts, valid for 4 hours
const mediaUrls = await generateSignedUrls(study.questions.flatMap(q => q.mediaItems));
```

### 9E. Materialized View Refresh During Active Collection

If you use materialized views for aggregation (recommended above), do not refresh them synchronously in the API response path. Use a background refresh strategy:

```sql
-- Create a function to refresh asynchronously
CREATE OR REPLACE FUNCTION refresh_dial_aggregation()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dial_aggregation;
END;
$$ LANGUAGE plpgsql;
```

`CONCURRENTLY` allows reads during refresh. Trigger this via a Supabase cron job or a Vercel Cron Route running every 60 seconds while the study is active.

---

## 10. Recommended Database Indexes (Complete List)

```sql
-- Primary query patterns and their indexes

-- Survey loading: fetch all questions for a study
CREATE INDEX idx_question_study_order ON question(study_id, "order");
CREATE INDEX idx_question_option_question ON question_option(question_id, "order");
CREATE INDEX idx_media_item_question ON media_item(question_id);

-- Response management: find/resume respondent sessions
CREATE INDEX idx_response_study_status ON response(study_id, status);
CREATE INDEX idx_response_respondent ON response(respondent_id, study_id);

-- Answer queries: find answers for a response or question
CREATE INDEX idx_answer_response ON answer(response_id, question_id);
CREATE INDEX idx_answer_question ON answer(question_id);
CREATE UNIQUE INDEX idx_answer_response_question ON answer(response_id, question_id);

-- Dial data aggregation
CREATE INDEX idx_dial_data_question_second ON dial_data_point(question_id, second);
CREATE INDEX idx_dial_data_response ON dial_data_point(response_id);

-- JSONB containment queries for segmentation
CREATE INDEX idx_answer_value ON answer USING GIN (value jsonb_path_ops);

-- Study listing for admins
CREATE INDEX idx_study_created_by ON study(created_by, status);
```

---

## 11. Prioritized Action Items

Listed in order of implementation priority (impact vs effort):

| Priority | Action | Impact | Effort | When |
|----------|--------|--------|--------|------|
| P0 | Configure PgBouncer pooled connection for Prisma | Prevents connection exhaustion crashes | Low | Phase 1 |
| P0 | Create normalized `DialDataPoint` table in schema | Enables all aggregation performance | Medium | Phase 1 |
| P0 | Route group isolation (`(admin)` vs `(survey)`) | Prevents bundle bloat on survey pages | Low | Phase 1 |
| P1 | Implement HLS transcoding pipeline for uploaded videos | Enables reliable video delivery | High | Phase 1-2 |
| P1 | Add all recommended database indexes | Prevents slow queries at scale | Low | Phase 1 |
| P1 | Use Supabase JS client for respondent-facing queries | Reduces connection pool pressure | Medium | Phase 3 |
| P1 | Single API call for full survey data load | Eliminates per-question round trips | Low | Phase 3 |
| P2 | Batch INSERT for dial data points via `createMany` | Reduces write time from ~2s to ~50ms | Low | Phase 4 |
| P2 | Canvas-based chart rendering for video overlay | Ensures 60fps playback with charts | Medium | Phase 5 |
| P2 | Pre-aggregation materialized view + refresh cron | Sub-100ms dashboard loads | Medium | Phase 5 |
| P2 | Streaming CSV export | Prevents timeout on large exports | Medium | Phase 6 |
| P3 | Polling hybrid for live dashboard (not pure Realtime) | Reduces Supabase Realtime load | Low | Phase 5 |
| P3 | Background export queue for very large studies | Handles 5,000+ respondent exports | High | Phase 6 |
| P3 | Signed URL caching and lazy refresh | Prevents expired URLs during long surveys | Low | Phase 3 |

---

## 12. Benchmarks to Establish Before Launch

Set up these measurements during development to catch regressions:

1. **Survey runner Lighthouse score:** Run on every PR merge. Target: Performance > 90, FCP < 1.2s, LCP < 2.0s on simulated 4G.

2. **API response time monitoring:** Add timing headers to all API routes. Target: p95 < 200ms for all respondent-facing endpoints.

3. **Database query logging:** Enable Prisma query logging in development. Flag any query > 100ms.

4. **Load test with k6 or Artillery:**
   - Simulate 500 concurrent respondents progressing through a 20-question survey
   - Measure: response times, error rates, database connection count, memory usage
   - Run before launch and after major changes

5. **Video playback test matrix:**
   - 720p HLS on simulated 4G: time to first frame < 3s
   - No buffering stalls on sustained 1.5 Mbps connection
   - Test on Chrome, Safari, Firefox, iOS Safari, Chrome Android

6. **CSV export benchmark:**
   - Generate synthetic data: 1,000 respondents, 20 questions, 3 video dials at 3 minutes each
   - Measure: total export time, peak memory, streaming start latency

This analysis covers the complete architecture. The most impactful decision is **normalizing dial data into a dedicated table** (item P0) -- it cascades through aggregation queries, CSV exports, segmentation, and dashboard rendering. Making this schema decision before Phase 1 implementation avoids a costly migration later.