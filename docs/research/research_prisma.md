Now I have all the research needed. Let me compile the comprehensive answer.

---

# Prisma Schema Design for Storyline Studio Survey Platform

## 1. Complete Production-Ready `schema.prisma`

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Storyline Studio — Prisma Schema
// PostgreSQL via Supabase | PgBouncer connection pooling
// ─────────────────────────────────────────────────────────────────────────────

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}

generator json {
  provider = "prisma-json-types-generator"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Supabase pooled connection (port 6543, ?pgbouncer=true)
  directUrl = env("DIRECT_URL")         // Supabase direct connection (port 5432, for migrations)
}

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

enum StudyStatus {
  DRAFT
  ACTIVE
  PAUSED
  CLOSED
  ARCHIVED
}

enum QuestionPhase {
  SCREENING
  PRE_BALLOT
  STIMULUS
  POST_BALLOT
}

enum QuestionType {
  VIDEO_DIAL
  STANDARD_LIST
  WORD_LIST
  IMAGE_LIST
  LIKERT
  MULTI_LIKERT
  NUMERIC
  WRITE_IN
  TEXT_AB
  IMAGE_AB
  LIST_RANKING
  GRID
  COMPARISON
  AD_MOCK_UP
  OVERALL_REACTION
  SELECT_FROM_SET
  MULTI_AD
  CREATIVE_COPY
}

enum ResponseStatus {
  IN_PROGRESS
  SCREENED_OUT
  COMPLETED
  ABANDONED
}

enum MediaSource {
  UPLOAD
  YOUTUBE
}

enum MediaType {
  VIDEO
  IMAGE
  AUDIO
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────────────────────────────────────

model Study {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title       String      @db.VarChar(255)
  description String?     @db.Text
  status      StudyStatus @default(DRAFT)

  /// [StudySettings]
  settings    Json        @default("{}")    @db.JsonB

  createdBy   String      @map("created_by") @db.Uuid
  createdAt   DateTime    @default(now())    @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime    @updatedAt         @map("updated_at") @db.Timestamptz(3)

  // Relations
  questions   Question[]
  responses   Response[]

  // Indexes
  @@index([status])
  @@index([createdBy])
  @@index([createdAt])

  @@map("studies")
}

model Question {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  studyId     String        @map("study_id") @db.Uuid
  phase       QuestionPhase
  type        QuestionType
  order       Int           @db.SmallInt
  title       String        @db.VarChar(500)
  prompt      String?       @db.Text

  /// [QuestionConfig]
  config      Json          @default("{}") @db.JsonB

  required    Boolean       @default(true)
  isScreening Boolean       @default(false) @map("is_screening")

  /// [SkipLogic]
  skipLogic   Json?         @map("skip_logic") @db.JsonB

  // Relations
  study       Study         @relation(fields: [studyId], references: [id], onDelete: Cascade)
  options     QuestionOption[]
  mediaItems  MediaItem[]
  answers     Answer[]

  // Indexes
  @@unique([studyId, order])                              // Enforce unique ordering within a study
  @@index([studyId, phase, order])                        // Fetch questions by study and phase, ordered
  @@index([studyId, isScreening])                         // Quick lookup of screening questions
  @@index([type])                                         // Filter by question type

  @@map("questions")
}

model QuestionOption {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  questionId  String   @map("question_id") @db.Uuid
  label       String   @db.VarChar(500)
  value       String   @db.VarChar(255)
  order       Int      @db.SmallInt
  imageUrl    String?  @map("image_url") @db.Text

  // Relations
  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  // Indexes
  @@unique([questionId, order])                           // Enforce unique option ordering
  @@index([questionId])                                   // Fetch all options for a question

  @@map("question_options")
}

model MediaItem {
  id            String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  questionId    String      @map("question_id") @db.Uuid
  source        MediaSource
  url           String?     @db.Text
  youtubeId     String?     @map("youtube_id") @db.VarChar(20)
  filename      String?     @db.VarChar(255)
  type          MediaType
  durationSecs  Int?        @map("duration_secs")
  thumbnailUrl  String?     @map("thumbnail_url") @db.Text

  // Relations
  question      Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([questionId])

  @@map("media_items")
}

model Response {
  id            String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  studyId       String         @map("study_id") @db.Uuid
  respondentId  String         @map("respondent_id") @db.Uuid
  status        ResponseStatus @default(IN_PROGRESS)
  startedAt     DateTime       @default(now()) @map("started_at") @db.Timestamptz(3)
  completedAt   DateTime?      @map("completed_at") @db.Timestamptz(3)

  /// [ResponseMetadata]
  metadata      Json           @default("{}") @db.JsonB

  // Relations
  study         Study          @relation(fields: [studyId], references: [id], onDelete: Cascade)
  answers       Answer[]

  // Indexes
  @@unique([studyId, respondentId])                       // One response per respondent per study
  @@index([studyId, status])                              // Filter responses by study + status
  @@index([studyId, completedAt])                         // Time-range queries on completions
  @@index([respondentId])                                 // Resume by respondent cookie
  @@index([status])                                       // Global status filtering
  @@index([startedAt])                                    // Timeline queries

  @@map("responses")
}

model Answer {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  responseId  String   @map("response_id") @db.Uuid
  questionId  String   @map("question_id") @db.Uuid

  /// [AnswerValue]
  value       Json     @db.JsonB

  answeredAt  DateTime @default(now()) @map("answered_at") @db.Timestamptz(3)

  // Relations
  response    Response @relation(fields: [responseId], references: [id], onDelete: Cascade)
  question    Question @relation(fields: [questionId], references: [id], onDelete: Restrict)

  // Indexes
  @@unique([responseId, questionId])                      // One answer per question per response
  @@index([responseId])                                   // All answers for a response
  @@index([questionId])                                   // All answers for a question (aggregation)
  @@index([questionId, answeredAt])                       // Time-ordered answers per question
  @@index([value], type: Gin)                             // GIN index for JSONB containment queries

  @@map("answers")
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAL TIME-SERIES TABLE (separate from Answer JSONB)
// ─────────────────────────────────────────────────────────────────────────────
// See Question 2 analysis below. This table stores per-second dial values
// in a normalized, query-optimized format for aggregation queries.

model DialDataPoint {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  answerId    String   @map("answer_id") @db.Uuid
  questionId  String   @map("question_id") @db.Uuid
  responseId  String   @map("response_id") @db.Uuid
  second      Int      @db.SmallInt                        // 0, 1, 2, ... up to video duration
  value       Int      @db.SmallInt                        // 0-100 dial value

  // Indexes — optimized for aggregation queries
  @@unique([answerId, second])                             // One value per second per answer
  @@index([questionId, second])                            // Aggregate by question at a given second
  @@index([questionId, responseId])                        // All data points for one respondent on one question

  @@map("dial_data_points")
}

model DialEvent {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  answerId    String   @map("answer_id") @db.Uuid
  questionId  String   @map("question_id") @db.Uuid
  responseId  String   @map("response_id") @db.Uuid
  eventType   String   @map("event_type") @db.VarChar(50)  // 'lightbulb', 'tune_out', 'would_buy', etc.
  timestamp   Decimal  @db.Decimal(8, 2)                   // Video timestamp in seconds (e.g., 14.25)

  // Indexes
  @@index([questionId, eventType])                         // Aggregate events by type per question
  @@index([answerId])                                      // All events for one answer
  @@index([questionId, timestamp])                         // Time-range queries on events

  @@map("dial_events")
}
```

---

## 2. Video Dial Data: JSONB vs. Separate TimeSeries Table

**Recommendation: Use BOTH -- a hybrid approach.**

### Why not JSONB alone?

A typical VIDEO_DIAL answer contains ~180 key-value pairs (one per second for a 3-minute video). Storing this as JSONB `{ "0": 50, "1": 62, "2": 48, ... }` inside the `Answer.value` field works for **write and read-single-response** operations but fails for the critical aggregation use case.

The research reveals several JSONB performance pitfalls:

- **No column statistics**: PostgreSQL cannot maintain statistics on values inside JSONB columns, which can result in [query plans that are up to 2000x slower](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) than equivalent structured queries.
- **TOAST overhead**: JSONB values exceeding ~2KB trigger [PostgreSQL TOAST compression](https://pganalyze.com/blog/5mins-postgres-jsonb-toast). A 180-entry dial object is ~1.5-2KB, right at the boundary. Aggregating across 500 respondents means decompressing 500 TOAST'd values.
- **Aggregation cost**: To compute "average dial value at second 15 for women 25-34," the database must deserialize every matching JSONB document, extract the key, and aggregate. With a normalized table, this is a simple `AVG(value) WHERE second = 15` with an index scan.

### The hybrid design

| Operation | Storage Used | Rationale |
|-----------|-------------|-----------|
| **Survey submission** | `Answer.value` (JSONB) | Single atomic write of the full dial payload; simple, fast |
| **Single-response playback** | `Answer.value` (JSONB) | Read one document, render the line; fast enough |
| **Aggregation / segmentation** | `DialDataPoint` table | `GROUP BY second` with proper indexes; PostgreSQL can use statistics |
| **Event aggregation** (lightbulbs, actions) | `DialEvent` table | Count/density queries with index support |
| **CSV export** | `DialDataPoint` table | Pivot query is straightforward with normalized rows |

### Write path

When a respondent finishes a VIDEO_DIAL question:

1. Write the full answer payload to `Answer.value` as JSONB (single insert, atomic).
2. Fan out dial data to `DialDataPoint` rows asynchronously (background job or database trigger).

This way the respondent-facing path stays fast (one JSONB insert), and the admin-facing aggregation path gets proper relational storage.

### Storage estimate

For a study with 500 respondents and a 180-second video:
- `DialDataPoint`: 500 x 180 = 90,000 rows, at ~40 bytes/row = ~3.6 MB. Trivial for PostgreSQL.
- `DialEvent`: Assume ~5 lightbulb taps per respondent = 2,500 rows. Negligible.

---

## 3. Index Strategy for Common Queries

### Query: "Get all answers for a study"

```sql
-- The query path: Study -> Response -> Answer
SELECT a.* FROM answers a
  JOIN responses r ON r.id = a.response_id
  WHERE r.study_id = $1;
```

**Indexes used:**
- `@@index([studyId, status])` on `Response` -- filters responses by study
- `@@index([responseId])` on `Answer` -- fetches answers per response

Alternative (denormalized): If this query is extremely hot, consider adding `studyId` directly to the `Answer` model to avoid the join. The schema above does NOT include this because the join is cheap with proper indexes on UUID foreign keys.

### Query: "Aggregate dial data by segment"

```sql
-- Average dial value at each second, segmented by a screening answer
SELECT dp.second, AVG(dp.value), screening_answer.value->>'selected' AS segment
FROM dial_data_points dp
  JOIN answers screening_answer ON screening_answer.response_id = dp.response_id
    AND screening_answer.question_id = $screening_question_id
  WHERE dp.question_id = $dial_question_id
  GROUP BY dp.second, segment
  ORDER BY dp.second;
```

**Indexes used:**
- `@@index([questionId, second])` on `DialDataPoint` -- the primary aggregation index
- `@@unique([responseId, questionId])` on `Answer` -- fast lookup of the screening answer
- `@@index([value], type: Gin)` on `Answer` -- GIN index for JSONB containment filter on screening value

### Query: "Export all responses for a study"

```sql
SELECT r.*, a.question_id, a.value
FROM responses r
  JOIN answers a ON a.response_id = r.id
  WHERE r.study_id = $1 AND r.status = 'COMPLETED'
  ORDER BY r.completed_at;
```

**Indexes used:**
- `@@index([studyId, status])` on `Response` -- filters by study + completed status
- `@@index([responseId])` on `Answer` -- batch fetch answers per response
- `@@index([studyId, completedAt])` on `Response` -- ordering

### Query: "Resume a respondent's session"

```sql
SELECT * FROM responses
  WHERE study_id = $1 AND respondent_id = $2;
```

**Index used:**
- `@@unique([studyId, respondentId])` on `Response` -- unique constraint doubles as an index; exact match

### Query: "Get lightbulb density per second for a video question"

```sql
SELECT FLOOR(timestamp) AS second, COUNT(*) AS count
FROM dial_events
  WHERE question_id = $1 AND event_type = 'lightbulb'
  GROUP BY second ORDER BY second;
```

**Index used:**
- `@@index([questionId, eventType])` on `DialEvent`

### Summary of all indexes

| Model | Index | Type | Purpose |
|-------|-------|------|---------|
| `Study` | `status` | BTree | Filter active/draft studies |
| `Study` | `createdBy` | BTree | "My studies" query |
| `Study` | `createdAt` | BTree | Sort by creation date |
| `Question` | `[studyId, order]` | BTree (unique) | Ordered question list |
| `Question` | `[studyId, phase, order]` | BTree | Phase-filtered question list |
| `Question` | `[studyId, isScreening]` | BTree | Quick screening question lookup |
| `QuestionOption` | `[questionId, order]` | BTree (unique) | Ordered options list |
| `QuestionOption` | `questionId` | BTree | All options for a question |
| `MediaItem` | `questionId` | BTree | Media for a question |
| `Response` | `[studyId, respondentId]` | BTree (unique) | Duplicate prevention |
| `Response` | `[studyId, status]` | BTree | Status-filtered responses |
| `Response` | `[studyId, completedAt]` | BTree | Time-range exports |
| `Response` | `respondentId` | BTree | Resume by cookie |
| `Answer` | `[responseId, questionId]` | BTree (unique) | One answer per question |
| `Answer` | `responseId` | BTree | All answers for a response |
| `Answer` | `questionId` | BTree | Aggregation per question |
| `Answer` | `value` | **GIN** | JSONB containment queries |
| `DialDataPoint` | `[answerId, second]` | BTree (unique) | Deduplicate dial data |
| `DialDataPoint` | `[questionId, second]` | BTree | Aggregation by second |
| `DialDataPoint` | `[questionId, responseId]` | BTree | Single-respondent lookup |
| `DialEvent` | `[questionId, eventType]` | BTree | Event aggregation |
| `DialEvent` | `[questionId, timestamp]` | BTree | Time-range event queries |

---

## 4. Polymorphic Answer Values: TypeScript Type Safety

Prisma's `Json` type maps to `Prisma.JsonValue` at the TypeScript level, which is effectively `any`. For a survey platform with 18 different answer shapes, this is unacceptable. Here is the recommended approach.

### Step 1: Install `prisma-json-types-generator`

```bash
npm install -D prisma-json-types-generator
```

Add the generator to your schema (already included above):

```prisma
generator json {
  provider = "prisma-json-types-generator"
}
```

### Step 2: Define discriminated union types

Create a file at `src/types/answer-values.ts`:

```typescript
// src/types/answer-values.ts

// ─────────────────────────────────────────────────────────────────
// Answer value shapes — one per QuestionType
// ─────────────────────────────────────────────────────────────────

export interface VideoDialAnswerValue {
  feedback: Record<number, number>;           // { 0: 50, 1: 62, 2: 48, ... }
  lightbulbs: number[];                       // [3.2, 17.8]
  actions?: Record<string, number[]>;         // { "tune_out": [5.1], "would_buy": [14.0] }
  annotations?: string[];                     // Post-video open-end text
  sliderInteracted: boolean;
}

export interface ListAnswerValue {
  selected: string[];                         // ["option_id_1", "option_id_2"]
}

export interface LikertAnswerValue {
  value: number;
}

export interface MultiLikertAnswerValue {
  values: Record<string, number>;             // { "item_id_1": 4, "item_id_2": 8 }
}

export interface NumericAnswerValue {
  value: number;
}

export interface WriteInAnswerValue {
  text: string;
}

export interface ABAnswerValue {
  selected: string;                           // "option_a" | "option_b"
  annotation?: string;
}

export interface RankingAnswerValue {
  ranked: string[];                           // ["option_3", "option_1", "option_2"]
}

export interface GridAnswerValue {
  values: Record<string, string>;             // { "row_1": "col_2", "row_2": "col_3" }
}

export interface ComparisonAnswerValue {
  values: Record<string, string>;             // { "statement_1": "option_a" }
}

export interface AdMockUpAnswerValue {
  positive: string[];
  negative: string[];
  posAnnotation?: string;
  negAnnotation?: string;
}

export interface OverallReactionAnswerValue {
  rating: number;
  selected: string[];
  annotation?: string;
}

export interface SelectFromSetAnswerValue {
  selected: Record<string, string>;           // { "set_0": "opt_1", "set_1": "opt_3" }
}

export interface MultiAdAnswerValue {
  selected: Record<string, string[]>;         // { "set_0": ["img_1", "img_2"] }
}

export interface CreativeCopyAnswerValue {
  annotations: string[];
}

// ─────────────────────────────────────────────────────────────────
// Union type for all answer values
// ─────────────────────────────────────────────────────────────────

export type AnswerValue =
  | VideoDialAnswerValue
  | ListAnswerValue
  | LikertAnswerValue
  | MultiLikertAnswerValue
  | NumericAnswerValue
  | WriteInAnswerValue
  | ABAnswerValue
  | RankingAnswerValue
  | GridAnswerValue
  | ComparisonAnswerValue
  | AdMockUpAnswerValue
  | OverallReactionAnswerValue
  | SelectFromSetAnswerValue
  | MultiAdAnswerValue
  | CreativeCopyAnswerValue;

// ─────────────────────────────────────────────────────────────────
// Discriminated mapping: QuestionType -> AnswerValue
// ─────────────────────────────────────────────────────────────────

import { QuestionType } from '@prisma/client';

export type AnswerValueForType = {
  [QuestionType.VIDEO_DIAL]: VideoDialAnswerValue;
  [QuestionType.STANDARD_LIST]: ListAnswerValue;
  [QuestionType.WORD_LIST]: ListAnswerValue;
  [QuestionType.IMAGE_LIST]: ListAnswerValue;
  [QuestionType.LIKERT]: LikertAnswerValue;
  [QuestionType.MULTI_LIKERT]: MultiLikertAnswerValue;
  [QuestionType.NUMERIC]: NumericAnswerValue;
  [QuestionType.WRITE_IN]: WriteInAnswerValue;
  [QuestionType.TEXT_AB]: ABAnswerValue;
  [QuestionType.IMAGE_AB]: ABAnswerValue;
  [QuestionType.LIST_RANKING]: RankingAnswerValue;
  [QuestionType.GRID]: GridAnswerValue;
  [QuestionType.COMPARISON]: ComparisonAnswerValue;
  [QuestionType.AD_MOCK_UP]: AdMockUpAnswerValue;
  [QuestionType.OVERALL_REACTION]: OverallReactionAnswerValue;
  [QuestionType.SELECT_FROM_SET]: SelectFromSetAnswerValue;
  [QuestionType.MULTI_AD]: MultiAdAnswerValue;
  [QuestionType.CREATIVE_COPY]: CreativeCopyAnswerValue;
};
```

### Step 3: Declare the PrismaJson namespace

Create `src/types/prisma-json.d.ts`:

```typescript
// src/types/prisma-json.d.ts

import type { AnswerValue } from './answer-values';

export {};

declare global {
  namespace PrismaJson {
    // Answer.value field
    type AnswerValue = import('./answer-values').AnswerValue;

    // Study.settings field
    type StudySettings = {
      allowBackNavigation?: boolean;
      showProgress?: boolean;
      completionRedirectUrl?: string;
      quota?: number;
      consentText?: string;
      sessionTimeoutHours?: number;
    };

    // Question.config field
    type QuestionConfig = {
      selectionLimit?: number;
      scaleMin?: number;
      scaleMax?: number;
      scaleStep?: number;
      scaleLabels?: Record<number, string>;
      items?: Array<{ id: string; label: string }>;
      dialMode?: 'sentiment' | 'intensity';
      actionButtons?: Array<{ id: string; label: string; icon?: string }>;
      annotationPrompt?: string;
      sets?: Array<{ id: string; options: string[] }>;
      [key: string]: unknown;
    };

    // Question.skipLogic field
    type SkipLogic = {
      condition: {
        questionId: string;
        operator: 'equals' | 'not_equals' | 'contains';
        value: string | number | string[];
      };
      action: 'skip_to' | 'terminate';
      targetQuestionId?: string;
      terminationMessage?: string;
    } | null;

    // Response.metadata field
    type ResponseMetadata = {
      userAgent?: string;
      ipHash?: string;
      consentedAt?: string;
      screenWidth?: number;
      screenHeight?: number;
      timezone?: string;
      referrer?: string;
      [key: string]: unknown;
    };
  }
}
```

### Step 4: Type-safe helper for reading answers

```typescript
// src/lib/answer-helpers.ts

import { QuestionType } from '@prisma/client';
import type { AnswerValueForType } from '@/types/answer-values';

/**
 * Type-safe answer value cast. Use when you know the question type.
 *
 * @example
 * const answer = await prisma.answer.findFirst({ where: { questionId }, include: { question: true } });
 * if (answer?.question.type === QuestionType.VIDEO_DIAL) {
 *   const dialValue = castAnswerValue(QuestionType.VIDEO_DIAL, answer.value);
 *   // dialValue is VideoDialAnswerValue — fully typed
 *   console.log(dialValue.feedback[0]); // number
 * }
 */
export function castAnswerValue<T extends QuestionType>(
  _type: T,
  value: unknown,
): AnswerValueForType[T] {
  return value as AnswerValueForType[T];
}
```

### Step 5: Zod runtime validation (recommended for writes)

```typescript
// src/lib/answer-schemas.ts

import { z } from 'zod';

export const videoDialAnswerSchema = z.object({
  feedback: z.record(z.coerce.number(), z.number().min(0).max(100)),
  lightbulbs: z.array(z.number()),
  actions: z.record(z.string(), z.array(z.number())).optional(),
  annotations: z.array(z.string()).optional(),
  sliderInteracted: z.boolean(),
});

export const listAnswerSchema = z.object({
  selected: z.array(z.string()),
});

export const likertAnswerSchema = z.object({
  value: z.number(),
});

// ... one schema per question type

// Validate before writing to database
export function validateAnswerValue(type: QuestionType, value: unknown) {
  switch (type) {
    case 'VIDEO_DIAL':
      return videoDialAnswerSchema.parse(value);
    case 'STANDARD_LIST':
    case 'WORD_LIST':
    case 'IMAGE_LIST':
      return listAnswerSchema.parse(value);
    case 'LIKERT':
      return likertAnswerSchema.parse(value);
    // ... remaining types
    default:
      throw new Error(`Unknown question type: ${type}`);
  }
}
```

---

## 5. Supabase-Specific Considerations

### 5a. Connection Pooling with PgBouncer / Supavisor

**Environment variables** (`.env`):

```env
# Pooled connection (Supavisor on port 6543) — used by Prisma Client at runtime
DATABASE_URL="postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct connection (port 5432) — used by Prisma CLI for migrations
DIRECT_URL="postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

Key details:
- `?pgbouncer=true` disables prepared statements in Prisma Client (required because Supavisor's transaction mode does not support them).
- `connection_limit=1` prevents Prisma from opening more connections than the pool can handle.
- `directUrl` is used exclusively by `prisma migrate` and `prisma db push`, which need a non-pooled connection because they use transactions and advisory locks.

### 5b. Row-Level Security (RLS) Policies

Prisma connects via the `postgres` role (the database owner) using the direct connection string. This means **Prisma bypasses RLS by default**. This is actually desirable for a server-side ORM -- you enforce access control in your application logic (API routes, middleware) rather than at the database level.

However, you should still create RLS policies for defense-in-depth, especially if any code path uses the Supabase JS client (which connects via the `anon` or `authenticated` role and IS subject to RLS).

**Recommended RLS policies** (apply via a Prisma migration using raw SQL):

```sql
-- prisma/migrations/XXXXXX_add_rls_policies/migration.sql

-- Enable RLS on all tables
ALTER TABLE studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dial_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE dial_events ENABLE ROW LEVEL SECURITY;

-- Admin policies: authenticated users can manage their own studies
CREATE POLICY "admin_studies_select" ON studies
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "admin_studies_insert" ON studies
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "admin_studies_update" ON studies
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Respondent policies: anonymous users can read active studies
CREATE POLICY "respondent_studies_select" ON studies
  FOR SELECT TO anon
  USING (status = 'ACTIVE');

-- Respondent can read questions for active studies
CREATE POLICY "respondent_questions_select" ON questions
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM studies WHERE studies.id = questions.study_id AND studies.status = 'ACTIVE'
    )
  );

-- Respondent can insert their own responses
CREATE POLICY "respondent_responses_insert" ON responses
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM studies WHERE studies.id = responses.study_id AND studies.status = 'ACTIVE'
    )
  );

-- Respondent can read/update their own response (resume)
CREATE POLICY "respondent_responses_select" ON responses
  FOR SELECT TO anon
  USING (respondent_id = current_setting('app.respondent_id', true)::uuid);

-- Respondent can insert answers for their own response
CREATE POLICY "respondent_answers_insert" ON answers
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM responses
      WHERE responses.id = answers.response_id
        AND responses.respondent_id = current_setting('app.respondent_id', true)::uuid
    )
  );

-- Service role bypasses all RLS (used by Prisma in API routes)
-- This is automatic for the postgres role and service_role key
```

**Important architectural note**: Since your Next.js API routes use Prisma (which connects as the database owner), RLS policies are not enforced on those queries. The RLS policies above protect against:
1. Direct Supabase JS client access from edge functions or client-side code
2. Defense-in-depth if a code path accidentally exposes the Supabase `anon` key

### 5c. Edge Compatibility (Vercel Edge Runtime)

Prisma Client has historically been incompatible with edge runtimes because it relies on Node.js-specific APIs and native binary query engines. Here are the options:

**Option A: Use Prisma Accelerate** (recommended for edge)
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

export const prisma = new PrismaClient().$extends(withAccelerate());
```

Prisma Accelerate acts as a managed connection pool and HTTP proxy, allowing Prisma Client to run in edge runtimes (Vercel Edge Functions, Cloudflare Workers). It connects to your Supabase database and handles connection pooling independently.

**Option B: Keep API routes as Node.js serverless functions** (simpler)

Since your survey submission endpoints need reliable database writes and your admin dashboard benefits from SSR, running standard Node.js serverless functions on Vercel is the simplest path:

```typescript
// app/api/answers/route.ts
// This file runs as a Node.js serverless function by default on Vercel
// No edge runtime needed

import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const body = await request.json();
  // ... validate and write answer
}

// Do NOT add: export const runtime = 'edge';
```

**Option C: Hybrid approach**

Use edge runtime for read-heavy routes (survey question fetching) and Node.js runtime for write-heavy routes (answer submission, admin CRUD):

```typescript
// app/api/studies/[id]/questions/route.ts
export const runtime = 'edge'; // Fast reads, globally distributed

// app/api/answers/route.ts
// Default Node.js runtime — reliable writes with full Prisma support
```

### 5d. Supabase Extensions

Add these PostgreSQL extensions via migration if needed:

```sql
-- Enable UUID generation (built-in for PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable full-text search (if needed later)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 5e. Migration Command Reference

```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_dial_tables

# Apply migrations to production (uses DIRECT_URL automatically)
npx prisma migrate deploy

# Generate Prisma Client (uses DATABASE_URL)
npx prisma generate

# Introspect existing Supabase database
npx prisma db pull
```

---

## Summary of Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ID generation | `dbgenerated("gen_random_uuid()")` with `@db.Uuid` | Database-level UUIDs; works correctly with Supabase; not dependent on Prisma runtime |
| Column naming | `@@map("snake_case")` on models, `@map("snake_case")` on fields | Prisma models use camelCase; database uses snake_case per PostgreSQL convention |
| Dial data storage | Hybrid: JSONB in Answer + normalized DialDataPoint table | Fast writes via JSONB; fast aggregation via relational table |
| JSON type safety | `prisma-json-types-generator` + Zod validation | Compile-time types via generator; runtime validation via Zod on write paths |
| Connection pooling | Supabase Supavisor with `pgbouncer=true` | Required for serverless; `directUrl` for migrations |
| RLS | Enabled but Prisma bypasses via postgres role | Defense-in-depth; actual access control in API route middleware |
| Cascade deletes | `onDelete: Cascade` on all child relations | Deleting a study cleans up everything; `Restrict` on Answer->Question prevents orphaned data |
| Unique constraints | `[studyId, respondentId]` on Response, `[responseId, questionId]` on Answer | Prevent duplicate submissions at the database level |

---

Sources:
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- [Prisma Indexes Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)
- [Prisma + Supabase Integration](https://www.prisma.io/docs/orm/overview/databases/supabase)
- [Prisma PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [Working with JSON Fields in Prisma](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields)
- [prisma-json-types-generator](https://github.com/arthurfiorette/prisma-json-types-generator)
- [Prisma JSON Type Safety with Discriminated Unions (Issue #24296)](https://github.com/prisma/prisma/issues/24296)
- [Polymorphism in Prisma (ZenStack)](https://zenstack.dev/blog/polymorphism)
- [When to Avoid JSONB in PostgreSQL (Heap)](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema)
- [PostgreSQL JSONB and TOAST Performance](https://pganalyze.com/blog/5mins-postgres-jsonb-toast)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Prisma + Supabase RLS Discussion](https://github.com/prisma/prisma/discussions/18642)
- [GIN Indexes for JSONB in Prisma (Issue #7410)](https://github.com/prisma/prisma/issues/7410)
- [Prisma Supabase Accelerate Guide](https://www.prisma.io/docs/guides/supabase-accelerate)
- [PostgreSQL JSON Optimization 2025](https://markaicode.com/postgres-json-optimization-techniques-2025/)