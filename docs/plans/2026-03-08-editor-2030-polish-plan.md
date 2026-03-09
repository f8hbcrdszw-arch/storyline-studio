# Editor 2030: The Storyline Way

> The survey editor that makes Typeform feel like Google Forms.

---

## The Thesis

The 2030 survey editor doesn't have an "edit mode" and a "preview mode." You're always inside the survey. You're always seeing what respondents see. The chrome around it — the sidebar, the toolbar, the settings — exists as a translucent layer that recedes when you're focused and surfaces when you need it. The editing surface and the experience surface are the same surface.

The dial is not a question type. It's our design language. The way Stripe owns the gradient, the way Linear owns the keyboard — Storyline owns the dial. It shows up in how you set values, how you tune settings, how you feel about using the tool.

---

## Design Principles

These aren't aspirations. They're constraints. Every PR gets measured against them.

### 1. Motion earns its frame

No spring config presets. Every animation is tuned to the specific distance, direction, and context of that interaction. A card expanding 200px needs different damping than one expanding 40px. The spring for "I just clicked this" is different from "I just dragged this here." We tune by feel, not by category.

Concretely: when you select a question and the card expands, what happens if you immediately select a different question? The first card doesn't finish its close animation and then the second opens — the first card *redirects* mid-spring toward its closed state while the second begins opening. Both movements happen simultaneously, and the system never feels like it's queuing or waiting. This is the difference between "we use Framer Motion" and "we understand motion."

### 2. Frequency shapes behavior

The interface watches your tempo. Not with AI, not with settings — with simple heuristics that any musician would understand.

- If you've selected 4 questions in the last 10 seconds, you're scanning. Reduce transition durations by 60%. Show less chrome. You're looking for something, get out of the way.
- If you've been on the same question for 30+ seconds, you're crafting. Increase spacing. Show richer editing controls. You're in deep work, give you room.
- If you're rapidly adding options and pressing Enter, you're in flow. Don't animate new options in — just place them. The spring would interrupt your rhythm.

This isn't a mode toggle. It's a continuous spectrum that the user never sees or configures. They just feel it: "this tool gets me."

### 3. The builder is the survey

The question title you're editing IS the question title respondents see. Same font, same size, same weight, same line height. No `<input class="text-sm">` that looks nothing like the final output. You type in the actual rendered space.

This means:
- Title editing is `contentEditable` styled as `text-xl font-medium` — the survey's real typography
- No visible border until hover. On focus, a single-pixel underline slides in from center
- Option text is rendered at survey scale, not admin scale
- The background of the editing area matches the survey theme, not the admin chrome

When you're editing, you're composing. When you step back, you're already looking at the finished product.

### 4. The dial is the brand

The video dial is our differentiator. But right now it's imprisoned in a question type. Free it.

- **Survey settings**: Instead of a dropdown for "survey pacing," a horizontal dial that sweeps from "Quick" to "Thoughtful" — and the preview transitions actually change speed as you drag
- **Likert configuration**: Instead of typing "1-7" into a number input, a dial that you twist to set the scale points, with the preview updating in real-time
- **Results exploration**: The dial metaphor extends to scrubbing through video responses — drag to any moment, see the aggregate sentiment at that second
- **Editor toolbar**: The confidence of the brand shows in small moments — a circular progress indicator for save state, a radial menu for question type selection

The dial isn't an interaction pattern. It's the feeling of precision and continuous control that defines Storyline.

### 5. Details compound

Error pages get the same craft as the hero feature. A 404 page with personality. A rate-limit message that apologizes with warmth. The login page that loads in 200ms and has a subtle brand animation. The email notification that looks as good as the app.

The test: pick any screen in the entire app at random. Does it feel like the same team built it? Does it feel considered? If even one screen feels like an afterthought, the whole product loses trust.

---

## The Sidebar, Reimagined

The sidebar stays. But it transforms from a flat file list into a **living survey map** — a spatial representation of the respondent's journey that you can see, feel, and manipulate directly.

### The Survey Spine

A vertical spine runs down the sidebar — a single continuous line connecting every question. This isn't decoration. It's the respondent's path.

- **Phase regions** are colored bands behind the spine. Not labeled boxes — environmental shifts, like passing through different rooms. Screening has a warm amber wash. Pre-ballot is neutral. Stimulus is rich blue. Post-ballot returns to neutral. You *feel* the survey structure without reading labels.

- **Questions are nodes on the spine**, not cards in a list. Each node shows: a type icon (small, recognizable), the first ~30 characters of the title, and a completion ring (in results mode, showing response rate for that question).

- **Skip logic is visible as branches.** When a question has skip logic, the spine forks — a lighter path branches off to the skip target, and you can see the condition as a tiny label on the branch. For the first time, you can *see* the survey's decision tree without opening a separate flow view.

- **The selected question pulses gently on the spine** — not a harsh highlight, but a soft luminous glow that says "you are here." As you navigate with arrow keys, the glow slides smoothly from node to node.

### Direct Manipulation

- **Drag a node on the spine** to reorder. The spine bends and reforms around the dragged node. Other nodes slide apart with spring physics to reveal the drop zone — the gap opens like a page spreading in a book.

- **Pinch/scroll to zoom the spine.** Zoomed out, you see the entire survey as a minimap — phase colors, density, branching patterns. Zoomed in, you see full question titles and metadata. The zoom level persists per session.

- **Right-click a node** for a radial context menu (not a dropdown): duplicate, delete, move to phase, add question after. The radial menu appears centered on the node, so your mouse is already close to every option (Fitts's law, per Rauno).

- **Multi-select with Shift+click** on nodes. Selected nodes get a shared glow. You can drag the group, delete them, or change their phase in bulk. The spine shows the selection as a highlighted segment.

### The Spine as Respondent Simulator

Click "Walk through" at the bottom of the sidebar. The sidebar enters simulation mode:
- Each node lights up in sequence as if a respondent is taking the survey
- Skip logic branches execute in real time — you see which path the respondent would take
- The editor panel shows each question as the respondent sees it
- You can set simulated answers at each step to test different paths

This replaces a separate "preview" mode. You're previewing *in* the editor, *through* the sidebar.

---

## Phase 1: Motion & Spatial Foundation

### 1a. Context-aware spring system

Not presets — utilities that calculate spring parameters from context:

```typescript
// lib/motion.ts
export function springForDistance(px: number) {
  // Short moves are snappy, long moves need more damping
  const stiffness = Math.max(200, 600 - px * 1.5);
  const damping = Math.max(18, 15 + px * 0.08);
  return { type: "spring" as const, stiffness, damping };
}

export function springForIntent(intent: "select" | "drag" | "dismiss" | "reveal") {
  // Each intent has distinct physical character
  switch (intent) {
    case "select":  return { type: "spring", stiffness: 500, damping: 30 };
    case "drag":    return { type: "spring", stiffness: 200, damping: 20, mass: 1.2 };
    case "dismiss": return { type: "spring", stiffness: 400, damping: 25 };
    case "reveal":  return { type: "spring", stiffness: 350, damping: 28 };
  }
}
```

### 1b. Interruption model

Define what happens when animations collide:

| Scenario | Behavior |
|----------|----------|
| Select question A, then immediately select B | A redirects toward closed state; B begins opening. Both animate simultaneously from their current positions. |
| Start dragging, then release quickly (flick) | Use velocity projection to determine target position. Short flick = snap to nearest valid slot. |
| Click delete while card is still expanding | Card reverses from current position into shrink-and-fade. No waiting. |
| Rapid arrow-key navigation | After 3+ rapid presses, suppress sidebar glow animation. Just move the indicator. Re-enable after 500ms pause. |

### 1c. Depth vocabulary

| Layer | z | Visual | Blur | Example |
|-------|---|--------|------|---------|
| Ground | 0 | Cream bg | — | Page background |
| Surface | 1 | White, `shadow-sm` | — | Question cards, sidebar |
| Raised | 2 | White, `shadow-md`, scale 1.003 | — | Selected card, hovered option |
| Float | 3 | White, `shadow-lg` | bg `blur-sm` | Dragged item, radial menu |
| Overlay | 4 | White, `shadow-xl` | bg `blur-md` + dim | Modals, keyboard shortcuts panel |

Transitions between layers animate shadow AND scale together — never one without the other.

---

## Phase 2: The Editing Surface

### 2a. Borderless content editing

The question title, instructions, and option labels all render at survey scale using survey typography. No input borders visible at rest.

**Title field:**
- `contentEditable` div, styled as the survey's `text-xl font-medium`
- No border, no background change at rest
- On hover: a hairline bottom border fades in at 20% opacity
- On focus: the border slides to full opacity from center outward (CSS `background-size` animation on a pseudo-element)
- Placeholder: `"Ask your question..."` in `text-muted-foreground/30`, italic

**Instructions field:**
- Same borderless treatment but `text-sm text-muted-foreground`
- Collapsed to a single line when empty, expands on focus
- Placeholder: `"Add instructions or context..."`

**Option labels:**
- Each option renders at survey scale
- The option "card" has no border at rest — just the text and a subtle grip dot on the left
- On hover: a hairline border fades in, grip dots become visible
- On focus-within: border at 40% primary color, subtle inner glow

### 2b. Smart type inference

When creating a new question, don't show a type picker first. Show a blank question with a title field.

As the user types, suggest a type:
- `"How old are you"` → nudge toward Numeric (small pill appears: "Numeric?")
- `"Which of these"` → nudge toward Multiple Choice
- `"Rate your"` → nudge toward Likert
- `"Watch this video"` → nudge toward Video Dial

The suggestion appears as a subtle floating pill below the title. Click to accept, or ignore and pick manually from a type selector. The inference is a convenience, never a gate.

If the user hasn't typed anything after 2 seconds, gently reveal the type selector as a horizontal row of icons below the title field — not a modal, not a dropdown. Each icon is the type's visual signature from the sidebar.

### 2c. Card choreography

When a question card transitions from collapsed to expanded:

1. **0ms**: Card border shifts to primary/20. Title shifts to primary color.
2. **0-150ms**: Card height animates open (spring, from current to measured target)
3. **50-200ms**: Title field fades from static text to editable (underline appears)
4. **100-250ms**: Phase/settings section slides in from below with slight opacity fade
5. **150-300ms**: Options section appears (if applicable) — each option staggers by 30ms
6. **200-350ms**: Skip logic and media sections fade in last

Reverse on collapse, but faster (80% speed) — closing should feel decisive, not leisurely.

**Critical interruption case**: If user clicks another question during this sequence, ALL in-progress animations on the current card reverse from their *current* positions. The new card begins its expansion simultaneously. The system never queues.

---

## Phase 3: Options — Tangible Objects

### 3a. Options as physical chips

Options aren't rows in a list. They're chips on a surface — objects with weight.

- **Rest**: Text + subtle grip dots on left. No border. Clean.
- **Hover**: Hairline border fades in. Chip elevates 1px (shadow shift). Grip dots brighten. Delete X appears on right.
- **Grabbed**: Chip scales to 1.03, shadow deepens, slight rotation toward drag vector (max ±2°). A gap opens between surrounding chips with spring physics — the gap is exactly the chip's height, so you see where it will land.
- **Dropped**: Chip settles into position with a single bounce (spring overshoot, then settle). Surrounding chips close the old gap and open around the new position simultaneously.

### 3b. Adding with continuity

Pressing Enter on the last option OR clicking "+ Add":
- New chip materializes at the target position (not slides from elsewhere — it grows from a point, like it was always meant to be there)
- Cursor is already in the new chip's text field
- The add button below slides down to make room (spring)
- If the user is in rapid-add mode (added 2+ options in 5 seconds), skip the grow animation — just place it. Don't interrupt flow.

### 3c. Removing with consequence

Click the X on an option:
- The chip doesn't vanish — it compresses horizontally to zero width while fading, as if being squeezed out
- Surrounding chips close the gap with spring physics
- An undo toast appears (see toasts below) — the toast includes a miniature preview of what was deleted
- If undo is clicked, the chip re-expands from zero width at its original position, and other chips spring apart to make room

### 3d. Exclusive and special states

- **Exclusive toggle**: When activated, a gold tint washes across the chip from left to right (200ms). A small lock icon appears. Other exclusive chips (if any) lose their gold — only one can be exclusive.
- **Randomize toggle**: When activated on the options group, all chips briefly shuffle positions (swap 2-3 times over 400ms) then resettle. A small shuffle icon appears on the group header. This communicates what randomize *does*, not just that it's on.

---

## Phase 4: Live Preview — Dissolving the Boundary

### 4a. Editor-as-survey rendering

The center panel doesn't show "an editor with a preview." It shows the question *as the respondent sees it*, with edit affordances layered on top.

- The question renders using the actual survey theme (background color, font, button style from the theme settings)
- Edit affordances (borders, grip dots, settings) are overlaid as a semi-transparent layer
- Toggle between "Edit" and "Experience" with a single button — edit affordances fade out, and you're looking at the actual survey question in full fidelity

### 4b. Preview device frame

The device frame in the preview panel:
- Morphs between phone/tablet/desktop with a smooth shape animation (border-radius, width, height all spring-animate)
- The "screen" content scales to fit — no layout reflow, just a CSS scale transform
- Subtle device chrome (notch for phone, traffic lights for desktop) fades in/out during transitions
- Mouse movement within the preview area causes ±2px parallax shift on the screen content relative to the frame — the screen feels like it's behind glass

### 4c. Bidirectional editing

Click on any element in the preview:
- A subtle pulse radiates from the click point
- The corresponding field in the editor scrolls into view and focuses
- The element in preview gets a temporary highlight ring that fades over 1s

Edit in the editor:
- Changes reflect in preview instantly, character by character
- No debounce on preview updates — the preview is not a separate render, it's the same component with different styling context

---

## Phase 5: Global Craft

### 5a. Adaptive focus rings

Focus rings change based on what they're sitting on:

```css
/* Light surface */
:focus-visible { box-shadow: 0 0 0 2px #F4F3EF, 0 0 0 4px #121C8A40; }

/* Colored surface (phase tags, buttons) */
:focus-visible { box-shadow: 0 0 0 2px white, 0 0 0 4px #121C8A60; }

/* Dark surface (primary buttons) */
:focus-visible { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.5); }
```

`:focus-visible` only — mouse clicks never show focus rings. Keyboard users get beautiful, context-aware indicators.

### 5b. Save state as ambient feedback

Don't show a "Saving..." label. Show it as environment:

- **Dirty (unsaved changes)**: A 1px amber line appears at the very top of the viewport, full width. Barely visible. Subconsciously communicates "there's pending work."
- **Saving**: The amber line sweeps right-to-left as a gradient, like a progress bar made of light. Takes exactly as long as the save takes.
- **Saved**: The line turns green for 1.5s, then fades out completely. Clean. Nothing to see.
- **Error**: The line turns red and stays. A small error chip slides in near the line with the message. Clicking it retries.

No dots, no labels, no icons. The state is communicated through the physical space of the page.

### 5c. Toast system

Toasts slide in from the bottom with spring physics:
- Each toast is a card at the Float layer (shadow-lg)
- Multiple toasts stack with 8px spacing, newest on bottom
- Each toast has a thin progress bar at its bottom edge that shrinks over 5 seconds
- When the bar reaches zero, the toast springs downward and fades
- Undo actions show the countdown as a circular ring around the undo button — filling clockwise, giving visual urgency

### 5d. Empty states

Every empty state tells a micro-story:

- **No questions**: A single vertical line (the survey spine) with a pulsing node at the top and the text "Your survey starts here." The add button is positioned at the node.
- **No options**: Three ghost chips with dashed outlines, staggered at slight angles, with "Add your first option" centered.
- **No responses**: A flat dial at zero with the text "No responses yet. Share your survey to start collecting data."

Each empty state uses the product's own visual language (spine, chips, dial) to teach what will be there.

### 5e. Keyboard shortcuts

Press `?` anywhere:

A panel slides in from the right (not a modal — the editor content shifts left to make room). The panel shows shortcuts grouped by context:

| Context | Shortcut | Action |
|---------|----------|--------|
| Navigation | `↑` `↓` | Move between questions |
| Navigation | `Esc` | Deselect / close panel |
| Editing | `Enter` | Add option (when in options) |
| Editing | `Backspace` | Delete empty option |
| Editing | `⌘ D` | Duplicate question |
| Actions | `⌘ S` | Force save |
| Actions | `⌘ ⇧ P` | Toggle preview |

Keys rendered as physical keycaps with subtle 3D shadows. The panel itself is keyboard-navigable.

### 5f. Sound (committed, not optional)

Sound isn't a gimmick — it's the haptic feedback that screens can't provide. Commit to it or cut it. We commit.

- **Select question**: Soft tactile click (like a mechanical switch, 50ms)
- **Add option**: Light ascending tone (like placing a card, 80ms)
- **Delete**: Low muted thud (consequence, 60ms)
- **Drop after drag**: Satisfying settle sound (like a piece clicking into place, 100ms)
- **Save complete**: Gentle two-note chime (resolution, 150ms)
- **Error**: Single low note (not alarming — informational, 100ms)

All sounds are 48kHz, <5KB each, loaded lazily. Volume at 15% of system volume. Respect system mute. A single toggle in the editor toolbar: 🔊/🔇. State persists in localStorage.

Design the sounds to be so quiet and appropriate that users don't notice them consciously — they just feel like the app is more responsive than other apps, without knowing why.

---

## Phase 6: Respondent Experience

### 6a. One question, full presence

Each question owns the entire viewport. No chrome except a minimal progress indicator.

- Question text appears first (fade + slight upward drift, 200ms)
- Then options/input stagger in (each 40ms apart)
- Then the continue button (last, subtle)
- The background color can shift per-phase (warm for screening, neutral for ballot, rich for stimulus) — crossfading between questions

### 6b. Transitions between questions

When advancing:
- Current question slides up and fades (250ms ease-out)
- Next question slides up from below and settles (300ms spring)
- The progress bar fills smoothly to the new percentage
- If auto-advance is enabled, the transition begins 400ms after answering — fast enough to feel responsive, slow enough that the user sees their selection registered

When going back:
- Reverse direction — current slides down, previous slides up from above
- The progress bar retreats

### 6c. The video dial experience

This is our signature moment. It must be cinematic.

- Video fills the viewport. No borders, no cards, no UI frames.
- The dial is a translucent arc at the bottom third of the screen, with backdrop blur behind it
- The dial handle is large enough for thumb use on mobile (44px minimum)
- As the user drags the dial, the value updates with a spring that slightly lags their finger — creating a feeling of mass and precision
- At extremes (0 or 100), the dial handle meets resistance — it overshoots slightly then springs back to the boundary
- Action buttons float as translucent pills above the dial, appearing only when the video is playing
- When the video ends, the dial fades and the annotation field rises from below with a spring

### 6d. First-time dial onboarding

The first time a respondent encounters a video dial:
- Before the video plays, a 3-second overlay shows a hand animation demonstrating the drag gesture
- The text reads: "Drag the dial to show how you feel as you watch"
- The dial starts at center (50) and the demo hand drags it to show the range
- This overlay appears once per session, never again
- A small "?" button in the corner replays it on demand

---

## Phase 7: The Details Nobody Asked For

These are the things that make someone say "wait, how did they think of that?"

### 7a. Survey analytics in the sidebar

When viewing results, the sidebar spine transforms:
- Each question node shows a tiny inline sparkline of response distribution
- Nodes are sized proportionally to response count (more responses = slightly larger node)
- The spine's branches show actual path percentages ("72% took this path")
- Hovering a node shows a tooltip with key stats — no need to click into each question

### 7b. Collaborative ghosts

Before real-time collaboration exists:
- When you open a survey another admin last edited, show a subtle "Last edited by [name], 2 hours ago" with their avatar near the title
- In the sidebar, questions they modified recently have a faint colored dot (their avatar color)
- This costs nothing to build (just track `updatedBy` + `updatedAt` on the question) but makes the tool feel socially aware

### 7c. Survey health indicator

A small ambient indicator in the toolbar:
- Analyzes survey quality in real-time: question count, estimated completion time, readability, skip logic completeness
- Shows as a simple colored dot: green (healthy), amber (some issues), red (problems)
- Click to expand a panel with specific recommendations: "Question 4 has no options," "Estimated completion time is 12 minutes — surveys over 8 minutes see 40% drop-off"
- This teaches the user survey design best practices through the tool itself

### 7d. Contextual illustrations

Throughout the app, small custom illustrations (line drawings, single stroke weight, brand blue) appear at key moments:
- The study detail page shows a tiny illustration of a survey's "shape" — how many questions, how they branch, a visual fingerprint
- The results dashboard header shows a stylized version of the response curve
- These are generated from actual data, not static — every survey's illustration is unique

---

## Implementation Sequence

| Week | Focus | What ships |
|------|-------|------------|
| 1 | Foundation | Context-aware springs, interruption model, depth system, borderless editing surface |
| 2 | The Card | Choreographed expand/collapse, staggered fields, bidirectional preview sync |
| 3 | Options & Sidebar | Physical chips, spine navigation, skip logic visualization, drag with gap-opening |
| 4 | Global Polish | Adaptive focus, ambient save state, toast system, empty states, keyboard shortcuts |
| 5 | Survey Experience | One-question-at-a-time transitions, video dial cinematic mode, dial onboarding |
| 6 | The Details | Sound design, health indicator, collaborative ghosts, survey fingerprint illustrations, type inference |

**Total: 6 weeks.** Not 10 days. The first plan was underselling the work because it was underselling the ambition. This is a product-defining investment.

---

## Technical Constraints

| Rule | Reason |
|------|--------|
| `motion` in admin only, CSS in survey | Survey bundle stays < 80KB |
| No animation libraries in survey bundle | Performance on low-end mobile |
| Sound files lazy-loaded, < 5KB each | No impact on initial load |
| `prefers-reduced-motion` respected everywhere | Accessibility non-negotiable |
| All animations < 400ms | Nothing should feel slow |
| `contentEditable` only for title/instructions | Don't fight the browser on form inputs |

---

## Evaluation Framework

This isn't a checklist you run once at the end. It's a scoring system applied to **every component, every interaction, every PR** throughout the build. Nothing ships without passing.

---

### The Scorecard

Every interaction gets scored 0-3 across 8 dimensions. The minimum shipping score is **20/24**. Anything below 16 gets rebuilt, not patched.

| # | Dimension | 0 — Failing | 1 — Functional | 2 — Polished | 3 — Invisible |
|---|-----------|-------------|----------------|--------------|---------------|
| 1 | **Physics** | Static/instant state change | CSS transition (ease, duration) | Spring with reasonable feel | Spring tuned to this specific distance and context; interruptible mid-flight |
| 2 | **Interruption** | Animations queue or block input | Animations can be skipped | New input cancels current animation | Redirects from current position; simultaneous animations resolve naturally; spam-proof |
| 3 | **Frequency awareness** | Same behavior at all speeds | Debounced/throttled | Reduced animation at high frequency | Behavior continuously adapts to user tempo without configuration |
| 4 | **Spatial honesty** | Element appears/disappears without origin | Enters from a direction | Enters from a meaningful direction with correct physics | Movement communicates where the element came from, where it's going, and why |
| 5 | **Intent clarity** | User must guess what happened | State change is visible | State change is visible + animated | The interaction anticipated what the user wanted; the UI prepared before they acted |
| 6 | **Visual hierarchy** | Flat, everything at same level | Some depth (borders, backgrounds) | Layered with shadows and elevation | Depth matches the interaction model — raised things feel raised, background recedes, focus draws forward |
| 7 | **Breathing room** | Content touches container edges | Consistent padding | Generous padding with rhythm | Spacing varies by context — dense where scanning, generous where crafting; whitespace is compositional, not uniform |
| 8 | **Sound & silence** | No feedback (or jarring feedback) | Visual-only feedback | Visual + motion feedback | Multi-sensory when appropriate; silent when speed matters; the ratio of feedback to action feels exactly right |

**How to score**: For each interaction you're evaluating, walk through all 8 dimensions and assign honestly. Write down the scores. If you can't articulate why something is a 3 and not a 2, it's a 2.

---

### The Four Reviewers

Every significant interaction gets evaluated from four perspectives. These aren't hypothetical — they're specific lenses with specific questions.

#### The Craftsperson (Rauno lens)

Ask these questions with a stopwatch and a screen recorder:

1. **The interruption test**: Trigger the animation. Immediately trigger a conflicting action. What happens? Does the system resolve gracefully from the current position, or does it queue/jump/glitch?
2. **The spam test**: Perform the interaction 20 times in 5 seconds. Does the 20th feel as good as the 1st? Does anything break, stack, or desync?
3. **The first-render test**: Hard refresh the page. Does anything animate on load that shouldn't? Do elements measure themselves silently and only animate on subsequent changes?
4. **The velocity test**: Flick/drag quickly vs. slowly. Does the system respond differently? Does a fast flick feel fast and a slow drag feel deliberate, or does everything move at the same speed regardless?
5. **The peripheral test**: Focus on something else on screen while triggering the interaction in your peripheral vision. Is the motion noticeable but not distracting? Or does it scream for attention?

**Scoring**: If any of 1-3 fail, the interaction is not shippable regardless of other scores. These are non-negotiable craft standards.

#### The Product Designer (Typeform lens)

Ask these questions while building a real 10-question survey from scratch:

1. **The mirror test**: At any point during editing, does the thing you're looking at match what a respondent will see? Can you point to a specific visual discrepancy between the editor and the survey output?
2. **The flow test**: Build the survey without using the mouse. Keyboard only. Can you? Where do you get stuck? Where do you have to reach for the mouse?
3. **The speed test**: How many clicks/keystrokes to go from "I want a multiple choice question" to "it's done with 4 options"? Count them. Typeform's answer is roughly 6 (click add → type title → Enter → type option → Enter → type option → Enter → type option). Can we match or beat that?
4. **The delight test**: During the entire survey-building process, was there a single moment where you smiled, felt surprised, or thought "that's nice"? If not, there's no delight — only competence.
5. **The explanation test**: Show the editor to someone for 10 seconds. Ask them what it does. If they can't tell it's a survey builder, the design isn't communicating.

**Scoring**: The flow test (#2) and speed test (#3) produce hard numbers. Track them over time. They should only go down (fewer clicks, fewer stuck points).

#### The Respondent (Survey-taker lens)

Take the survey you built, on a real phone, in a real context (not at your desk staring at a monitor):

1. **The thumb test**: Can you complete every interaction with one thumb? Is the dial usable without stretching? Are tap targets ≥ 44px?
2. **The first-encounter test**: If you'd never seen a dial question before, would you know what to do within 3 seconds? Time it with a real person.
3. **The momentum test**: After answering a question, does the transition to the next question feel like a natural continuation or a page reload? Does the survey pull you forward?
4. **The abandon test**: At what point would you give up and close the tab? What's the frustration moment? Every survey has one — find it and fix it.
5. **The network test**: Throttle to 3G. Take the survey. Does video load progressively? Do interactions remain responsive? Does anything block on a network request?

**Scoring**: The first-encounter test (#2) must pass with 3 out of 3 naive users. The thumb test (#1) is pass/fail. The network test (#5) is pass/fail.

#### The Engineer (Quality lens)

Measure, don't guess:

1. **Bundle size**: Admin editor bundle < 200KB gzip. Survey bundle < 80KB gzip. Measure after every PR. Regressions are bugs.
2. **Frame rate**: Record a 60fps screen capture of every major animation. Open in frame-by-frame viewer. Are there dropped frames? Is the animation smooth at 60fps? On a 2020 MacBook Air, not an M3 Max.
3. **Layout shift**: Run Lighthouse on the editor. CLS must be 0. No element should move after initial render unless the user caused it.
4. **Accessibility**: Run axe-core on every view. Zero violations. Focus order makes sense. Screen reader announces state changes. Reduced motion works and isn't an afterthought.
5. **Memory**: Open the editor, create 20 questions, edit all of them, delete 10, undo 5. Check browser memory. Is it growing unbounded? Are event listeners being cleaned up?

**Scoring**: These are binary. Pass or fail. No "mostly passes." The numbers are the numbers.

---

### Per-Component Evaluation Template

For each component built during this plan, fill out this template before shipping:

```
## Component: [Name]
Date: [Date]
Evaluator: [Name]

### Scorecard (0-3 each, minimum 20/24 to ship)
| Dimension | Score | Notes |
|-----------|-------|-------|
| Physics | | |
| Interruption | | |
| Frequency awareness | | |
| Spatial honesty | | |
| Intent clarity | | |
| Visual hierarchy | | |
| Breathing room | | |
| Sound & silence | | |
| **TOTAL** | **/24** | |

### Craftsperson Review
- [ ] Interruption test passed
- [ ] Spam test passed (20x in 5s)
- [ ] First-render test passed (no mount animation)
- [ ] Velocity test: fast vs slow feels different? Y/N
- [ ] Peripheral test: noticeable but not distracting? Y/N

### Product Review
- [ ] Mirror test: editor matches survey output? Y/N
- [ ] Keyboard-only flow: stuck points? [list them]
- [ ] Click count for primary action: [number]
- [ ] Delight moment exists? Y/N — describe:
- [ ] 10-second explanation test passed? Y/N

### Respondent Review (if applicable)
- [ ] Thumb-reachable on mobile? Y/N
- [ ] First-encounter: [seconds] for naive user to understand
- [ ] 3G network test passed? Y/N

### Engineer Review
- [ ] Bundle impact: +[X]KB
- [ ] 60fps on mid-tier device? Y/N
- [ ] CLS = 0? Y/N
- [ ] axe-core: 0 violations? Y/N
- [ ] Memory stable after stress test? Y/N

### Ship decision
- [ ] Score ≥ 20/24
- [ ] All Craftsperson non-negotiables pass (interruption, spam, first-render)
- [ ] All Engineer binaries pass
- **SHIP / REBUILD / PATCH**
```

---

### Weekly Evaluation Ritual

At the end of each implementation week:

1. **Record a 2-minute video** of yourself using everything built that week. No narration. Just using it. Watch it back. Does it look like a 2030 product or a 2024 product?

2. **Run the scorecard** on every new component. Calculate the average score across all components. Track this number weekly. It should trend upward.

3. **The regression check**: Go back to components built in previous weeks. Use them again after a week of not touching them. Fresh eyes catch what tired eyes forgave. Re-score anything that feels worse than you remembered.

4. **The comparison screenshot**: Take a screenshot of the same screen from this week and from the beginning of the project. Put them side by side. The improvement should be obvious and dramatic. If it's subtle, the week didn't push hard enough.

5. **The outsider test**: Once per week, show the current state to someone who hasn't seen it before. Don't explain anything. Note: (a) where they hesitate, (b) where they look confused, (c) where they look pleased, (d) what they say unprompted. This is your most valuable data.

---

### The Final Gate

Before declaring the plan complete, every interaction in the entire editor must:

1. Score ≥ 20/24 on the scorecard
2. Pass all Craftsperson non-negotiables (interruption, spam, first-render)
3. Pass all Engineer binaries (bundle, framerate, CLS, accessibility, memory)
4. Have been evaluated by at least one person who didn't build it

And these five integration tests must pass:

1. **The keyboard marathon**: Build a complete 10-question survey using only the keyboard. Time it. It should take under 4 minutes. Every focus state must be visible and logical.

2. **The chaos test**: Open the editor. Click randomly and rapidly for 30 seconds — selecting, deselecting, adding, deleting, dragging, undoing. Nothing should break, error, or desync. The app should be in a valid state at the end.

3. **The slow network survey**: Take a full survey (including video dial) on a 3G throttled connection. Every question must be usable. Video must load progressively. No interaction should block on network.

4. **The phone test**: Build a 5-question survey on a phone. Then take that survey on the same phone. Both must be usable. Not just functional — usable.

5. **The stranger test**: Hand the app to someone who has never seen it. Ask them to build a survey and take it. Watch silently. If they need help, that's a bug in the design, not in the person.
