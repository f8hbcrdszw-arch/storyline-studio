# Synthesis: Batch 3 Technology Research

Research-to-plan synthesis for React Flow, TipTap, Zustand/Zundo, Motion (Framer Motion), Dial Slider UX, and Real-Time Dashboards. Organized by technology with actionable items for plan edits.

---

## 1. React Flow (`@xyflow/react` v12+)

### Best practices to add to plan tasks (2a.5)
- Define `nodeTypes` and `edgeTypes` **outside** components (not inline) -- the #1 performance mistake. Inline definition causes React Flow to unmount/remount all nodes on every render.
- Wrap all custom node and edge components in `React.memo`.
- Use CSS classes `nodrag`, `nopan`, `nowheel` on interactive elements inside nodes (inputs, scrollable areas).
- Use `ReactFlowProvider` wrapping the component that calls `useReactFlow()`.
- Use Zustand selectors with `shallow` equality -- never subscribe to the entire `nodes` array from a component that only needs one field.
- Lazy-load React Flow with `next/dynamic({ ssr: false })` -- only load when user switches to Flow View, not on editor mount.

### Gotchas / pitfalls
- **v12 breaking change**: Node dimensions now live at `node.measured.width` / `node.measured.height`, not in the node object directly. Layout functions must use `node.measured` values.
- `panOnDrag: false` combined with `panOnScroll: true` breaks touch scrolling. Use conditional config for touch vs. desktop.
- React Flow uses Zustand internally -- if your Zustand version conflicts, you get runtime errors. Pin compatible versions.
- Flow view should be desktop/tablet only. Show list fallback on mobile (`< 768px`).

### Code patterns
- **Auto-layout**: Use `@dagrejs/dagre` (40KB), NOT ELK (1.5MB overkill for DAG). D3-Hierarchy cannot handle variable node heights.
- Dagre returns center coordinates; React Flow uses top-left. Subtract `width/2` and `height/2` from dagre output.
- **Connection validation**: Use `isValidConnection` to enforce DAG (no backward edges, no self-connections). Simple index comparison is sufficient for a linear-with-branches survey.
- **Persist only positions + viewport** in `flowLayout` JSONB field -- NOT full node/edge objects. Questions table stays authoritative for content.
- Debounce position saves at 2 seconds to avoid hammering API during drag.
- Auto-layout on: initial load, new question added, node expand/collapse, explicit "Auto-arrange" click. NOT on every drag.

### Bundle / performance
- `@xyflow/react`: ~45KB gzipped (admin-only)
- `@dagrejs/dagre`: ~40KB gzipped (lazy-load on "Auto-arrange" click)
- Zustand is already used internally by React Flow -- zero additional cost if versions match.
- At 50-100 nodes: no virtualization, no web workers, no canvas rendering needed.

### Plan edits needed
- **2a.5 task**: Change "Install React Flow: `@xyflow/react`" to also install `@dagrejs/dagre`.
- **2a.5 task**: Add "Load FlowBuilder via `next/dynamic` with `ssr: false`" task.
- **2a.5 task**: Add "Define nodeTypes/edgeTypes as module-level constants, not inline" task.
- **2a.5 acceptance criteria**: Add "Flow builder loads only when Flow View is selected (lazy-loaded)."

---

## 2. TipTap Rich Text (`@tiptap/react` v3)

### Best practices to add to plan tasks (2a.4)
- Use TipTap **v3** (currently v3.20.1). V3 resolved all React 19 compatibility issues. V2 had a blocking issue with `tippyjs-react` and React 19.
- **Do NOT use `@tiptap/starter-kit`**. It includes 16+ extensions (blockquote, code-block, heading, bullet-list, etc.) that are unnecessary for survey prompts. Cherry-pick individual extensions for 30-40% smaller bundle.
- Store TipTap JSON in a `Json` (JSONB) column, not as a string. Always use `editor.getJSON()` for persistence, never `editor.getHTML()`.
- Always maintain a `promptPlain` field alongside the JSON for full-text search, screen readers, and notifications.
- Use `BubbleMenu` (floating toolbar on text selection), not a fixed toolbar. Matches Notion/Linear UX and saves vertical space.
- Editor component MUST be `'use client'` with `ssr: false` via `next/dynamic`. ProseMirror requires DOM.

### Gotchas / pitfalls
- **XSS vulnerability**: CVE-2025-14284 in `@tiptap/extension-link` (case-sensitive `javascript:` bypass). Always sanitize URLs independently with a `sanitizeUrl()` function that checks against allowed protocols.
- Never pass raw user strings to `setContent()` -- it invokes DOMParser.
- TipTap's UI Components library may still lag behind React 19 -- irrelevant since you build a custom toolbar.
- If adding Yjs collaboration later, you MUST remove `@tiptap/extension-history` (Yjs has its own undo manager). Keep History as a separate, removable extension from the start.

### Code patterns
- **Survey-side renderer**: Use `@tiptap/static-renderer/json/html` (the `json` namespace has zero ProseMirror dependency). Estimated: ~3-4KB gzipped. Alternatively, write a custom ~50-line recursive JSON-to-React walker for ~1-2KB.
- **Image handling**: Upload to R2 via signed URL, store `r2://key` in TipTap JSON node. Resolve to signed read URL at render time (server-side replacement in RSC).
- **Answer piping**: Use a custom `answerPipe` node extension (atom node, `inline: true`) with TipTap's suggestion plugin triggered by `{` character.
- **Server-side validation**: Validate TipTap JSON against an allowlist of node types (`doc`, `paragraph`, `text`, `image`, `answerPipe`) and mark types (`bold`, `italic`, `link`). Reject unknown types.
- Set application-level prompt size limit of ~64KB via Zod.

### Bundle / performance
- Admin editor: ~45-60KB gzipped (admin-only)
- Survey renderer (json/html): ~3-4KB gzipped (well under 8KB target)
- Custom renderer (no TipTap dependency): ~1-2KB gzipped
- Editor mount time: 50-150ms with minimal extensions (vs. 150-300ms with StarterKit)

### Plan edits needed
- **2a.4 task**: Replace `@tiptap/starter-kit` with individual extensions list: `@tiptap/extension-document`, `@tiptap/extension-paragraph`, `@tiptap/extension-text`, `@tiptap/extension-bold`, `@tiptap/extension-italic`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-history`, `@tiptap/extension-placeholder`, `@tiptap/extension-bubble-menu`, `@tiptap/static-renderer`.
- **2a.4 task**: Add "Create `app/src/lib/sanitize.ts` with `sanitizeUrl()` and `escapeHtml()` functions for TipTap content."
- **2a.4 task**: Add "Validate TipTap JSON server-side against allowlisted node/mark types."
- **2a.4 task**: Change renderer approach from "Renders TipTap JSON to React elements (not dangerouslySetInnerHTML)" to "Use `@tiptap/static-renderer/json/html` with custom mappings, or a zero-dependency JSON walker."
- **2a.4 schema**: Add `promptPlain String?` alongside `promptRichText Json?` for search/indexing.
- **2a.6 template model**: Standardize field names -- use `prompt`/`promptRichText` on `QuestionTemplate` to match `Question` model (not `promptText`/`promptRich`).

---

## 3. Zustand + Zundo (Undo/Redo)

### Best practices to add to plan tasks (2a.1, 2a.2)
- Use the **slices pattern** for code organization while keeping a single store. Multiple stores break undo/redo because zundo operates per-store.
- Use `partialize` to track only data mutations. Exclude: `selectedQuestionId`, `isSaving`, `saveError`, `lastSavedAt`, `isDirty`, `editorView`, drag-and-drop state.
- Use `handleSet` with `lodash.throttle` at 1000ms to prevent keystroke-level history spam.
- Use `subscribeWithSelector` middleware wrapping `temporal` for selective autosave subscription.
- Use `onSave` callback to set `isDirty: true`.
- For destructive actions (delete), show a toast with "Undo" button. If undo happens within the debounce window, the save never fires with the deletion.
- Batch operations into a single `set()` call for single undo step (e.g., "delete all screening questions" = one undo).

### Gotchas / pitfalls
- **History limit is unlimited by default**. Set `limit: 50` explicitly. At 50 questions x ~2KB each, 50 snapshots = ~5MB. Without a limit, memory grows unboundedly.
- `JSON.stringify` equality check is acceptable for moderate state. For larger states (50+ questions with rich text), consider `fast-deep-equal`.
- Middleware ordering matters: `subscribeWithSelector(temporal(...))`. Not the other way around.
- **The client is the source of truth during editing.** Server rejections should surface as inline errors, NOT automatic state reversals. Do not use React Query's optimistic update rollback pattern here.
- **Save on view switch and beforeunload.** If the user switches to flow view before the debounce fires, changes could be lost on refresh. Add `debouncedSave.flush()` on view switch and `beforeunload`.

### Code patterns
- Reactive undo/redo button state: Use `useStoreWithEqualityFn(useEditorStore.temporal, selector)` -- plain `getState()` does not re-render.
- Autosave: `useEditorStore.subscribe` with `lodash.debounce` at 2000ms, independent of history.
- Save failure: Retry on 5xx with exponential backoff (3 retries). Do NOT retry on 4xx (validation failures).
- Use `react-hotkeys-hook` for keyboard shortcuts (not raw `useEffect` with `keydown`). It handles: focus scope, input element detection, modifier normalization, cleanup.
- `mod+z` / `mod+shift+z` must NOT fire when focus is in `<input>` / `<textarea>` -- browser handles text undo there. `react-hotkeys-hook` does this by default.
- `mod+s` SHOULD fire even from inputs (use `enableOnFormTags: true`).

### Bundle / performance
- `zustand`: ~1KB gzipped (already shared with React Flow internally)
- `zundo`: ~700 bytes gzipped
- `react-hotkeys-hook`: ~2KB gzipped
- `lodash.throttle` + `lodash.debounce`: ~1KB gzipped total
- Total: ~5KB additional

### Plan edits needed
- **2a.1 task**: Change store file path from `app/src/stores/editor-store.ts` to `app/src/lib/stores/editor/index.ts` with slices pattern (types.ts, slices/questions.ts, slices/study.ts, slices/ui.ts, hooks.ts, autosave.ts).
- **2a.1 task**: Add "`partialize` in temporal config to exclude UI state fields from history tracking."
- **2a.1 task**: Add "`handleSet` with `lodash.throttle` at 1000ms" to prevent keystroke-level history entries.
- **2a.1 task**: Add "Set `limit: 50` on temporal middleware."
- **2a.1 task**: Add "`debouncedSave.flush()` on view switch and `beforeunload`."
- **2a.1 task**: Remove soft-delete migration -- zundo's snapshot-based undo handles deletion restoration on the client. Server-side: the autosave sync sends the current questions array, so if undo happens before the save fires, no server-side soft-delete is needed. Simplifies the approach significantly.
- **2a.2 task**: Change "Add keyboard listener layer" to "Install `react-hotkeys-hook` and build `EditorKeyboardShortcuts` component."
- **2a.2 task**: Add "Place `EditorKeyboardShortcuts` inside `StudyEditor` layout; renders nothing, just registers shortcuts."

---

## 4. Motion (formerly Framer Motion)

### Critical: Package name change
- **The package is now called `motion`, NOT `framer-motion`.** The rename happened in late 2024. Import from `"motion/react"`, not `"framer-motion"`.
- Install: `npm install motion`

### Best practices to add to plan tasks (2b.1)
- Use `LazyMotion` with `domAnimation` on the survey side (~19.6KB gzipped: 4.6KB base + 15KB features). Use `m` components (from `"motion/react-m"`), not full `motion` components.
- Set `strict` prop on `LazyMotion` to throw if full `motion` components sneak into the survey bundle.
- Use `LazyMotion` with `domMax` on the admin side (layout animations, drag supported).
- Wrap each route group layout with the appropriate `LazyMotion` provider.
- Use `MotionConfig reducedMotion="user"` globally to respect OS reduced motion settings.
- For reduced motion: replace slide/scale with simple opacity fades at 150ms (not zero animation).
- Use springs for enter animations (interruptible, organic). Use ease curves for exit animations (quick departure).

### Gotchas / pitfalls
- **`layoutId` requires `domMax`** (+25KB). Restrict `layoutId` to admin side only. On survey side, simulate with `AnimatePresence` + coordinated enter/exit.
- Only animate `transform` and `opacity` (compositor-thread properties). Never animate `width`, `height`, `padding`, `margin` (triggers layout recalculation). Exception: progress bar `width` is acceptable (simple element, no children).
- `AnimatePresence mode="wait"` ensures exit completes before enter starts. Use this for question transitions.
- All motion components require `"use client"` directive.
- Async feature loading (`import("motion/dom-animation")`) defers the 15KB until after hydration -- best for initial paint.

### Alternative consideration
- The performance review suggests replacing Motion entirely on the survey side with CSS transitions + Web Animations API (WAAPI) for ~1KB total. Typeform's respondent bundle uses zero animation libraries.
- **Recommendation**: Keep Motion for the survey side if AnimatePresence exit animations are a must-have (CSS cannot animate elements being removed from DOM). But if exit animations can be approximated with CSS class toggles + `transitionend` listeners, drop Motion from the survey bundle entirely.

### Code patterns
- Spring presets: snappy (300/30), gentle (200/25), bouncy (400/15), quick (500/35)
- Question transition: `AnimatePresence mode="wait"` with `custom={direction}` for forward/back
- Micro-interactions: `whileTap={{ scale: 0.97 }}`, `whileHover={{ scale: 1.02 }}`
- Centralized animation config in `lib/animations.ts`

### Bundle / performance
- Full `motion` component: ~34KB gzipped
- `m` + `LazyMotion` + `domAnimation`: ~19.6KB gzipped (survey target)
- `m` + `LazyMotion` + `domMax`: ~29.6KB gzipped (admin)
- `useAnimate` only: ~2.3KB gzipped
- CSS alternative: 0KB

### Plan edits needed
- **2b.1 task**: Change "Install Framer Motion: `framer-motion`" to "Install Motion: `npm install motion`. Import from `'motion/react'`, not `'framer-motion'`."
- **2b.1 task**: Add "Wrap `(survey)` layout with `<LazyMotion features={domAnimation} strict>` and use `m` components. Wrap `(admin)` layout with `<LazyMotion features={domMax}>`."
- **2b.1 task**: Change "`layoutId` on question container" to "Do NOT use `layoutId` on survey side (requires `domMax`). Use `AnimatePresence mode='wait'` with coordinated enter/exit variants instead."
- **2b.1 task**: Add "Add `<MotionConfig reducedMotion='user'>` globally."
- **2b.1 task**: Add "Create `app/src/lib/animations.ts` with centralized spring presets and variant definitions."

---

## 5. Dial Slider UX

### Best practices to add to plan tasks (2b.2)
- **Pointer capture is mandatory**: Use `setPointerCapture(e.pointerId)` on `pointerdown`. Without it, fast dragging causes the pointer to leave the thumb, breaking the drag. This is the single most important interaction fix.
- Set `touch-action: none`, `overscroll-behavior: contain`, `user-select: none` on the slider container.
- Add 20px+ padding from screen edges to avoid triggering iOS swipe-to-navigate gestures.
- Use ARIA slider pattern: `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` with semantic labels ("Slightly positive, 62").
- Keyboard: ArrowLeft/Right = step 1, PageUp/Down = step 10, Home/End = min/max.
- Screen reader: Debounced live region announcements every 5 seconds (not on every value change). Set `aria-live="off"` on the slider itself.
- Touch target: 48x48 CSS px minimum visible thumb, 56px invisible hit area via `::before` pseudo-element.

### Gotchas / pitfalls
- **3-second inactivity warning is too aggressive.** Research recommends 5 seconds for gentle nudge, 10 seconds for warning, 20 seconds for quality flag. Respondents may deliberately hold steady during stable content.
- **Never pause video due to inactivity** -- disrupts viewing experience and makes data incomparable.
- **Do not show inactivity warnings before first slider interaction.**
- `navigator.vibrate()` does NOT work on iOS Safari. Use `ios-haptics` library for cross-platform haptic feedback (exploits Safari 17.4+ checkbox switch trick). Falls back gracefully on unsupported devices.
- YouTube TOS **prohibit** disabling seeking or modifying player controls. Seek prevention is only for self-hosted HTML5 video.
- For HTML5 seek prevention, use a delta threshold of 0.5 seconds (not 0.01) to avoid false positives from normal playback timing fluctuations.

### Code patterns
- Color-mapped thumb: compute RGB from value (red at 0, yellow at 50, green at 100 for sentiment; light blue to navy for intensity). Use a colorblind-safe blue-orange diverging palette as alternative.
- Sparkline: Canvas element, 200x32px, `aria-hidden="true"`, last 10-15 seconds of values. Only redraw when dial value changes or once per second (not every video frame).
- Endpoint resistance: CSS spring cubic-bezier (0.34, 1.56, 0.64, 1) with 2px translate overshoot.
- Audio chime: Web Audio API sine wave, 880Hz gliding to 1320Hz, gain 0.05, 400ms duration. Initialize AudioContext on play button click (requires user gesture).

### Plan edits needed
- **2b.2 task (keyboard)**: Change step sizes: Arrow = 1, Shift+Arrow = 10 should be PageUp/Down = 10 (ARIA pattern). Add Home/End = 0/100.
- **2b.2 task (keyboard)**: Add `aria-valuetext` with semantic labels and a separate debounced `aria-live="polite"` region.
- **2b.2 task (haptic)**: Add "Install `ios-haptics` for cross-platform haptic feedback. Use `navigator.vibrate()` as fallback on Android only."
- **2b.2 task (inactivity)**: Change thresholds from "3s -> 6s -> 9s" to "5s gentle nudge, 10s warning, 20s quality flag."
- **2b.2 task (seek)**: Add "Set `touch-action: none` and `overscroll-behavior: contain` on slider container. Add 20px edge padding on mobile."
- **2b.2 task**: Add "Use `setPointerCapture()` on `pointerdown` for smooth cross-boundary dragging."

---

## 6. Real-Time Dashboards (Supabase Realtime + Recharts)

### Best practices to add to plan tasks (2c.1, 2c.2)
- **Use Broadcast with database triggers**, NOT `postgres_changes`. The `postgres_changes` approach checks RLS for every subscriber on every change -- does not scale. Create a PostgreSQL trigger that calls `realtime.broadcast()`.
- Auth must be set before subscribe: `supabase.realtime.setAuth().then(() => channel.subscribe(...))`.
- Buffer real-time events in a ref and flush to React state on an interval (2 seconds). Do NOT push every event directly to state.
- Do NOT re-run full aggregation on every Realtime event. Maintain client-side running tallies and apply incremental updates. Full re-fetch only every 30 seconds as consistency check.
- Use `startTransition` (React 19) to defer chart updates so they don't block user interaction.
- Memoize chart components with `React.memo`. Only re-render charts that have new data (use questionId from Realtime event).
- Disable Recharts animation after initial render (set `isAnimationActive={false}` after 1 second) to prevent distracting re-animation on data updates.

### Gotchas / pitfalls
- **Recharts v3 breaks `recharts-to-png` compatibility.** Pin to `recharts@^2.15` for stable chart export.
- Recharts uses React components for every SVG element. Fine for bar/pie charts, but for dial playback with 300+ data points at 30fps, React reconciliation becomes a bottleneck. Keep existing Canvas implementation for `DialPlayback.tsx`.
- Supabase Realtime `private: true` channels require RLS policies on `realtime.messages` table.
- Add a connection status indicator (SUBSCRIBED / CLOSED / reconnecting) in the dashboard UI.
- For Sankey/respondent flow diagrams: use `d3-sankey` (~8KB) instead of Recharts Sankey (poorly documented, limited customization).

### Code patterns
- `useBufferedRealtime<T>` hook: buffer events in ref, flush on interval, merge function
- Animated number transitions: Use pure `requestAnimationFrame` approach (~0KB), not Motion. Ease-out cubic interpolation.
- Cross-tabulation: Single raw SQL query with self-join, not multiple Prisma queries. Add composite index `@@index([questionId, responseId])` on Answer.
- Individual trace overlay: Use `Path2D` objects (created once, redrawn cheaply), not rebuilding paths each frame. Server-side random sampling: `ORDER BY RANDOM() LIMIT 100` on response IDs.
- Statistical tests: Implement Welch's t-test and chi-squared test in `lib/statistics.ts` (zero dependencies, ~200 lines). Or use `simple-statistics` library for tested implementations.

### Bundle / performance
- `recharts@^2.15`: ~45KB gzipped (admin-only)
- `d3-sankey`: ~8KB gzipped (admin-only)
- `@anthropic-ai/sdk`: ~15KB (server-only, zero client impact)
- Individual chart components via tree-shaking: ~12KB for bar+line+tooltip

### Plan edits needed
- **Decision 7**: Change "Subscribe to Response table inserts/updates via Supabase Realtime channels" to "Use Broadcast with database triggers (not `postgres_changes`). Create PostgreSQL trigger that calls `realtime.broadcast()`."
- **2c.1 task**: Add "Create database migration with trigger function `notify_response_created()` that broadcasts to study-specific channel."
- **2c.1 task**: Add "Buffer Realtime events client-side and flush to state every 2 seconds. Do NOT push each event directly to React state."
- **2c.1 task**: Add "Maintain client-side running tallies; full re-fetch every 30 seconds as consistency check."
- **2c.2 task**: Add "Pin `recharts@^2.15` (v3 breaks chart export). Keep Canvas rendering for `DialPlayback.tsx`."
- **2c.2 task**: Add "Use `d3-sankey` (~8KB) for respondent flow visualization, not Recharts Sankey."
- **2c.3 task**: Add "Cross-tab as single SQL self-join with composite index `@@index([questionId, responseId])` on Answer."

---

## Technology Swap Recommendations

| Current Plan | Recommended Change | Reason |
|---|---|---|
| `framer-motion` | `motion` (same library, new name) | Package renamed in late 2024. `framer-motion` is the old name. |
| `@tiptap/starter-kit` | Individual extensions | 30-40% smaller admin bundle. StarterKit includes 10+ unnecessary extensions. |
| `postgres_changes` for Realtime | Broadcast with DB triggers | `postgres_changes` does not scale -- checks RLS per subscriber per change. |
| `navigator.vibrate()` only | `ios-haptics` library + `navigator.vibrate()` fallback | `vibrate()` is Android-only. `ios-haptics` covers iOS Safari 17.4+. |
| 3s inactivity threshold | 5s / 10s / 20s tiered thresholds | 3s is too aggressive; respondents may deliberately hold steady. |
| `recharts` (latest) | `recharts@^2.15` (pinned) | v3 breaks `recharts-to-png` export compatibility. |
| No alternative considered for Motion on survey side | Consider CSS + WAAPI (~1KB) vs Motion (~19.6KB) | If exit animations can be approximated without AnimatePresence, saves ~18KB on survey bundle. |

---

## Version Requirements & Compatibility (2026)

| Package | Minimum Version | Compatibility Notes |
|---|---|---|
| `@xyflow/react` | v12+ | React 19 support. v12 changed node dimension API (`node.measured`). |
| `@tiptap/react` | v3.20+ | React 19 support. v2 has blocking React 19 incompatibility. |
| `zustand` | v5+ | React 19 support. Must match version React Flow uses internally. |
| `zundo` | v2+ | Supports both Zustand v4 and v5. |
| `motion` | v12+ | React 19 support. Import from `"motion/react"`. |
| `recharts` | ^2.15, NOT v3 | v3 breaking changes affect export. |
| `react-hotkeys-hook` | v4+ | React 19 compatible. |
| `@dagrejs/dagre` | v1+ | No React dependency, always compatible. |
| `d3-sankey` | v0.12+ | No React dependency. |
| `ios-haptics` | latest | Safari 17.4+ required (iOS 17.4+, March 2024). |

---

## Bundle Budget Summary

### Survey bundle (target: <90KB gzipped)
| Component | Size | Notes |
|---|---|---|
| Current baseline | ~65KB | Existing app code |
| Motion (`m` + `domAnimation`) | ~19.6KB | With `LazyMotion strict` |
| TipTap renderer (json/html) | ~3-4KB | Zero ProseMirror dependency |
| **Total** | **~88KB** | Tight but achievable |
| Without Motion (CSS + WAAPI) | **~69KB** | Comfortable margin |

### Admin bundle (no strict target)
| Component | Size |
|---|---|
| React Flow | ~45KB |
| Dagre (lazy) | ~40KB |
| TipTap editor | ~45-60KB |
| Recharts (tree-shaken) | ~12-45KB |
| Motion (domMax) | ~29.6KB |
| Zustand + zundo | ~2KB |
| d3-sankey | ~8KB |
| **Total new deps** | **~180-230KB** |

Admin bundle additions are significant but acceptable for a desktop-first admin tool with route-level code splitting.
