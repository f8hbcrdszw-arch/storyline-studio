# Synthesis: Security, Performance & Design Review
> Batch 4 — Extracted from `recovered-deepen-research.md` sections: Security review, Performance review, Frontend design skill review
> For use in editing `2026-03-08-feat-storyline-studio-v2-best-in-class-platform-plan.md`

---

## 1. Security Findings

### CRITICAL

- **TipTap JSON XSS (affects 2a.4)**: TipTap JSON is NOT inherently safe. Link `href` can contain `javascript:` or `data:` schemes. Image `src` can be arbitrary. Unknown node types could render as raw HTML.
  - Add strict Zod schema for TipTap JSON: whitelist node types (`paragraph`, `text`, `heading`, `bulletList`, `orderedList`, `listItem`, `image`, `hardBreak`) and marks (`bold`, `italic`, `link`)
  - Validate link `href` server-side: reject anything other than `https:` / `http:`
  - Validate image `src`: only accept R2 keys matching `images/[uuid].[ext]`
  - Renderer must use explicit node-type allowlist; unknown types render `null`
  - Add `promptRichText` Zod schema validation on every write (current `z.record(z.string(), z.unknown())` is too loose)

### HIGH

- **AI PII exposure (affects 2c.4)**: "PII redaction" is hand-waved with no implementation. Open-text responses could contain names, emails, phone numbers.
  - Implement regex-based PII patterns + consider using Anthropic API for pre-screening
  - Add explicit admin toggle: "Include open-text in AI analysis" with warning
  - Add system prompt defense against prompt injection from respondent data
  - Add `expiresAt` / TTL to `AISummary` records
  - Add per-user global rate limit (20/hour across all studies), not just per-study (5/hour)
  - Address DPA/privacy policy for third-party AI processing (business requirement for Google/YouTube clients)

- **Answer piping injection (affects 2b.4)**: Piped respondent text could contain HTML/script tags or recursive `{{q:...}}` tokens.
  - Pipe resolver must use single-pass resolution, no recursion
  - Piped values must always render as React text nodes (auto-escaped), never `dangerouslySetInnerHTML`
  - In rich text, pipe tokens must render as text-only React elements, never parsed rich text
  - Truncate piped open-text to 200 chars (plan already says this)

- **Incomplete RBAC migration (affects 2d.1)**: Every API route currently checks `createdBy: auth.userId`. Plan says "update all routes" but missing a single route = unauthorized access.
  - Build centralized `requireStudyAccess(request, studyId, minimumRole)` middleware
  - Audit every route after migration
  - Enforce role modification only by ADMIN
  - Log membership changes to audit log

- **Invitation token security (affects 2d.1)**: Prisma `@default(uuid())` may not be cryptographically secure.
  - Use `crypto.randomBytes(32).toString('hex')` instead
  - Enforce one-time use via `acceptedAt` check
  - Rate limit invitation acceptance endpoint

- **Supabase Realtime channel auth (affects 2c.1)**: Channels are accessible to any authenticated user by default. Respondents have the anon key and know the study UUID.
  - Configure RLS policies on Realtime channels to verify study membership
  - Consider server-side intermediary (poll endpoint) instead of direct client subscription
  - Do NOT rely on channel name obscurity

- **In-memory rate limiter is useless on Vercel (affects all phases)**: Each serverless invocation gets a fresh `Map()`. Rate limiting is non-functional in production.
  - **Move Upstash Redis rate limiter from 2d.4 to pre-Phase 2a** (currently deferred too late)

### MEDIUM

- **Theme CSS injection (affects 2b.3)**: Color values could contain CSS injection if not validated.
  - Validate all colors with strict hex regex: `/^#[0-9a-fA-F]{6}$/`
  - Validate `logoUrl` / `backgroundImageUrl` as R2 keys only
  - Use `element.style.setProperty()`, never string-interpolated `<style>` tags
  - Create Zod schema for `SurveyTheme`

- **Shared template poisoning (affects 2a.6)**: Malicious rich text in shared templates propagates to other users.
  - Re-validate template content through TipTap JSON schema on insertion, not just on save
  - Restrict `isShared` to org admins or add moderation

- **No magic byte validation on uploads (affects 2a.4)**: Presigned URLs allow uploading any content regardless of declared MIME type.
  - Add post-upload verification: fetch first bytes from R2 and check magic bytes
  - Set `Content-Disposition: attachment` on all R2 objects

- **Skip logic exposed to respondents (affects existing code)**: Public survey API returns `skipLogic` and `isScreening` fields. Respondents can game screening.
  - Remove `skipLogic` and `isScreening` from `/api/surveys/[slug]` response
  - Client should receive only navigation instructions from answer submission response

- **CSRF not explicitly implemented (affects all phases)**: Verify Supabase Auth uses Bearer tokens in headers (implicit CSRF protection), not cookies.

- **CSP `unsafe-eval` / `unsafe-inline` (affects 2d.4)**: Weakens XSS protection, especially with TipTap, React Flow, Recharts added.
  - Investigate nonce-based CSP for production
  - Add `Permissions-Policy` header for `vibrate` and `autoplay`

### LOW

- **Seek prevention bypassable (affects 2b.2)**: All client-side controls can be bypassed via DevTools. Accepted risk.
  - Add server-side timing validation: compare answer time vs video duration
  - Flag responses with dial data gaps (missing seconds)
- **Clipboard paste injection (affects 2a.6)**: Validate all pasted JSON through same Zod schemas as question creation

---

## 2. Performance Findings

### P0 — Before writing V2 code

- **Drop Framer Motion from survey bundle (affects 2b.1)**: Full bundle is ~32KB gzipped. Even `LazyMotion` + `domAnimation` is ~14KB. Survey budget is 65KB baseline + 25KB headroom = 90KB target.
  - Use CSS transitions + Web Animations API (WAAPI) for respondent-side animations (~1KB utility)
  - Reserve Framer Motion for admin side only
  - All plan animations (slide, fade, option bounce) achievable with `element.animate()` + CSS transitions
  - Typeform uses zero animation libraries; their TTFMP is ~800ms

- **Build custom TipTap JSON renderer (affects 2a.4)**: `@tiptap/core` alone is ~18KB gzipped. Plan's "under 8KB" target impossible with TipTap imports.
  - Write custom recursive renderer (~150 lines, ~3KB gzipped) that walks TipTap JSON AST
  - Do NOT import any `@tiptap/*` packages on the survey side
  - Also reduces XSS attack surface (you control which node types render)

- **Add composite index `@@index([questionId, responseId])` on Answer (affects 2c.2/2c.3)**: Required for cross-tab query performance. Without it, self-join scans full table.

### P1 — During development

- **Cap zundo history at 30 entries (affects 2a.1)**: Default is unlimited. 50 questions at ~2KB each = 100KB/snapshot. With rich text, 35MB for 100 undo steps.
  - Set `temporal(store, { limit: 30 })`
  - Use `partialize` to exclude `isSaving`, `isDirty`, `lastSavedAt`, `flowLayout`, media refs
  - Expected memory: under 3MB for 50-question study

- **Lazy-load React Flow (affects 2a.5)**: ~45KB gzipped + dagre/elkjs ~15-30KB. List view is the default.
  - Use `next/dynamic` with `ssr: false` only when user switches to Flow View
  - Load dagre/elkjs on-demand only on "Auto Layout" click
  - Admin editor loads in ~1.5s (list), Flow View ~2.0s on first switch

- **Use `startTransition` for real-time chart updates (affects 2c.1)**: 30-question study = 30 Recharts components re-rendering every 5 seconds.
  - Memoize chart components with `React.memo`
  - Only re-render charts with new data (use questionId from Realtime event)
  - Use `startTransition` to defer chart updates

- **Keep Canvas for DialPlayback (affects 2c.2)**: Plan says "Rebuild QuestionResults.tsx using Recharts" — must explicitly exclude dial playback. Recharts re-renders entire React subtree at ~16ms/frame, Canvas avoids React reconciliation.

- **Pre-build `Path2D` objects for trace overlays (affects 2c.2)**: 100 traces of 180 points = 18,000 data points. Create `Path2D` once, redraw cheaply.
  - Dedicated API endpoint `/api/studies/[id]/results/dial/[questionId]/traces`
  - Server-side random sampling: `ORDER BY RANDOM() LIMIT 100` on response IDs
  - Viewport culling during zoom

- **Use throttle, not debounce, for Realtime dashboard (affects 2c.1)**: Debounce resets on each event — during a burst of 50 responses, no update until burst stops (30+ seconds). Throttle guarantees updates every 5s.
  - Add in-flight guard to prevent concurrent aggregation fetches
  - Add `Cache-Control: private, max-age=5` to results API

### P2 — After initial implementation

- **Implement incremental Realtime updates (affects 2c.1)**: Instead of full re-aggregation every 5s, maintain client-side running tally + incremental updates from Realtime payload. Fall back to full re-fetch every 30s as consistency check.

- **Streaming for AI summary (affects 2c.4)**: Use SSE or Vercel AI SDK `streamText`. Set `export const maxDuration = 30` on the route. Pre-compute aggregate data payload separately from AI response.

- **Replace in-memory completion-time calculation (affects existing `aggregation.ts` lines 40-52)**: Currently fetches all Response rows to compute average time. Use SQL `AVG(EXTRACT(EPOCH FROM ...))` instead.

- **Add response pagination to results API (affects 2d.4)**: Consider earlier if any study exceeds 500 responses during V2 dev.

### Bundle Budget (Survey Respondent Side)

| Component | Current (KB gz) | V2 Addition (KB gz) | Strategy |
|-----------|----------------|---------------------|----------|
| Base (Next.js + React) | ~42 | 0 | -- |
| Survey Shell + Question Types | ~18 | 0 | -- |
| Turnstile | ~5 | 0 | -- |
| TipTap Renderer | 0 | **+3** | Custom JSON walker, NOT @tiptap/core |
| Framer Motion | 0 | **0** | CSS + WAAPI instead |
| Answer Piping | 0 | +1 | Custom resolver |
| Randomization | 0 | +0.5 | Seeded Fisher-Yates |
| Canvas Sparkline | 0 | +0.5 | Built-in Canvas API |
| Theme Provider | 0 | +0.3 | CSS custom properties |
| **Total** | **~65** | **+5.3** | **~70KB** (20KB headroom under 90KB target) |

### Scalability Thresholds

| Scenario | Respondents | Questions | Answer Rows | DialDataPoints | Cross-Tab Query |
|----------|-------------|-----------|-------------|----------------|-----------------|
| Current | 100 | 15 | 1,500 | 18,000 | <100ms |
| 10x | 1,000 | 30 | 30,000 | 180,000 | 200-500ms |
| 100x | 10,000 | 30 | 300,000 | 1,800,000 | 2-8s (needs pagination) |

---

## 3. Design Recommendations

### Cross-Cutting (all phases)

- **Standardize animation curve**: `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style deceleration) as primary easing. Register as `--ease-spring` in Tailwind. Add `--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **8px spacing grid**: All spacing in multiples of 4px with 8px base. Micro: 4px, standard: 8px, section: 16px, panel padding: 16-20px, card padding: 20-24px, page margins: 24-32px.
- **Typography scale** (reference throughout):
  - Page title: Items, 24px, weight 300, tracking -0.02em
  - Section heading: Items, 18px, weight 400, tracking -0.01em
  - Card title: Scto, 15px, weight 500
  - Body: Scto, 14px, weight 400
  - Small: Scto, 12px, weight 400
  - Mono label: Phonic, 10px, weight 400, tracking 0.15em (existing `label-mono`)
  - Data value: Phonic, 13px, weight 400, tracking 0.05em
- **Three-font system as signature differentiator**: Phonic Mono labels are the distinctive element. Use for all panel headers, stat labels, chart annotations.

### Phase 2a: Editor

- **Split-pane layout (2a.3)**:
  - Avoid visible panel borders; use shadow-based separation with 1px splitter that reveals on hover (Storyline Blue on drag)
  - Panel headers use Phonic Mono uppercase labels ("QUESTIONS", "EDITOR", "PREVIEW")
  - Panel collapse animation: `width 350ms cubic-bezier(0.32, 0.72, 0, 1)`, collapsed to 44px icon rail
  - Preview panel: device frame with layered box-shadow (floating artifact feel), segmented control for Mobile/Tablet/Desktop with sliding indicator
  - Panel minimums: left 240px, center 400px, right 320px
  - Panel header height: 44px (matches collapsed rail for visual consistency)
  - Question list items: denser than current cards (12px vertical, 16px horizontal padding)
  - Decompose `EditorLayout.tsx` from the start: `PanelResizer.tsx`, `CollapsiblePanel.tsx`, thin composition layer

- **Flow builder (2a.5)**:
  - Canvas background: custom cross-hatch grid (not dots) — `linear-gradient` in both directions, 24px spacing, navy-tinted at 3% opacity
  - Node cards: 220px wide, 10px border-radius, phase color bar (3px) at top, type icon + question number + title (2-line clamp) + type pill
  - Selected state: blue border + `0 0 0 2px var(--primary)` ring + blue-tinted shadow
  - Hover: subtle lift (`translateY(-1px)`) + shadow expansion
  - Sequential edges: solid, subtle (`var(--border)`, 1.5px)
  - Skip logic edges: dashed, Storyline Blue, animated dash flow (`stroke-dashoffset` keyframe)
  - Edge labels: compact pills with `var(--primary)` bg
  - Phase swim lanes: semi-transparent colored regions with dashed border, Phonic Mono labels
  - Custom branded zoom controls (replace React Flow defaults): compact button group, bottom-left
  - Custom minimap styling: card background, border, rounded, brand-tinted mask

### Phase 2b: Survey Experience

- **Transitions (2b.1)**:
  - Slide transition: asymmetric — exit moves 20% (less), enter moves 30% (more). Exit blurs 2px, enter blurs 4px. Creates perceptual energy in incoming question.
  - Fade transition: subtle vertical shift (enter +12px, exit -8px)
  - Zoom transition: enter from 1.06 scale, exit to 0.95
  - Progress bar: spring physics (`stiffness: 100, damping: 20, mass: 0.8`)
  - Option selection: scale bounce `[1, 1.015, 1]` over 200ms, border color animates in
  - Completion screen: draw-in checkmark animation via `stroke-dashoffset`
  - **All achievable with CSS + WAAPI** per performance recommendation (no Framer Motion on survey side)

- **Video dial (2b.2)**:
  - Slider track: gradient red-yellow-green (oklch), 8px height expanding to 12px during drag
  - Thumb: 28px (36px on coarse pointer/mobile), 2px border, glassmorphism on drag (`backdrop-filter: blur(8px)`)
  - Dynamic thumb border color tints based on value position
  - Endpoint bounce animation when hitting 0 or 100
  - Attention pulse animation (3 pulses) when video starts and slider untouched
  - Value tooltip above thumb during drag (Phonic Mono, 14px)
  - Mini-trail sparkline: gradient fill + fading opacity line, smooth quadratic curves, fade edges with gradient overlay
  - Vertical orientation: 48px wide rail, gradient bottom-to-top, Phonic Mono labels for +/-

- **Theme engine (2b.3)**:
  - Color picker: curated palette of 12 brand-adjacent colors (2 rows of 6 swatches) + custom hex input
  - Preset themes as miniature preview cards showing simulated question (not abstract swatches): 16:10 aspect ratio with tiny simulated question + buttons
  - 4 presets: Storyline Classic, Minimal Light, Dark Professional, Corporate Blue
  - WCAG contrast warning inline with "Auto-fix" button that nudges oklch lightness
  - Define Tailwind theme tokens (`survey-primary`, `survey-bg`) in config rather than `bg-[var(--survey-bg)]` arbitrary values

### Phase 2c: Analytics

- **Chart design direction**: "Bloomberg Terminal meets Dieter Rams" — dense but clear, premium annual report quality
- **Chart color palette**: 6 perceptually uniform oklch colors (Storyline Blue, Teal, Warm Gold, Mauve, Sage, Terracotta) + 2 extended. Separate dial semantic colors (red/yellow/green zones).
- **Chart typography**: Title in Items 16px, subtitle in Scto 12px, axis labels in Scto 11px, value labels in Phonic Mono 11px, sample size in Phonic Mono 10px uppercase
- **Bar charts (2c.2)**: Horizontal layout, 24px bar height, 4px end radius, percentage labels right-aligned in Phonic Mono
- **Chart container cards**: Consistent chrome — header with `Q3` mono label + type pill + question title (Items font) + `N = 247 RESPONSES` (Phonic Mono) + export/expand icons. Optional AI insight badge at bottom with `Sparkles` icon.
- **Dial playback chart**: Use clip-path reveal for animated draw-in, confidence intervals as shaded band
- **Data density principle**: Hero stat prominently (Items 4xl font light), secondary stats in grid below (3-column: mean, median, std dev)
- **Animated number transitions**: Pure CSS + rAF approach (~0 dependencies) for stat counters

### Phase 2d: Collaboration & Platform

- **Dark mode (2d.3)**: Navy-based (not generic gray) — use `#100C21` as dark background
  - Complete oklch token system for light/dark: surfaces (4 levels), text (4 levels), borders (3 levels), brand (3 levels), feedback (3 states), shadows (4 sizes)
  - Dark mode surfaces use oklch L=0.148-0.25 with hue 280 (navy tint)
  - Dark mode text: off-cream (not pure white) at oklch L=0.935
  - Dark borders: white at 8-15% opacity
  - Chart colors need higher lightness in dark mode (bump L by ~0.2)
  - Three-state toggle: System / Light / Dark (segmented control with icons)
  - Anti-FOUC: `<script>` in `<head>` reads localStorage before paint
  - Smooth mode transition: apply `transitioning-theme` class with 300ms `background-color`, `color`, `border-color` transitions, remove after 350ms

---

## 4. Race Conditions to Address

These were found in the race condition review and should be added as warnings/tasks in relevant plan sections:

- **Autosave vs Undo/Redo clobber (2a.1)**: Debounced save captures pre-undo state in closure. Fix: read state at fire time, cancel pending save on undo, use version counter.
- **Dial slider buffering race (2b.2, existing bug)**: `isBuffering` is React state used as synchronous gate — always one render behind. Fix: use ref for buffering state.
- **Real-time dashboard event flood (2c.1)**: Debounce is wrong; use throttle. Debounce suppresses updates during burst (30+ seconds of stale data).
- **Answer piping stale data on back-navigation (2b.4)**: Pipe resolver must run during render (not useEffect), reading current answers. Include `answersVersion` in component key.
- **React Flow drag + Zustand mutation (2a.5)**: Use uncontrolled mode for positions, sync to store only on drag end.
- **TipTap IME composition during autosave (2a.4)**: Check `editor.view.composing` before syncing to store.
- **Theme color picker undo flood (2b.3)**: Throttle Zustand writes for continuous inputs. Separate "preview" color (CSS only) from "committed" color (store + autosave).
- **Question randomization on resume (2b.5)**: Store resolved question order in Response, not just seed. Re-shuffling different-length array produces different order.
- **Clipboard paste during DnD (2a.6)**: Reject all list mutations while dragging. Define editor state machine: `IDLE | DRAGGING`.

---

## 5. Existing Bugs to Fix Before V2

1. **`VideoDial.tsx` line 79**: `isBuffering` React state used as synchronous gate. Use ref.
2. **`VideoDial.tsx` lines 64-74**: Signed URL fetch has no AbortController. Unmount during fetch causes wasted render.
3. **`VideoDial.tsx` line 86**: `isBuffering` in dependency array causes unnecessary callback recreation on every buffer toggle.
4. **`DialSlider.tsx` line 23**: `value` in `getValueFromPosition` dependency array causes unnecessary recreation on every slider movement.
5. **`StudyEditor.tsx` line 119**: `handleDragEnd` fires unguarded reorder fetch. Two rapid drags race; second may resolve first with wrong order. Add AbortController or sequence counter.

---

## 6. Architectural Additions for Plan

- **Editor state machine**: Define `IDLE | SAVING | DRAGGING | UNDOING` states. Guard mutations by state. Prevents boolean soup.
- **AbortController registry**: Central registry for autosave, media URL, AI summary, Realtime fetches. Call `cancelAll()` on navigation.
- **`requireStudyAccess` middleware**: Centralized authorization replacing per-route `createdBy` checks. Return user's role or check `createdBy` as fallback for creator.
- **`PATCH /api/questions/[id]/restore` endpoint**: Needed for undo-delete when autosave already fired the soft-delete.
- **Move `QuestionRenderer` to shared location**: `src/components/survey/` — needed for `LivePreview` cross-route-group import.
- **Standardize field naming**: `QuestionTemplate` should use `prompt` / `promptRichText` (matching `Question`), not `promptText` / `promptRich`.
- **Statistics library**: Use `simple-statistics` or `jstat` instead of hand-rolling significance tests. Incorrect p-values are worse than none.
