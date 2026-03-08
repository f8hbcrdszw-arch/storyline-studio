# Synthesis: TypeScript Patterns, Anti-Patterns, and Race Conditions

Research sources: `recovered-deepen-research.md` (TypeScript patterns review, pattern recognition review, frontend race conditions review).

---

## 1. TypeScript Type Improvements

### 1a. EditorState discriminated union (affects 2a.1)
- **Problem**: `study: StudyData | null` forces null checks everywhere
- **Fix**: Split into `{ status: 'loading' } | { status: 'ready'; study: StudyData; ... }`
- **Or**: Provide `useLoadedEditor()` hook that throws on null

### 1b. Separate EditorData from EditorActions (affects 2a.1, 2a.2)
- **Problem**: Mixing state + actions causes `zundo` to serialize function references into history
- **Fix**: Define `EditorData` (tracked) vs `EditorActions` (not tracked) as separate interfaces; `EditorStore = EditorData & EditorActions`
- Use `partialize` in zundo to track only `EditorData`; exclude `isSaving`, `isDirty`, `lastSavedAt`

### 1c. Discriminated QuestionConfig (affects 2a.1, 2a.6, 2b.4)
- **Problem**: `QuestionConfig` in `json-fields.ts` is a flat bag of optionals from all 11 types -- allows invalid combos (e.g., `likertScale` on a `VIDEO_DIAL`)
- **Fix**: `TypedQuestionData<T>` with `config: QuestionConfigByType[T]` mapped to per-type Zod inferences
- **Priority**: Highest -- affects store, piping, templates, flow builder
- `updateQuestion(id, patch: Partial<QuestionData>)` is dangerously loose; type-narrow patches by question type

### 1d. Branded HexColor type (affects 2b.3)
- **Problem**: `primaryColor: string` accepts `"javascript:alert(1)"` -- correctness + XSS risk
- **Fix**: `type HexColor = string & { __brand: 'HexColor' }` with Zod `.regex(/^#[0-9a-fA-F]{6}$/)`
- Apply to all 4 color fields in `SurveyTheme`

### 1e. Type-safe pipe resolution map (affects 2b.4)
- **Problem**: Plan handles non-pipeable types at runtime; `MULTI_ITEM_RATING` missing from resolution table
- **Fix**: `PipeResolution` mapped type with `never` for non-pipeable types; `resolveToken('VIDEO_DIAL', ...)` becomes compile-time error
- Add `MULTI_ITEM_RATING` to resolution table as `never` (not pipeable)

### 1f. Fix existing `Record<string, ...>` gaps (affects 2a.1)
- `configSchemaByType` in `question.ts` line 121: key should be `QuestionType`, not `string`
- `answerSchemaByType` in `answer.ts` line 60: same fix
- `VALID_TRANSITIONS` in `study.ts`: should be `Record<StudyStatus, readonly StudyStatus[]>`
- These are existing bugs that V2 will amplify

### 1g. React Flow parametric typing (affects 2a.5)
- Use `Node<QuestionNodeData, 'question'> | Node<TerminalNodeData, 'terminal'>` for type-safe node props
- Type `FlowEdge` as `Edge<undefined, 'sequential'> | Edge<SkipEdgeData, 'skip'>`
- Add Zod schema + type for `flowLayout` JSONB field: `z.record(z.string().uuid(), z.object({ x: z.number(), y: z.number() }))`

### 1h. RandomizationConfig tightening (affects 2b.5)
- `scope: 'within_phase'` is dead data if always one value -- remove or document future intent
- `seed?: number` must be constrained: `.int().min(0).max(2_147_483_647)`
- `excludeQuestionIds` should validate as UUID array

### 1i. StatisticalTestResult type (affects 2c.3)
- Add `testName: 'chi-squared' | 'welch-t' | 'mann-whitney-u'` as discriminant
- Add `effectSizeLabel?: 'small' | 'medium' | 'large'` (Cohen's conventions)
- Skip branded types for confidence levels -- overkill for internal functions

### 1j. Permissions matrix as typed constant (affects 2d.1)
- Encode `STUDY_ACTIONS` as `const` array, derive `StudyAction` union type
- `PERMISSIONS: Record<StudyRole, ReadonlySet<StudyAction>>` -- exhaustive, runtime-checked
- Do NOT attempt compile-time role checking

---

## 2. Zod Schema Gaps to Add

### In `study.ts` (affects 2b.3, 2b.5, 2b.6):
- `theme: surveyThemeSchema.optional()` in settings
- `randomization: randomizationConfigSchema.optional()` in settings
- `transitionStyle: z.enum(['slide', 'fade', 'zoom', 'none']).optional()`
- `thankYouPage: thankYouPageSchema.optional()`

### In `question.ts` (affects 2a.4, 2b.2, 2b.6):
- `promptRichText: richTextSchema.optional().nullable()`
- `timeLimitSeconds: z.number().int().min(5).max(3600).optional()`
- `videoDialConfig` additions: `showMiniTrail`, `dialOrientation`

### New schema files:
- `schemas/template.ts` -- validate `QuestionTemplate` CRUD (config validated via `configSchemaByType[type]`)
- `schemas/member.ts` -- validate `StudyMember` + `StudyInvitation`; re-export `StudyRole` via `z.nativeEnum()`

### TipTap rich text schema (affects 2a.4):
- Use TipTap's `JSONContent` type directly; validate loosely at API boundary with `z.object({ type: z.literal('doc'), content: z.array(...).optional() }).passthrough()`
- Do NOT replicate ProseMirror schema in Zod

### Missing JSONB validations:
- `QuestionTemplate.config` and `.options` -- validate via `configSchemaByType[template.type]`
- `AISummary.metadata` -- define `AISummaryMetadata` interface (`model`, `tokensUsed`, `questionsAnalyzed`, `generatedInMs`)
- `Study.flowLayout` -- add Zod schema (see 1g above)

---

## 3. Pattern/Anti-Pattern Findings

### Patterns confirmed correct:
- Zustand mediator for dual view (list + flow) -- not Observer
- CSS custom properties for theme (Strategy pattern)
- Prototype pattern for question templates
- Event Sourcing Lite via audit log (not full CQRS)
- Interpreter pattern for answer piping

### Anti-patterns to warn against / fix:

#### A. Theme CSS: use Tailwind tokens, not arbitrary values (affects 2b.3)
- **Bad**: `bg-[var(--survey-bg)]` -- verbose, breaks Tailwind class scanning
- **Good**: Define `'survey-primary': 'var(--survey-primary)'` in `tailwind.config.ts` colors, then use `bg-survey-bg`

#### B. Token injection in answer piping (affects 2b.4)
- If respondent's open-text answer contains `{{q:...}}`, it could be re-interpreted downstream
- Resolver must NEVER recursively resolve tokens in piped answer values
- Admin UI should warn when piping from same/later phase questions

#### C. QuestionEditor migration must be atomic (affects 2a.1)
- Cannot have some fields in Zustand and others in local `useState` -- split-brain state bug
- Migrate ALL `QuestionEditor` fields to Zustand in a single pass

#### D. LivePreview cross-route import (affects 2a.3)
- `QuestionRenderer` is in `(survey)/` route group; admin `LivePreview` cannot import it without breaking bundle isolation
- **Fix**: Move `QuestionRenderer` to shared `src/components/survey/` location

#### E. God component risk in EditorLayout (affects 2a.3)
- Decompose from start: `PanelResizer.tsx`, `CollapsiblePanel.tsx`, `EditorLayout.tsx` as thin composition
- Same for `QuestionResults.tsx` decomposition (2c.2)

#### F. Config component registry pattern (affects 2a.7)
- Replace scattered `Set` definitions (`LIKERT_TYPES.has(...)`) with `CONFIG_COMPONENTS: Record<QuestionType, ComponentType<ConfigProps>>`

#### G. Naming inconsistencies to fix before building:
- `QuestionTemplate` uses `promptText`/`promptRich`; `Question` uses `prompt`/`promptRichText` -- standardize to `prompt`/`promptRichText`
- `AISummary.metadata` overloads the name used in `Response.metadata` and `AuditLog.metadata` -- consider `generationInfo` or `aiMetadata`
- Consider renaming `AISummary` model to `StudyAiSummary` (no acronym prefixes in current schema)

#### H. requireStudyAccess middleware (affects 2d.1)
- All routes currently check `createdBy: auth.userId` -- must become centralized `requireStudyAccess(studyId, userId, minimumRole)` helper
- Extract to `lib/middleware/` alongside existing `requireAdmin.ts`
- Do NOT repeat membership checks in every route handler

#### I. Audit log gaps (affects 2d.2)
- Snapshots must include full denormalized question (options, config, skip logic) -- not just the question row
- Version snapshot format: `{ schemaVersion: 1, data: {...} }` for future schema migrations
- Add retention policy (90 days or 100 entries per study)
- Document undo boundary: Zustand undo = within session; audit log restore = across sessions

#### J. Undelete endpoint missing (affects 2a.1, 2d.2)
- Plan adds `deletedAt` for soft-delete but no undelete API
- Add `PATCH /api/questions/[id]/restore` endpoint to clear `deletedAt`

#### K. Font loading for theme engine (affects 2b.3)
- 4 font families in theme = all must be loaded in survey layout for runtime switching
- Limit to 2 choices (brand + system) for initial release, or lazy-load non-brand font CSS

#### L. Framer Motion may be unnecessary (affects 2b.1)
- All described micro-interactions (32ms scale bounce, gradient shifts) are CSS transitions
- Only `AnimatePresence` (exit animations) truly needs JS
- Consider: CSS transitions + `@starting-style` + 40-line `element.animate()` utility instead of 32KB dependency
- If keeping Framer Motion, ensure survey bundle stays under 90KB target

#### M. Statistics library (affects 2c.3)
- Hand-rolling chi-squared, Welch's t, Mann-Whitney U is error-prone
- Use `simple-statistics` or `jstat` instead -- incorrect p-values worse than no testing

---

## 4. Race Conditions with Mitigations

### CRITICAL

#### Race 1: Autosave vs Undo/Redo -- undo clobber (affects 2a.1, 2a.2)
- **Scenario**: Edit at T=0, debounce starts, Cmd+Z at T=1200ms reverts store, debounce fires at T=1500ms with pre-undo state from closure
- **Result**: Silent data corruption -- undone change written to server
- **Fix**: (a) Read state at fire time, not schedule time; (b) Undo/redo cancels pending debounce + reschedules; (c) AbortController for in-flight requests

#### Race 2: Cmd+Z during in-flight save (affects 2a.2)
- **Scenario**: Cmd+S fires save, user hits Cmd+Z, save resolves and clears `isDirty` even though store no longer matches server
- **Fix**: Version counter on state -- increment on every mutation; on save resolve, only clear `isDirty` if version matches

### HIGH

#### Race 3: Dial slider pointer events during buffering (EXISTING BUG in VideoDial.tsx)
- **Scenario**: `isBuffering` is React state (async); `handleTimeUpdate` reads stale `false` during render gap between `onBuffering(true)` and re-render
- **Result**: Data points recorded for seconds where video was stalled
- **Fix**: Use `useRef` for buffering gate (synchronous); keep `useState` for UI only
- Also fix: `DialSlider.tsx` `disabled` prop propagation too slow for real-time pointer gating

#### Race 4: Mini-trail canvas render loop vs pointer events (affects 2b.2)
- **Scenario**: `requestAnimationFrame` loop reads stale `feedback` state while pointer handler writes
- **Result**: Canvas shows stale data; ghost frame crash on unmount
- **Fix**: Ref-backed circular buffer (`Float32Array`); cancel token for rAF cleanup on unmount

#### Race 5: Real-time dashboard event flood (affects 2c.1)
- **Problem**: Plan says "debounce" but should say "throttle"
- **Debounce**: No update until burst stops (30+ seconds with panel provider)
- **Throttle**: Update at most every 5s with `leading: true, trailing: true`
- Also add in-flight guard to prevent concurrent fetch races

#### Race 6: Answer piping with stale previous answers (affects 2b.4)
- **Scenario**: Back-navigate, change answer, forward-navigate -- pipe resolver reads from stale closure
- **Fix**: Resolve pipes in `useMemo` during render (not `useEffect`); include `answersVersion` in component key to force re-resolution

#### Race 7: Seek prevention during buffering transition (affects 2b.2)
- **Scenario**: Browser adjusts `currentTime` during buffer; seek guard fights it -> infinite loop
- **Fix**: Disable seek detection while `isBufferingRef.current === true`; update `lastKnownTimeRef` during buffering so no false positive on resume

#### Race 8: React Flow node drag + concurrent store update (affects 2a.5)
- **Scenario**: Adding a question via shortcut during drag changes `items` array mid-drag; indices shift
- **Fix**: Use React Flow uncontrolled mode for positions; sync to Zustand only on `onNodesChange` with `dragging === false`

### MEDIUM

#### Race 9: TipTap IME composition during autosave (affects 2a.4)
- **Scenario**: CJK/autocorrect composition in progress; debounce fires with intermediate JSON state
- **Fix**: Check `editor.view.composing` before syncing to Zustand; skip update if composing

#### Race 10: Theme color picker rapid changes (affects 2b.3)
- **Scenario**: 60+ events/sec from color picker drag; each touches Zustand -> 400 undo history entries for one drag
- **Fix**: Separate preview (CSS variable via rAF) from commit (Zustand store on drag end); use `zundo` `handleSet` to coalesce rapid changes

#### Race 11: Randomization seed vs question list changes on resume (affects 2b.5)
- **Scenario**: Respondent resumes survey; questions changed since last session; seeded shuffle of different-length array produces completely different order
- **Fix**: Store resolved question order (`string[]`) in Response record, not just seed; on resume use stored order directly

#### Race 12: Clipboard paste during DnD (affects 2a.6)
- **Scenario**: Paste creates new question mid-drag; `SortableContext` items change; indices break
- **Fix**: Reject all mutations while `isDragging === true`; gate keyboard shortcuts too (`Cmd+N`, `Cmd+D`, `Cmd+Backspace`)

---

## 5. Existing Bugs to Fix Before V2

1. **`VideoDial.tsx` line 79**: `isBuffering` React state used as sync gate -> use ref (Race 3)
2. **`VideoDial.tsx` lines 64-74**: Signed URL fetch has no AbortController -> unmount leak
3. **`VideoDial.tsx` line 86**: `isBuffering` in `handleTimeUpdate` dependency array causes unnecessary re-renders -> remove with ref fix
4. **`DialSlider.tsx` line 23**: `getValueFromPosition` has unnecessary `value` dependency -> removes it to stabilize callback identity
5. **`StudyEditor.tsx` line 119**: `handleDragEnd` fires unguarded reorder fetch; two quick drags race -> add AbortController or sequence counter

---

## 6. Architectural Recommendations

### A. Editor state machine (affects 2a.1, 2a.2, 2a.6)
- Define `editorMode: 'idle' | 'saving' | 'dragging' | 'undoing'` in store
- Gate mutations by mode: most only valid in `idle`
- Prevents boolean soup (`isSaving && isDragging && isPasting`)

### B. AbortController registry (affects 2a.1, 2b.2, 2c.1, 2c.4)
- Central `AbortRegistry` class with `start(key)`, `cancel(key)`, `cancelAll()`
- Use in Zustand store for autosave, media URL fetches, AI summary, Realtime
- Call `cancelAll()` on page navigation

### C. Save-on-exit guards (affects 2a.1)
- Save on view switch (list <-> flow)
- Save on `beforeunload`
- Visible "Unsaved changes" indicator
- These are not in the plan but required to prevent state loss
