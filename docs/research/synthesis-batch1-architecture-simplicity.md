# Synthesis: Architecture Review + Simplicity Review

**Source**: `recovered-deepen-research.md` lines 2999-3310
**Date**: 2026-03-08
**Purpose**: Actionable decisions for editing the V2 plan

---

## Key Findings

### Both reviews agree on:
- **Framer Motion must be removed from the survey bundle.** Architecture says it blows the 90KB budget (~32KB for AnimatePresence alone). Simplicity says CSS transitions already work. Use CSS View Transitions API or `@starting-style` instead. Zero bundle cost.
- **Testing/CI must move earlier.** Architecture says 2a.0 (before everything). Simplicity says write tests alongside features, not as a separate phase. Both agree: do not defer to 2d.4.
- **Zustand is the right choice.** Both endorse it. Lightweight, fits the single-store editor pattern.
- **CSS custom properties for themes is excellent.** Zero runtime cost, correct approach.
- **ThemeProvider must be a Server Component** rendering a `<style>` tag, not a Client Component with `useEffect`.

### Architecture review flags (technical correctness):
- **Soft-delete breaks `@@unique([studyId, order])`** — must add partial unique index `WHERE deletedAt IS NULL` or redesign ordering
- **React Flow must use controlled mode only** — Zustand is source of truth, React Flow is derived view; plan does not address dual-state problem
- **Supabase Realtime has N-squared message problem** — 500 respondents = 500 Answer inserts all broadcast to every admin; use broadcast channels or `study_events` table instead of database change subscriptions
- **AuditLog conflates compliance and version history** — separate `QuestionVersion` model needed; every debounced autosave creating audit entries will bloat the table
- **QuestionTemplate needs a `version` field** for schema evolution when QuestionType changes
- **TipTap renderer is 8-12KB, not 5KB** — must build custom JSON-to-React mapper, not use `@tiptap/react`
- **Zustand store needs explicit hydration pattern** — Server Component fetches, thin Client Component calls `setState` on mount; no async actions for initial load
- **Missing error boundaries** — React Flow, TipTap, Realtime dashboard, AI summary each need their own ErrorBoundary
- **Missing shared type definitions** — duplicate types across editor/survey/results; extract canonical types from Prisma before adding Zustand
- **Missing API client abstraction** — no typed `lib/api/client.ts`; needed for autosave retry logic
- **CSP needs updating** for Framer Motion inline styles, TipTap, React Flow
- **AI summaries should use real streaming** (`ReadableStream` from route handler), not fake client-side character animation
- **Recharts has performance issues** with large datasets (re-renders entire SVG); consider `@visx/visx` for dial chart specifically

### Simplicity review flags (scope cuts):
- **React Flow is YAGNI** — 5-30 question surveys do not need a node graph; list editor with DnD is correct for this scale
- **TipTap is overkill** — bold/italic/link does not require ProseMirror; use markdown rendering instead
- **Recharts is unnecessary** — hand-built charts already work and match brand; refactor into per-type files instead
- **zundo (undo/redo middleware) is over-engineered** — "undo last delete" toast covers 95% of need
- **Command palette is gold-plating** — 5-15 question surveys do not need Cmd+K
- **QuestionTemplate model is premature** — low-frequency use; build when someone asks
- **Cross-study copy/paste is premature** — duplicate within study is enough
- **Answer piping: defer** until a study actually needs it
- **Question randomization: defer** until a study actually needs it
- **AI summaries: defer entirely** from V2 — 2-hour feature when actually needed
- **Multi-user collaboration: cut** — 1-3 admin users do not need RBAC
- **Version history: cut** — git + undo-delete covers this
- **Dark mode: cut** — zero client-facing value
- **Vertical dial mode: cut** — doubles testing surface for marginal benefit
- **Haptic feedback: cut** — negligible perceived value
- **Mini trail graph: cut** — distracting for respondents
- **Audio inactivity chime: cut** — will annoy people
- **Animated GIF export: cut** — PNG export already exists
- **Real-time monitoring: cut** — surveys are async; refresh the page
- **Sankey diagram: cut** — over-visualization
- **Statistical significance: defer** — meaningful only at scale (n>100 per segment)

---

## Conflicts Between Reviews

| Topic | Architecture Review | Simplicity Review | Decision Needed |
|-------|-------------------|-------------------|-----------------|
| **React Flow** | Keep, but must use controlled mode; moderate risk | Cut entirely; YAGNI for 5-30 question surveys | **Simplicity wins.** The controlled-mode complexity confirms it is too much machinery for this scale. Replace with optional read-only flow SVG or skip entirely. |
| **TipTap** | Keep, but build custom lightweight renderer (not @tiptap/react); realistic 8-12KB | Cut entirely; use markdown rendering (~20 lines) | **Simplicity wins for V2.** Markdown covers the actual need (bold/italic/link). TipTap can be added later if clients demand inline images in prompts. |
| **Recharts** | Adequate but not ideal; consider @visx for dial chart | Cut entirely; refactor hand-built charts into per-type files | **Simplicity wins.** Refactor is the real fix. Hand-built charts already match brand. |
| **zundo** | Correct choice; one concern about re-renders (use slices/selectors) | Over-engineered; "undo last delete" toast is enough | **Simplicity wins.** Full history stack is not justified for a form editor. Keep Zustand, drop zundo. |
| **Supabase Realtime** | Keep but fix architecture (broadcast channels, not DB subscriptions) | Cut real-time monitoring entirely; surveys are async | **Simplicity wins for V2.** Async surveys do not need live dashboards. Defer Realtime entirely. |
| **AI Summaries** | Keep but add real streaming | Cut from V2 entirely; trivial to add later | **Simplicity wins.** Defer. |
| **Testing scope** | 80%+ coverage on lib/, E2E for happy paths, moved to 2a.0 | Keep but scope down; write alongside features | **Compromise.** Set up Vitest + CI in 2a.0. Write tests alongside each utility module. Skip E2E until after core features ship. |
| **Flow builder position** | Should be last item in 2a (highest risk); treat as stretch goal | Cut entirely | **Simplicity wins.** Cut. |

---

## Specific Plan Changes by Phase

### Phase 2a (Editor Revolution)

**KEEP:**
- 2a.1: Zustand store (but drop zundo; implement "undo last delete" toast instead)
- 2a.1: Debounced autosave with save indicator
- 2a.1: Soft-delete on Question (**but fix unique constraint**: partial unique index `WHERE deletedAt IS NULL`)
- 2a.3: Split-pane editor with live preview (highest-impact feature)
- 2a.7: Extract QuestionEditor into per-type config components
- 2a.7: Editor animation polish (CSS, not Framer Motion)

**ADD (from architecture review):**
- **2a.0: CI/testing setup** — GitHub repo, GitHub Actions (type-check + lint + build), install Vitest
- **2a.0: Extract canonical types from Prisma** — create `lib/types/study.ts`, `lib/types/question.ts`; eliminate duplicate type definitions before adding Zustand
- **2a.1: Zustand hydration pattern** — specify Server Component fetch -> thin Client Component `setState` on mount
- **2a.1: Error boundaries** — wrap major subsystems (live preview at minimum) in ErrorBoundary with fallback UI
- **2a.1: Autosave failure handling** — specify retry queue or toast with manual retry when server save fails
- **2a.1: Zustand selectors from day one** — avoid single-subscriber re-render problem

**CUT:**
- 2a.2: Command palette (Cmd+K)
- 2a.2: zundo temporal middleware (replace with simple undo-delete toast)
- 2a.4: TipTap (replace with markdown rendering: `**bold**`, `*italic*`, `[link](url)`)
- 2a.4: `promptRichText` JSON column (not needed with markdown approach)
- 2a.5: React Flow visual flow builder (entire section)
- 2a.5: `flowLayout` JSON field on Study model
- 2a.6: Cross-study copy/paste via clipboard
- 2a.6: QuestionTemplate model + template browser
- 2a.6: Bulk editing (multi-select + bulk actions)

**SIMPLIFY:**
- 2a.2: Keep keyboard shortcuts but scope to: Cmd+Z (undo delete), Cmd+S (force save), Cmd+D (duplicate), Escape (deselect), Arrow Up/Down (navigate questions)
- 2a.4: Replace with lightweight markdown support — 20-line renderer function, no new DB column, no new dependency
- 2a.6: Keep only "Duplicate question within study" (Cmd+D)

**Revised 2a duration: ~5-6 days** (down from 8-10)

---

### Phase 2b (Survey Experience Polish)

**KEEP:**
- 2b.2 (partial): Dial keyboard accessibility (Arrow keys, ARIA attributes, focus ring) — critical gap
- 2b.2 (partial): HTML5 video seek protection (parity with YouTube)
- 2b.2 (partial): Bigger mobile thumb (`w-9 h-9`)
- 2b.3: Theme engine (CSS custom properties, color pickers, logo upload, presets)
- 2b.6 (partial): Estimated completion time
- 2b.6 (partial): Thank you page customization
- 2b.6 (partial): Accessibility audit (axe-core, ARIA, focus rings, skip-to-content)
- 2b.6 (partial): Loading skeleton

**ADD (from architecture review):**
- **ThemeProvider as Server Component** — render `<style>` tag from server, not client-side `useEffect`
- **CSP audit** — verify `style-src` and `img-src` for any new patterns

**CUT:**
- 2b.1: Framer Motion (entire section — use CSS transitions and View Transitions API)
- 2b.2: Haptic feedback (`navigator.vibrate`)
- 2b.2: Mini trail graph (distracting for respondents)
- 2b.2: Glass morphism on dial thumb
- 2b.2: Vertical dial mode
- 2b.2: Audio inactivity chime
- 2b.2: Endpoint resistance/snap (CSS spring at 0/100)
- 2b.2: Animated chart draw-in (analysis side)
- 2b.2: Zoom/pan on dial chart
- 2b.2: Heatmap overlay mode
- 2b.2: Individual respondent traces
- 2b.2: Animated GIF export
- 2b.4: Answer piping (defer — build when a study needs it)
- 2b.5: Question randomization (defer — build when a study needs it)
- 2b.6: Per-question time limits (defer)

**SIMPLIFY:**
- 2b.1: Replace Framer Motion transitions with CSS `@keyframes` + View Transitions API for directional slide transitions. `prefers-reduced-motion` handled via CSS media query.
- 2b.2: Scope to three things: keyboard accessibility, seek protection, bigger mobile thumb

**Revised 2b duration: ~3-4 days** (down from 7-9)

---

### Phase 2c (Intelligent Analytics)

**KEEP:**
- Refactor `QuestionResults.tsx` into per-type chart components (moved from 2a.7 scope)
- Cross-tabulation as a stretch goal (data transformation, not chart library)

**CUT:**
- 2c.1: Supabase Realtime monitoring (entire section — surveys are async)
- 2c.2: Recharts rebuild (hand-built charts work and match brand)
- 2c.2: Sankey diagram / respondent journey
- 2c.3: Statistical significance tests (defer — meaningful at n>100)
- 2c.4: AI summaries (defer — trivial 2-hour feature when needed)
- 2c.4: AISummary database model

**Revised 2c duration: ~2 days** (down from 5-7)

---

### Phase 2d (Collaboration & Platform)

**KEEP:**
- 2d.4 (partial): Git + CI setup (but moved to 2a.0)
- 2d.4 (partial): Vitest test foundation (but written alongside features, not as separate phase)
- 2d.4 (partial): Performance optimization (bundle audit, ISR, pagination)
- 2d.4 (partial): Error monitoring (Sentry)

**ADD (from architecture review):**
- **Rate limiting on any new API routes** — apply existing in-memory limiter from day one
- **Observability** — structured logging consistency, Core Web Vitals monitoring

**CUT:**
- 2d.1: Multi-user roles/invitations/permissions (entire section — 1-3 users)
- 2d.1: StudyMember model
- 2d.1: StudyInvitation model
- 2d.2: Version history via AuditLog (git + undo-delete covers this)
- 2d.3: Dark mode (entire section)
- 2d.4: Upstash Redis upgrade (defer — in-memory limiter is fine at current scale)
- 2d.4: Playwright E2E (defer — add after core features stabilize)

**Revised 2d duration: ~1 day** (down from 4-5, since CI moves to 2a.0)

---

## Revised Total

| Phase | Original Duration | Revised Duration |
|-------|------------------|-----------------|
| 2a | 8-10 days | 5-6 days |
| 2b | 7-9 days | 3-4 days |
| 2c | 5-7 days | 2 days |
| 2d | 4-5 days | 1 day |
| **Total** | **24-31 days** | **11-13 days** |

## Revised Dependencies

| Original | Revised |
|----------|---------|
| zustand + zundo | zustand (drop zundo) |
| @tiptap/react + extensions | None (markdown renderer) |
| @xyflow/react | None (cut React Flow) |
| framer-motion | None (CSS transitions) |
| recharts | None (refactor hand-built charts) |
| @anthropic-ai/sdk | None (defer AI) |
| vitest + testing-library + playwright | vitest + testing-library (defer Playwright) |
| date-fns | date-fns |

**Net new runtime dependencies: 1 (Zustand)**

---

## Architecture Fixes to Apply Regardless of Scope

These are bugs/gaps that must be addressed in any version of the plan:

1. **Soft-delete unique constraint** — partial index `WHERE deletedAt IS NULL` on `@@unique([studyId, order])`
2. **Canonical TypeScript types** — extract from Prisma, eliminate duplicates across editor/survey/results
3. **Zustand hydration pattern** — document Server Component -> Client Component `setState` flow
4. **Error boundaries** — around live preview and any other complex interactive subsystem
5. **Autosave failure handling** — retry logic or toast with manual retry
6. **Rate limiting on new routes** — apply in-memory limiter to any new API endpoints
