I have sufficient research material. Let me now compile the comprehensive report.

---

# Survey Platform UX Best Practices Research Report (2025-2026)

## Table of Contents
1. Survey Respondent Experience
2. Drag-and-Drop Survey Builders
3. Results Dashboard Design
4. Mobile Slider Interaction Patterns
5. Video + Interactive Overlay UX
6. Survey Completion Redirect / Panel Integration

---

## 1. Survey Respondent Experience

### Question Progression Patterns

**One-Question-at-a-Time (OQAAT)**: This is now the dominant UX pattern for consumer-facing surveys. Pioneered by [Typeform](https://www.typeform.com), this conversational format shows a single question per screen with smooth transitions. Studies show completion rates up to [36% higher than traditional multi-question layouts](https://www.fillout.com/blog/typeform-alternatives). Nearly all major platforms now support this: SurveyMonkey offers a "one question at a time" toggle, Jotform has "Card Forms," and Google Forms supports per-section pagination.

**Recommended progression patterns:**
- **Conversational flow**: Questions appear one at a time with keyboard-navigable "Enter to continue" and smooth vertical or fade transitions
- **Section-based grouping**: Related questions grouped into labeled sections (3-5 questions per section), with section-level progress rather than per-question progress
- **Conditional branching (skip logic)**: Route respondents to relevant questions based on prior answers, creating a [tailored experience that improves both data quality and completion rates](https://mopinion.com/user-experience-surveys/)
- **Smart ordering**: Start with easy, engaging questions; place sensitive or open-ended questions later when commitment is higher

### Progress Indicators

Best practices from [Lollypop Design](https://lollypop.design/blog/2025/november/progress-indicator-design/) and platform analysis:

- **Use section-based progress for long surveys**: Showing "Section 2 of 5" rather than "Question 7 of 42" avoids intimidating respondents
- **Horizontal progress bar** at the top of the screen is the standard pattern. Keep it thin (4-6px) and use brand colors
- **Show estimated time remaining** (e.g., "About 3 minutes left") rather than raw question counts
- **Avoid misleading indicators**: If branching logic changes survey length, use percentage-based progress that accounts for the respondent's actual path, not total questions
- **Consider removing progress for very short surveys** (under 5 questions) since the overhead adds visual clutter

### Mobile-First Design

Mobile now accounts for the majority of survey responses. Key patterns from [TensorBlue](https://tensorblue.com/blog/mobile-first-ux-patterns-driving-engagement-design-strategies-for-2026) and platform analysis:

- **Touch targets**: Minimum 44x44 CSS pixels per [WCAG 2.2 guidelines](https://assist-software.net/business-insights/web-accessibility-2026-complete-guide-wcag-compliance). Radio buttons and checkboxes must use the full-width row as the tap target, not just the circle/box
- **Single-column layout**: No horizontal scrolling. All question types must collapse gracefully to a single column
- **Large, finger-friendly inputs**: Rating scales should use large tap targets (stars, buttons) rather than small radio dots
- **Autosave**: Save responses after each question to prevent data loss from accidental navigation or connectivity issues
- **Avoid hover-dependent interactions**: No tooltips or hover states as primary information delivery
- **Bottom-anchored navigation**: "Next" button within thumb reach (bottom third of screen)

### Accessibility

Per [WCAG 2.2 (2023) and emerging WCAG 3.0 standards](https://www.broworks.net/blog/web-accessibility-best-practices-2025-guide):

- Full keyboard navigation (Tab, Enter, Arrow keys) for all question types
- Screen reader compatibility with proper ARIA labels on custom form controls
- Minimum 4.5:1 contrast ratio for text; 3:1 for interactive elements
- Focus indicators must be visible at all times (WCAG 2.2 "Focus Appearance" criterion)
- Alternative to drag-and-drop ranking: provide numbered dropdowns or up/down buttons (WCAG 2.2 "Dragging Movements" criterion requires non-drag alternatives)
- Error messages associated with the relevant field via `aria-describedby`

### Completion Screens and Abandonment Reduction

**Abandonment statistics**: [81% of users abandon forms after starting them](https://www.numentechnology.co.uk/blog/contact-form-optimization-conversion-rates). Key reduction techniques:

- **Multi-step design**: Breaking forms into steps yields [3x better completion rates](https://www.numentechnology.co.uk/blog/contact-form-optimization-conversion-rates)
- **Opt-out options**: Always include "Not applicable" or "Prefer not to answer" to prevent forced abandonment on irrelevant questions
- **Mixed question types**: Alternate between low-effort (multiple choice, scales) and high-effort (open text) questions to manage [cognitive fatigue](https://ixdf.org/literature/article/ux-surveys)
- **Thank-you screen best practices**: Confirm submission, show a summary if appropriate, provide a clear call to action (redirect, download, or close)
- **Accessibility-first design improves conversions by 25%** according to [MarketingProfs research](https://www.marketingprofs.com/articles/2025/53566/how-to-use-web-accessibility-standards-to-optimize-your-conversion-rate)

---

## 2. Drag-and-Drop Survey Builders

### Library Comparison for React (2026)

Based on the [Puck Editor comparison](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) and community analysis:

| Library | Status | Bundle Size | Best For | Accessibility |
|---------|--------|-------------|----------|---------------|
| **@dnd-kit** | Active, v10+ | ~13-21KB (modular) | Survey builders, sortable lists, grid layouts | Good (ARIA live regions) |
| **pragmatic-drag-and-drop** | Active (Atlassian) | ~4.7KB core | Performance-critical apps, framework-agnostic | Excellent (Atlassian Design System patterns) |
| **@hello-pangea/dnd** | Active (community fork) | ~30KB | Drop-in replacement for react-beautiful-dnd | Good (inherited from rbd) |
| **react-beautiful-dnd** | **Deprecated** | ~30KB | **Do not use for new projects** | Was excellent |
| **react-dnd** | Maintenance mode | ~18KB | Complex custom drag interfaces | Manual |

### Recommendation: @dnd-kit for Survey Builders

**Why @dnd-kit is the best choice for a survey builder in 2026:**

1. **Sortable preset** (`@dnd-kit/sortable`) provides exactly the interaction model needed: vertical list reordering of question cards with smooth animations. [Over 2,000 projects in npm use this package](https://www.npmjs.com/package/@dnd-kit/sortable)

2. **Modular architecture**: Import only what you need. Core + sortable + utilities keeps bundle small

3. **Multiple input methods**: Supports pointer, keyboard, and touch sensors out of the box, meeting WCAG "Dragging Movements" requirements

4. **Collision detection strategies**: `closestCenter`, `closestCorners`, and `rectIntersection` strategies handle different question card sizes gracefully

5. **Overlay support**: The `DragOverlay` component renders a floating preview of the dragged question card, essential for visual feedback during reordering

**Architecture pattern for a survey builder with @dnd-kit:**

```tsx
// Core structure for a survey builder question list
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';

function SurveyBuilder({ questions, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Prevent accidental drags
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={questions.map(q => q.id)}
        strategy={verticalListSortingStrategy}
      >
        {questions.map(question => (
          <SortableQuestionCard key={question.id} question={question} />
        ))}
      </SortableContext>
      <DragOverlay>
        {activeQuestion ? (
          <QuestionCardPreview question={activeQuestion} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

**When to choose pragmatic-drag-and-drop instead**: If you need the absolute smallest bundle size, framework-agnostic code, or are already using the Atlassian Design System. However, its reliance on the HTML5 drag-and-drop API means [less smooth interactive feedback compared to @dnd-kit](https://www.atlassian.com/blog/design/designed-for-delight-built-for-performance), and touch support requires additional configuration.

### Question Type Selection Patterns

Survey builders commonly use these patterns for adding new questions:

- **"Add Question" button** at the bottom of the question list that opens a type picker (grid of icons: multiple choice, text, rating, slider, matrix, etc.)
- **Floating action button (FAB)** on mobile for quick question insertion
- **Type-ahead command palette** (slash command pattern, e.g., typing "/" shows question type options) - increasingly common in modern tools
- **Drag from sidebar palette**: A sidebar contains draggable question type templates; drag one into the question list to insert at a specific position

### Inline Editing

- **Click-to-edit question text**: Question title and description are rendered as display text; clicking transitions to an editable input/textarea with auto-focus
- **Contenteditable for rich text**: Use a controlled contenteditable div or a library like TipTap/ProseMirror for rich question text (bold, links, etc.)
- **Inline option editing**: For multiple choice, allow adding/removing/editing options directly in the card without opening a modal
- **Settings drawer**: Question-specific settings (required, skip logic, piping) in a side drawer or bottom sheet triggered from a gear icon on the card

### Preview Modes

- **Split-pane preview**: Builder on the left, live preview on the right (desktop)
- **Toggle preview**: Full-screen preview mode with a "Back to editor" button
- **Device-frame preview**: Show preview inside a phone/tablet frame to test responsive behavior
- **Share preview link**: Generate a temporary URL for stakeholder review

---

## 3. Results Dashboard Design for Research Platforms

### Dashboard Architecture

Based on [Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards), [UXPin](https://www.uxpin.com/studio/blog/dashboard-design-principles/), and [Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/):

**Layout hierarchy (top to bottom):**
1. **Summary metrics strip**: Total responses, completion rate, average duration, NPS/satisfaction score as large KPI cards across the top
2. **Filter bar**: Date range, segment selectors (demographic, source, device), search. Persist filter state across views
3. **Question-level results**: Each question rendered as a chart card with the question text as the card header
4. **Cross-tabulation panel**: Accessible via a "Cross-tab" or "Compare" button, showing a pivot table view

### Aggregated Results Display Patterns

**By question type:**
- **Multiple choice / Single select**: Horizontal bar chart with percentage labels and response counts. Color-code by answer option
- **Rating scales (Likert)**: Stacked diverging bar chart centered on the neutral point, or a simple horizontal bar chart with mean/median callout
- **NPS**: Gauge or donut chart with promoter/passive/detractor segments and the NPS score prominently displayed
- **Open text**: Word cloud + sentiment analysis summary + scrollable response list with search/filter
- **Ranking**: Bump chart or average rank bar chart
- **Matrix**: Heatmap grid with color intensity representing response frequency

### Segmentation and Cross-Tabulation

[Cross-tabulation is used by approximately 60% of survey platforms](https://btinsights.ai/best-tools-for-cross-tab-tables-survey-data/) for analysis:

- **Banner/stub format**: Rows = answer options, columns = segments (e.g., age groups). Each cell shows count, percentage, and optionally statistical significance indicators
- **Interactive cross-filter**: Clicking a bar segment in one chart filters all other charts on the dashboard ([AG Grid cross-filter pattern](https://ag-grid.com/react-data-grid/integrated-charts-api-cross-filter-chart/))
- **Segment comparison**: Side-by-side bar charts for 2-3 segments, overlaid semi-transparent distributions for continuous data
- **Statistical significance**: Highlight cells in cross-tabs with arrows or color when differences between segments are statistically significant (chi-square test, z-test for proportions)

### React Chart Libraries for Research Dashboards

Based on [LogRocket](https://blog.logrocket.com/best-react-chart-libraries-2025/) and [DataBrain](https://www.usedatabrain.com/blog/react-chart-libraries):

- **Recharts**: Best for straightforward survey result charts. SVG-based, declarative API, good animation support. Recommended for most survey dashboard use cases
- **Nivo**: Widest chart type selection (includes heatmaps, bump charts, radar). Built on D3. Good for matrix/cross-tab heatmaps
- **visx** (Airbnb): Low-level D3 + React primitives. Best for custom time-series overlays (dial testing results over video timeline)
- **Victory**: Composable, well-themed. Good for branded dashboards with consistent design system
- **AG Grid**: Best for interactive cross-tabulation tables with built-in pivot, grouping, and cross-filter charting

### Video + Time-Series Overlay for Research Dashboards

This is the specific pattern used in dial testing / continuous response measurement. The visualization shows:

- **Video player** at the top or left of the screen
- **Aggregate response line graph** overlaid on or synchronized with the video timeline
- **Multiple segment lines** (colored by demographic segment) plotted on the same time axis
- **Playhead synchronization**: The chart cursor moves in sync with the video playhead; clicking on the chart seeks the video to that timestamp
- **Highlight zones**: Shaded regions on the timeline indicating high/low response moments

**React implementation approach:**
```tsx
// Synchronized video + time-series chart
function DialTestingResults({ videoUrl, timeSeriesData, segments }) {
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <div className="dial-results-layout">
      <VideoPlayer
        src={videoUrl}
        onTimeUpdate={setCurrentTime}
        onSeek={setCurrentTime}
      />
      <TimeSeriesChart
        data={timeSeriesData}
        segments={segments}
        currentTime={currentTime}
        onPointClick={(time) => setCurrentTime(time)}
        // Vertical playhead line synced to video position
        playheadPosition={currentTime}
      />
      <SegmentLegend segments={segments} />
    </div>
  );
}
```

Libraries like [react-timeseries-charts (ESnet)](https://github.com/esnet/react-timeseries-charts) or custom visx implementations are best suited for this pattern.

---

## 4. Mobile Slider Interaction Patterns

### Touch Target Sizing

From [NNGroup](https://www.nngroup.com/articles/gui-slider-controls/), [Smashing Magazine](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/), and [UX Planet](https://uxplanet.org/mobile-ux-design-sliders-761ce4bb2a86):

- **Thumb/handle minimum size**: 44x44pt (Apple HIG) / 48x48dp (Material Design). For a continuous dial, this is the minimum visible handle size
- **Touch slop / activation area**: The touchable area should extend beyond the visible handle. [Use padding of at least 3vw on narrow screens](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/) to ensure the handle is easily acquirable
- **Track height**: Minimum 4px visible, but the touchable track area should be 44px tall to allow tap-to-seek anywhere on the track
- **Track padding from screen edges**: At least 16px from each edge to prevent accidental system gesture activation (especially iOS swipe-to-go-back)

### Visual Feedback

- **Value tooltip/bubble**: Display the current value in a bubble above the thumb that appears on touch and follows the thumb during drag. This solves the [finger occlusion problem](https://www.sciencedirect.com/science/article/abs/pii/S000368702100168X) where the user's finger covers the exact position
- **Track fill**: Color the track from the start to the thumb position to reinforce the selected range
- **Haptic feedback**: On iOS/Android, trigger light haptic pulses at notable positions (midpoint, endpoints, tick marks) using the Vibration API
- **Labels above the slider**: [Position labels above (not below) the control](https://uxplanet.org/mobile-ux-design-sliders-761ce4bb2a86) to prevent finger occlusion
- **Real-time value display**: Show a numeric readout that updates live as the user drags

### One-Hand Operation

From [Smashing Magazine's mobile one-hand design guide](https://www.smashingmagazine.com/2020/02/design-mobile-apps-one-hand-usage/):

- **Horizontal sliders work best for one-handed thumb operation** when positioned in the lower half of the screen (within the natural thumb arc)
- **Circular/radial dial input**: A circular dial can be more ergonomic than a linear slider for one-handed use because the thumb naturally moves in an arc. However, it requires more screen real estate
- **Avoid vertical sliders on mobile**: Vertical dragging conflicts with page scrolling. If needed, use a contained area with clear boundaries and scroll locking during interaction
- **Consider the thumb zone**: Right-handed users (majority) reach most easily to the center-left of the screen with their right thumb. Position the slider's starting point within this zone

### Mobile Slider Accuracy vs. Desktop

Key research findings from [MeasuringU](https://measuringu.com/ltr-numeric-slider-desktop-mobile/) and [academic research](https://www.sciencedirect.com/science/article/abs/pii/S000368702100168X):

- **No significant difference in rating behavior** between sliders and numeric point scales on mobile vs. desktop. Users arrive at similar ratings regardless of input method
- **Accuracy is lower on mobile** due to the "fat finger problem" -- the finger occludes the precise touch point. [Shorter sliders amplify this problem](https://www.sciencedirect.com/science/article/abs/pii/S000368702100168X)
- **Practical recommendation**: Sliders work best for approximate/continuous values where the exact number matters less than the relative position. For precise values, [pair the slider with a numeric input field](https://medium.com/@oshalurade/designing-the-perfect-slider-component-f2dff91afa0a) that allows direct text entry
- **Minimum slider length on mobile**: At least 280px (approximately the width of a small phone minus margins) to provide sufficient resolution. Avoid sliders with more than 10-11 discrete points at small sizes
- **Response times are slightly longer on mobile** for slider interactions compared to tap-based alternatives

### Accessibility for Sliders

Per [Smashing Magazine](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/) and WCAG 2.2:

- Use `role="slider"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`
- Support keyboard input: Arrow keys for fine adjustment, Page Up/Down for coarse adjustment, Home/End for min/max
- Track, tick marks, handle, and labels must all have [sufficient contrast in both normal and high-contrast modes](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/)
- Provide an alternative non-dragging input method (numeric field or stepper buttons) per WCAG 2.2 "Dragging Movements" (2.5.7)

---

## 5. Video + Interactive Overlay UX

### Dial Testing / Continuous Response Measurement

Based on [Touchstone Research](https://touchstoneresearch.com/the-complete-guide-to-dial-testing-real-time-feedback-for-smarter-content-decisions/), [Dialsmith](https://www.dialsmith.com/technology/), and [Mercury Analytics](https://www.mercuryanalytics.com/advanced-tools/m2m-dial-testing/):

**How dial testing works:**
- Participants watch video content while continuously adjusting a slider/dial to indicate their moment-to-moment reaction
- Data is captured at sub-second intervals (typically quarter-second precision per [MMI-2](https://mmi-2.com/dial-testing/))
- Individual response streams are aggregated into a mean/median line per segment
- Results are visualized as a **moving line graph superimposed over the media timeline**, producing what is called an "overlay"

**Key visualization components:**
1. **Video player** (top area on desktop; full-width on mobile)
2. **Aggregate response graph** directly below or overlaid semi-transparently on the video
3. **Segment toggle/legend**: Enable/disable visibility of different demographic segment lines
4. **Moment markers**: Clickable annotations at moments of significant change (peaks, valleys)
5. **Scrubber synchronization**: Video scrubber and chart are bidirectionally synced

### Layout Patterns: Desktop vs. Mobile

**Desktop layout (wide screen):**
```
+----------------------------------------------+
|            VIDEO PLAYER (16:9)               |
+----------------------------------------------+
|     SLIDER/DIAL INPUT (during collection)    |
+----------------------------------------------+
| AGGREGATE LINE CHART (synced timeline)       |
| [Segment A ---] [Segment B - - -]           |
+----------------------------------------------+
| CONTROLS: Play/Pause | Segments | Export     |
+----------------------------------------------+
```

**Alternative desktop layout (side-by-side for analysis):**
```
+---------------------------+------------------+
|                           |  SEGMENT LIST    |
|    VIDEO PLAYER (16:9)    |  [x] Male 18-34 |
|                           |  [x] Female 35+  |
+---------------------------+------------------+
|    AGGREGATE LINE CHART (full width)         |
|    with playhead cursor synced to video      |
+----------------------------------------------+
```

**Mobile layout (portrait):**
```
+----------------------+
| VIDEO PLAYER (16:9)  |
+----------------------+
| SLIDER/DIAL          |
| [=====O==========]  |
| "Move to rate"       |
+----------------------+
| MINI CHART (sparkline|
| view, expandable)    |
+----------------------+
```

On mobile during collection, the slider should occupy approximately 60px of height with generous touch padding, positioned directly below the video. The video should remain visible (not covered) while the respondent adjusts the dial.

### Annotation and Comment Overlay Patterns

From [video UX research](https://adspyder.io/blog/ux-design-for-video-content/) and industry practice:

- **Timestamped comments**: Comments or annotations pinned to specific video timestamps. Display as markers on the scrubber bar; clicking reveals the comment in a side panel (desktop) or bottom sheet (mobile)
- **Amazon X-Ray pattern**: Semi-transparent overlay that appears on tap/hover, showing contextual information without leaving the video experience
- **Non-intrusive overlays on mobile**: Critical because [screen space is limited and overlay elements can cause accidental clicks](https://medium.com/@vivekumarraj/types-of-overlays-in-ui-design-enhancing-experiences-layer-by-layer-58ac95fc489c). Use a toggle to show/hide overlays rather than persistent display
- **Auto-hiding controls**: Video controls and overlay UI should auto-hide after 3-5 seconds of no interaction, reappearing on tap. This maximizes video viewing area

### React Implementation Considerations

For building a video + dial testing interface:

- **Video player**: Use a wrapper around the HTML5 `<video>` element or libraries like Video.js / React Player for consistent cross-browser behavior
- **Timeline chart**: [visx](https://airbnb.io/visx/) (Airbnb) or [react-timeseries-charts](https://github.com/esnet/react-timeseries-charts) for the synchronized line chart
- **Slider component**: [Radix UI Slider](https://www.radix-ui.com/) or a custom implementation with `role="slider"` for the dial input
- **Synchronization**: Use `requestAnimationFrame` tied to the video's `timeupdate` event to keep chart cursor and video in sync at 60fps
- **Data collection**: WebSocket or periodic POST to capture slider position at configurable intervals (250ms is standard for dial testing)

---

## 6. Survey Completion Redirect / Panel Integration

### How Panel Integration Works

Based on [Qualtrics documentation](https://www.qualtrics.com/support/survey-platform/common-use-cases-rc/panel-company-integration/), [SurveyLegend](https://www.surveylegend.com/user-guide/integrating-panel-providers/), [Alchemer](https://help.alchemer.com/help/panel-integration), and [QuestionPro](https://www.questionpro.com/help/custom-panel-redirect-links.html):

**The flow:**
1. Panel provider (e.g., Cint, Lucid, Toluna, Dynata) sends a respondent to the survey URL with a unique identifier appended as a query parameter (e.g., `?pid=ABC123` or `?RID=XYZ789`)
2. The survey platform captures this ID as embedded data / custom variable at survey start
3. The respondent completes (or is screened out of / quota-fulled from) the survey
4. The platform redirects the respondent back to the panel provider's URL with the captured ID substituted into the redirect URL
5. The panel provider uses the returned ID to reconcile which respondent completed, mark them for incentive payment

### Redirect URL Patterns by Scenario

Platforms universally support three redirect endpoints:

| Scenario | Description | Example URL Pattern |
|----------|-------------|-------------------|
| **Complete** | Respondent finished the full survey | `https://panel.example.com/complete?id={RESPONDENT_ID}` |
| **Screen-out** | Respondent did not qualify | `https://panel.example.com/screenout?id={RESPONDENT_ID}` |
| **Quota full** | Respondent qualified but quota was met | `https://panel.example.com/quotafull?id={RESPONDENT_ID}` |

### Variable Substitution Syntax by Platform

**Qualtrics:**
```
Complete URL: https://panel.example.com/complete?id=${e://Field/PanelID}
Screenout URL: https://panel.example.com/screenout?id=${e://Field/PanelID}
Quota Full URL: https://panel.example.com/quotafull?id=${e://Field/PanelID}
```
Where `PanelID` is an Embedded Data field set from the URL query string in the Survey Flow. [Qualtrics uses piped text](https://community.qualtrics.com/survey-platform-before-march-2021-56/redirect-to-a-url-setting-using-embedded-data-piped-text-only-4923) that resolves to the actual value at redirect time.

**Alchemer (formerly SurveyGizmo):**
```
https://panel.example.com/complete?id=[url("pid")]
```
Where `pid` is the query string parameter name from the inbound panel URL. Alchemer also supports `[question("response")]` for piping question answers into redirect URLs.

**QuestionPro:**
```
https://panel.example.com/complete?id=#custom1#
```
Custom variables (`#custom1#` through `#custom5#`) are populated from URL parameters and substituted at redirect time.

**SurveyMonkey:**
Redirect URL is configured in the Collector settings. Variable substitution uses `[custom_value]` syntax. Configuration is under Collect Responses > Edit Collector > Survey End Page per [Centiment setup guide](https://help.centiment.co/surveymonkey/required-setup).

### Implementation Recommendations for a Custom Survey Platform

If building your own survey platform that integrates with panel providers:

```
Inbound URL format:
https://yourdomain.com/survey/{surveyId}?pid={panelProviderId}&rid={respondentId}&src={sourceIdentifier}

Processing:
1. Extract query params on survey load
2. Store in session/state: { pid, rid, src }
3. On survey complete/screenout/quotafull:
   - Look up redirect URL template for this panel provider
   - Substitute {rid} placeholder with stored respondent ID
   - Perform client-side redirect (window.location.href)

Redirect URL template (stored per panel provider):
{
  "complete": "https://router.panelprovider.com/complete?rid={{rid}}&status=1",
  "screenout": "https://router.panelprovider.com/screenout?rid={{rid}}&status=2",
  "quotafull": "https://router.panelprovider.com/quotafull?rid={{rid}}&status=3"
}
```

**Key implementation details:**
- **Always URL-encode substituted values** to prevent injection
- **Log the redirect** (respondent ID, timestamp, destination, status) for reconciliation auditing
- **Handle the "no redirect" case**: If no panel provider is configured, show a standard thank-you/completion screen
- **Timeout fallback**: If redirect fails (e.g., panel provider URL is down), show a completion message with a manual link
- **Panel providers typically send a reconciliation file** (CSV of respondent IDs) for invoicing. Your platform should be able to export matching completion records for comparison

### Completion Screen UX (Before Redirect)

Best practice is a brief intermediate screen:

```
"Thank you for completing this survey!"
"You will be redirected in 3 seconds..."
[Progress indicator / spinner]
[If redirect doesn't work, click here]
```

This gives the respondent confirmation that their response was recorded before the redirect fires. A 2-3 second delay is standard. Some platforms skip this and redirect immediately (via HTTP redirect or instant `window.location` change), but the intermediate screen improves trust and handles redirect failures gracefully.

---

## Summary of Key Recommendations

**For your survey respondent experience**: Use one-question-at-a-time with section-based progress, conditional branching, and mobile-first touch targets (44x44pt minimum). Always include opt-out answer options and autosave responses.

**For your drag-and-drop builder**: Use `@dnd-kit` with the sortable preset. It offers the best combination of flexibility, accessibility, and animation quality for a survey question reordering interface in React. Pair with inline click-to-edit and a type picker palette.

**For your results dashboard**: Use a KPI summary strip at the top, per-question chart cards (bar charts for choice questions, heatmaps for matrix), cross-filter interactivity, and a dedicated cross-tabulation view. Recharts or Nivo handle most chart types; visx for custom time-series overlays.

**For your mobile slider/dial**: Make the handle at least 44x44pt, show a value bubble above the thumb during drag, use haptic feedback at key positions, and always provide a numeric input alternative. Position the slider in the lower half of the screen for one-handed use.

**For video + overlay**: Stack video above the dial input above the results chart on mobile. Synchronize the chart playhead with video time bidirectionally. Use auto-hiding overlays and non-intrusive timestamp markers.

**For panel integration**: Capture the respondent ID from the inbound URL query string, store it in session state, and substitute it into the panel provider's redirect URL template on completion/screenout/quota-full. Log all redirects for reconciliation.

---

Sources:
- [IxDF - UX Surveys Guide](https://ixdf.org/literature/article/ux-surveys)
- [Qualtrics - UX Survey Best Practices](https://www.qualtrics.com/articles/strategy-research/user-experience-ux-survey-best-practices/)
- [Mopinion - User Experience Surveys](https://mopinion.com/user-experience-surveys/)
- [Sprig - User Survey Best Practices](https://sprig.com/blog/how-to-design-user-surveys)
- [Fillout - Typeform Alternatives (OQAAT pattern)](https://www.fillout.com/blog/typeform-alternatives)
- [Lollypop Design - Progress Indicator Design](https://lollypop.design/blog/2025/november/progress-indicator-design/)
- [TensorBlue - Mobile-First UX Patterns 2026](https://tensorblue.com/blog/mobile-first-ux-patterns-driving-engagement-design-strategies-for-2026)
- [Numen Technology - Form Abandonment Optimization](https://www.numentechnology.co.uk/blog/contact-form-optimization-conversion-rates)
- [ASSIST Software - WCAG Accessibility 2026](https://assist-software.net/business-insights/web-accessibility-2026-complete-guide-wcag-compliance)
- [Puck Editor - Top 5 DnD Libraries for React 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- [dnd kit Official Site](https://dndkit.com/)
- [Atlassian - Pragmatic Drag and Drop](https://www.atlassian.com/blog/design/designed-for-delight-built-for-performance)
- [SurveyJS - React Form Builder](https://surveyjs.io/survey-creator/documentation/get-started-react)
- [Pencil & Paper - Dashboard UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [UXPin - Dashboard Design Principles 2025](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [Smashing Magazine - Real-Time Dashboard UX Strategies](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Buildform - Survey Dashboard Examples](https://buildform.ai/blog/survey-dashboard-examples/)
- [LogRocket - Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [AG Grid - Cross Filter Chart API](https://ag-grid.com/react-data-grid/integrated-charts-api-cross-filter-chart/)
- [NNGroup - Slider Design Rules of Thumb](https://www.nngroup.com/articles/gui-slider-controls/)
- [Smashing Magazine - Designing the Perfect Slider](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/)
- [UX Planet - Mobile Sliders](https://uxplanet.org/mobile-ux-design-sliders-761ce4bb2a86)
- [MeasuringU - Sliders vs Numeric Scales](https://measuringu.com/ltr-numeric-slider-desktop-mobile/)
- [ScienceDirect - Slider Design on Smartphones](https://www.sciencedirect.com/science/article/abs/pii/S000368702100168X)
- [Smashing Magazine - One-Hand Mobile Design](https://www.smashingmagazine.com/2020/02/design-mobile-apps-one-hand-usage/)
- [Touchstone Research - Complete Guide to Dial Testing](https://touchstoneresearch.com/the-complete-guide-to-dial-testing-real-time-feedback-for-smarter-content-decisions/)
- [Dialsmith - Perception Analyzer Technology](https://www.dialsmith.com/technology/)
- [Mercury Analytics - M2M Dial Testing](https://www.mercuryanalytics.com/advanced-tools/m2m-dial-testing/)
- [Adspyder - UX Design for Video Content 2026](https://adspyder.io/blog/ux-design-for-video-content/)
- [Qualtrics - Panel Company Integration](https://www.qualtrics.com/support/survey-platform/common-use-cases-rc/panel-company-integration/)
- [SurveyLegend - Panel Provider Integration](https://www.surveylegend.com/user-guide/integrating-panel-providers/)
- [Alchemer - Panel Integration Setup](https://help.alchemer.com/help/panel-integration)
- [QuestionPro - Custom Panel Redirect Links](https://www.questionpro.com/help/custom-panel-redirect-links.html)
- [Centiment - SurveyMonkey Setup Guide](https://help.centiment.co/surveymonkey/required-setup)
- [react-timeseries-charts (ESnet)](https://github.com/esnet/react-timeseries-charts)
- [MarketingProfs - Accessibility and Conversion](https://www.marketingprofs.com/articles/2025/53566/how-to-use-web-accessibility-standards-to-optimize-your-conversion-rate)