---
title: "Zero-dep structured logging for Next.js on Vercel"
category: integration-issues
tags: [logging, next.js, vercel, error-handling, observability]
module: lib/logger
symptoms:
  - "No visibility into API errors"
  - "console.error with no context (no requestId, path, method)"
  - "Silent API failures on client — no error surfaced to user"
  - "Cannot correlate user-reported errors to server logs"
date_solved: 2026-03-07
severity: medium
---

# Zero-dep Structured Logging for Next.js on Vercel

## Problem

The app had exactly one `console.error("[API Error]", error)` across 21 API routes. No structured output, no log levels, no request IDs, no context. Debugging required watching the terminal and hoping to catch the error live. Client-side API calls (e.g., `handleAddQuestion` in StudyEditor) silently swallowed failures — `res.ok` was false but nothing was shown to the user or logged.

## Root Cause

No logging infrastructure existed. The `withErrorHandler` wrapper caught errors but only dumped them via plain `console.error` with no metadata. Client-side fetch calls had no error handling at all.

## Solution

### 1. `src/lib/logger.ts` — Zero-dep structured logger

A thin wrapper around `console` with:
- **4 levels**: error, warn, info, debug — gated by `LOG_LEVEL` env var
- **JSON in production** (Vercel parses/indexes), **human-readable in dev**
- **`child(context)`** for scoped loggers (requestId, userId, etc.)
- **Edge-safe**: no `fs`, `Buffer`, or Node-only APIs

```typescript
import { logger } from "@/lib/logger";

// Standalone
logger.info("Study created", { studyId: study.id });

// With request context
const log = logger.child({ userId: auth.userId, studyId });
log.error("Export failed", { error: err.message });
```

Dev output:
```
[ERROR] Unhandled API error {"requestId":"abc-123","method":"POST","path":"/api/studies"}
```

Production output (JSON for Vercel log filtering):
```json
{"level":"error","message":"Unhandled API error","timestamp":"2026-03-07T14:23:11.042Z","requestId":"a3f7...","method":"POST","path":"/api/studies/abc123","error":"Connection timeout"}
```

Key design decision: `getConfiguredLevel()` is called per-write, not at module init. This makes it safe in Edge runtime and respects hot-reload in dev.

### 2. `src/lib/api/error-handler.ts` — Request context + requestId

Updated the single error handler wrapper (used by all 21 route files) to:
- Generate `requestId` via `crypto.randomUUID()` per request
- Create child logger with `{ requestId, method, path }`
- Log ZodErrors at `warn` (expected validation failures, not errors)
- Log unhandled errors at `error` with message + stack
- **Return `requestId` in 500 response body** — key for correlating user reports to logs

```typescript
// 500 response now includes requestId for correlation
{ error: "An unexpected error occurred", requestId: "a3f7-..." }
```

### 3. Client-side error surfacing

Added error handling to `handleAddQuestion` in StudyEditor — if the API returns non-ok, the error message is shown in the UI and logged to console. Previously it silently did nothing.

## Key Files

| File | Role |
|------|------|
| `src/lib/logger.ts` | Logger implementation (new) |
| `src/lib/api/error-handler.ts` | Updated — uses logger, adds requestId |
| `.env.example` | Added `LOG_LEVEL=info` |
| `.env` | Set `LOG_LEVEL=debug` for local dev |

## Prevention

- **All new API routes** automatically get structured logging via `withErrorHandler` — no per-route changes needed
- **Client-side fetch calls** should always handle non-ok responses and surface errors (the `handleAddQuestion` pattern is the template)
- **LOG_LEVEL** should be `debug` locally, `info` in production

## Upgrade Path

When the app outgrows this, replace the `write()` function body in `logger.ts` with a Pino instance. The `Logger` interface stays the same — zero call-site changes. One file, ~15 lines.

## Gotchas

- `userId` is NOT extracted in the error handler — auth happens inside route handlers via `requireAdmin`/`requireRespondent`, not before. Use `logger.child({ userId })` inside specific handlers if needed.
- `export/route.ts` has an inner try/catch that re-throws — the same error will be logged once by the outer `withErrorHandler` catch. Don't add duplicate logging inside inner catches.
- File inputs (`<input type="file">`) in React 19 can trigger spurious "controlled/uncontrolled" warnings — these are non-blocking console warnings, not actual errors.
