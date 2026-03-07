Now I have sufficient context. The project is migrating from an existing native app platform (Luntz-iOS, Luntz-MacOS, Luntz-WebPortal, Luntz-Backend) to a modern web-based survey platform. Let me deliver the comprehensive analysis.

---

# Storyline Studio -- Web-based Survey Platform with Video Dial Testing
## Comprehensive User Flow Analysis and Gap Identification

---

## User Flow Overview

### Flow 1: Respondent -- Complete Happy Path (Survey Completion)

```
[Survey Link] --> [Landing/Consent Page?] --> [Screening Questions]
    |                                              |
    |                                         [Pass/Fail]
    |                                              |
    |                                    [Fail] --> [Disqualification Screen]
    |                                              |
    |                                    [Pass] --> [Pre-Ballot Questions]
    |                                              |
    |                                         [Question 1..N]
    |                                              |
    |                                         [Video Dial Testing]
    |                                              |
    |                                    [Video Loads] --> [Slider Active]
    |                                              |
    |                                    [Video Ends] --> [Annotation Prompt?]
    |                                              |
    |                                         [Post-Ballot Questions]
    |                                              |
    |                                         [Completion/Thank You]
```

### Flow 2: Respondent -- Disqualification Path

```
[Survey Link] --> [Screening Q1] --> [Answer] --> [Screening Q2] --> [Answer]
                                                        |
                                              [Disqualifying Answer] --> [Termination Screen]
```

### Flow 3: Admin -- Study Creation and Publication

```
[Login] --> [Dashboard] --> [Create Study]
    |
    [Add Questions in Sequence]
    |    |-- Select question type (18 types)
    |    |-- Configure question options, required/optional, skip logic
    |    |-- Set phase (screening / pre-ballot / video / post-ballot)
    |    |-- Repeat
    |
    [Upload Video Assets]
    |
    [Configure Screening/Skip Logic]
    |
    [Preview Study]
    |
    [Publish/Activate] --> [Generate Shareable Link]
```

### Flow 4: Admin -- Results Monitoring and Export

```
[Dashboard] --> [Select Study] --> [Real-time Response Dashboard]
    |
    [View Aggregated Results]
    |    |-- Demographic segmentation
    |    |-- Dial overlay on video timeline
    |    |-- Per-question breakdowns
    |
    [Export Data]
         |-- CSV export
         |-- Video overlay export
```

### Flow 5: Respondent -- Video Dial Testing (Detailed Sub-flow)

```
[Enter Video Question] --> [Instructions/Tutorial?] --> [Video Loads]
    |
    [Video Plays]
    |    |-- Slider continuously captures value (0-100) every 1 second
    |    |-- Respondent moves slider left/right
    |    |-- Respondent optionally taps lightbulb at emotional moments
    |
    [Video Ends]
    |    |-- [Optional Annotation Prompt] --> [Text Entry] --> [Submit]
    |
    [Proceed to Next Question]
```

### Flow 6: Admin -- Study Editing and Iteration

```
[Dashboard] --> [Select Existing Study] --> [Edit Study]
    |
    [Modify Questions / Reorder / Delete]
    |
    [Re-upload or Replace Video Assets]
    |
    [Preview Changes]
    |
    [Republish or Save Draft]
```

### Flow 7: Admin -- Authentication and Access

```
[Visit App URL] --> [Login Page] --> [Authenticate]
    |
    [Success] --> [Dashboard]
    [Failure] --> [Error Message] --> [Retry / Password Reset?]
```

---

## Flow Permutations Matrix

### Respondent Flows

| Dimension | Variation | Notes |
|---|---|---|
| **User State** | First-time visitor | Has never seen the platform |
| | Returning (abandoned session) | Left mid-survey, returns to same link |
| | Returning (new survey) | Has taken a different study before |
| | Disqualified respondent re-attempting | Same person tries again |
| **Device** | Desktop browser (Chrome, Firefox, Safari, Edge) | Primary expected context |
| | Mobile browser (iOS Safari, Android Chrome) | Critical -- slider UX differs dramatically |
| | Tablet | Intermediate form factor |
| **Network** | Strong connection | Happy path |
| | Slow/throttled connection | Video buffering, data submission delays |
| | Intermittent connection | Drops mid-video, drops mid-question |
| | Complete offline | Opened link but lost connection |
| **Video State** | Video loads normally | Happy path |
| | Video fails to load (404, CORS, codec) | No spec for this |
| | Video buffers mid-playback | Slider still recording? |
| | Video format unsupported by browser | WebM vs. MP4 vs. HLS |
| **Survey State** | Survey is active/published | Happy path |
| | Survey is unpublished/draft | Respondent has link but study not live |
| | Survey is closed/archived | Study ended, link still floating around |
| | Survey is at capacity (quota filled) | Max respondents reached |
| **Progress** | Linear completion | Happy path |
| | Abandon mid-screening | Partial data handling |
| | Abandon mid-pre-ballot | Partial data handling |
| | Abandon during video playback | Partial dial data |
| | Abandon during post-ballot | Nearly complete |
| | Browser crash / tab close | Unintentional exit |
| **Accessibility** | Screen reader user | Slider and video accessibility |
| | Keyboard-only navigation | No mouse for slider |
| | Color-blind user | Red-yellow-green gradient |

### Admin Flows

| Dimension | Variation | Notes |
|---|---|---|
| **User State** | First admin creating first study | Onboarding flow |
| | Experienced admin creating study | Repeat workflow |
| | Admin editing published study with responses | Live data implications |
| | Admin viewing study they did not create | Multi-admin permissions |
| **Study State** | Draft (not yet published) | Editable |
| | Published (active, collecting responses) | What is editable? |
| | Closed (completed) | Archive vs. delete |
| | Published with 0 responses | Safe to edit fully? |
| | Published with 500+ responses | Destructive edit risk |
| **Video Upload** | Small file (under 50 MB) | Quick upload |
| | Large file (500 MB - 2 GB) | Progress indicator, timeout |
| | Unsupported format | Validation needed |
| | Upload interrupted | Resume or restart? |
| **Question Config** | Simple question (single Likert) | Happy path |
| | Complex skip logic chain | Circular reference risk |
| | 50+ questions in sequence | Performance, respondent fatigue |
| | Video question with no video uploaded | Validation gap |

---

## Missing Elements and Gaps

### Category: Authentication and Authorization

**Gap 1: Admin authentication mechanism is entirely unspecified.**
The spec mentions admin/researcher as a role but provides zero detail on how they authenticate. OAuth? Email/password? SSO? Magic link? This is foundational.

**Impact:** Cannot begin building any admin-side feature without this. Determines database schema for users, session management strategy, and security posture.

**Gap 2: No mention of admin role hierarchy or permissions.**
Can any admin edit any study? Is there an organization/team concept? Can multiple admins collaborate on one study? Is there a viewer vs. editor distinction?

**Impact:** Multi-tenant architecture decisions, data isolation, and collaboration features all depend on this.

**Gap 3: Respondent identity model is undefined.**
Respondents access via "unique link" -- but is this a per-respondent unique link, or a single shared link? How are respondents identified? Cookie? URL parameter? Do they need to provide an email or identifier?

**Impact:** Determines whether you can track returning respondents, prevent duplicate submissions, and link responses to panel participants.

---

### Category: Survey Link and Access Control

**Gap 4: Link structure and security model.**
What does the "unique link" look like? Options include: (a) single shared link for all respondents, (b) per-respondent unique token, (c) shared link with an entry form. Each has very different implications for security, tracking, and duplicate prevention.

**Impact:** Directly affects data integrity. A shared link with no gating allows anyone to submit multiple times, poisoning research data.

**Gap 5: Survey lifecycle states are not formally defined.**
What states can a survey be in? Draft, Active, Paused, Closed, Archived? Can a survey be paused and resumed? What happens to the link in each state?

**Impact:** Respondents hitting a link for a closed or paused survey will see an error unless this is handled.

**Gap 6: No quota or capacity management specified.**
Is there a maximum number of respondents? Can the admin set quotas (e.g., "I need 200 respondents, 50% female, 50% male")? What happens when quota is met -- does the survey close automatically?

**Impact:** Standard survey platforms universally support quotas. Without this, researchers cannot control sample composition, which is core to their methodology.

---

### Category: Video Dial Testing -- Technical

**Gap 7: Video playback control behavior is unspecified.**
Can the respondent pause the video? Rewind? Fast-forward? Seek? Or is the video forced to play linearly from start to finish without controls? This is a critical design decision for dial testing validity.

**Impact:** If respondents can pause/rewind, the second-by-second data model breaks down (what does "second 15" mean if they rewatched seconds 10-15?). If they cannot pause, what happens if they need to step away?

**Gap 8: Slider initial position and default behavior.**
What is the slider's initial value when the video starts? 50 (center/neutral)? 0? Is the initial position configurable per study? If the respondent never touches the slider, is every second recorded as the initial value?

**Impact:** Default slider position creates a massive bias in aggregated data if not thoughtfully designed. "Never touched" respondents will skew averages.

**Gap 9: Video buffering interaction with dial recording.**
If the video buffers mid-playback (pauses to load), does the slider continue recording values? Is the timer paused? Are buffering events logged?

**Impact:** Buffering creates data integrity issues. If the timer keeps running during a buffer, second 30 in the data might correspond to second 25 of actual video content.

**Gap 10: Multiple video questions in a single survey.**
The spec says "Video dial testing question(s)" (plural). Can a survey have multiple video questions? If so, is each independent? Can they have different configurations?

**Impact:** Affects question sequencing, data structure, and the possibility of comparison studies (A/B video testing).

**Gap 11: Video format, codec, and resolution requirements.**
No specification of supported video formats (MP4/H.264, WebM/VP9, HLS for adaptive streaming). No mention of resolution limits, file size limits, or whether server-side transcoding occurs.

**Impact:** Browser compatibility varies wildly. Safari does not support WebM. Without transcoding, admins could upload formats that fail on respondent devices.

**Gap 12: Lightbulb button behavior details.**
Can a respondent tap the lightbulb multiple times? Is there a cooldown? Is each tap logged as a discrete timestamp or is there a debounce? What visual/haptic feedback does the respondent get when they tap it?

**Impact:** Without debounce, accidental double-taps will create noisy data. Without feedback, respondents will not know if their tap registered.

---

### Category: Data Integrity and Session Management

**Gap 13: Session persistence and resume capability.**
If a respondent closes their browser tab at question 7 of 15, what happens when they return to the same link? Do they resume from question 7? Start over? See a "session expired" message?

**Impact:** Long surveys with video content take significant time. Respondents may be interrupted. Without session resume, completion rates will drop significantly, wasting recruitment costs.

**Gap 14: Data submission strategy (real-time vs. batch).**
Is answer data submitted to the server after each question? After each page? Only at the end? For video dial data specifically -- is the second-by-second data streamed during playback or submitted as a batch when the video ends?

**Impact:** If data is only submitted at the end and the respondent abandons, all partial data is lost. For video dial data, streaming creates server load; batching risks data loss.

**Gap 15: Duplicate submission prevention.**
What prevents a respondent from completing the same survey twice? IP-based? Cookie-based? Link-token-based? What if they are a legitimate respondent using a different device?

**Impact:** Duplicate responses corrupt research data. This is especially critical if using shared survey links.

**Gap 16: Partial response handling.**
Is a response that was abandoned at question 5 of 20 stored? Is it visible to the admin? Can it be included/excluded from analysis? Is there a "complete" vs. "partial" flag?

**Impact:** Researchers need to understand and control for partial responses. Ignoring them wastes the data; including them without flagging corrupts analysis.

---

### Category: Question Types and Configuration

**Gap 17: The 18 question types lack individual specifications.**
The spec lists 18 question type names (VIDEO, LIKERT, MULTI_LIKERT, STANDARD_LIST, WORD_LIST, NUMERIC, IMAGE_AB, IMAGE_LIST, TEXT_AB, WRITE_IN, CREATIVE_COPY, LIST_RANKING, AD_MOCK_UP, OVERALL_REACTION, SELECT_FROM_SET, MULTI_AD, COMPARISON, GRID) but provides zero detail on the configuration, validation rules, display behavior, or data format for any of them except VIDEO.

**Impact:** Each question type is essentially a mini-feature. Without specs, developers will guess. What is the difference between STANDARD_LIST and WORD_LIST? What does AD_MOCK_UP display? How does LIST_RANKING work on mobile? These are not self-evident from names alone.

**Gap 18: Question validation rules are unspecified.**
Which questions are required vs. optional? Can the admin configure this? What happens if a respondent tries to advance without answering a required question? What are valid ranges for NUMERIC? Min/max for text length on WRITE_IN?

**Impact:** Without validation, data quality degrades. Respondents can skip critical questions or enter garbage data.

**Gap 19: Skip logic and branching specification.**
The spec mentions "screening/skip logic" but provides no detail on the logic engine. Is skip logic per-question? Per-group? Can it reference answers from multiple previous questions (compound conditions)? What operators are supported (equals, not equals, contains, greater than)?

**Impact:** Skip logic is one of the most complex features in any survey platform. Without a clear specification, the implementation could range from a simple "if answer X, skip to question Y" to a full expression evaluator. This is an architectural decision.

**Gap 20: Question phasing and ordering.**
The spec mentions "screening, pre-ballot, video, post-ballot" phases. Are these hard phases enforced by the system, or are they conceptual? Can an admin put a video question before screening? Can post-ballot questions appear before pre-ballot ones? Is there validation on phase ordering?

**Impact:** If phases are just labels, the admin could create surveys that make no structural sense. If phases are enforced, the system needs ordering validation.

---

### Category: Admin -- Study Management

**Gap 21: Study editing after publication.**
What can an admin change about a study that is actively collecting responses? Can they add questions? Remove questions? Change question text? Modify skip logic? Replace a video? What are the data integrity implications of each edit type?

**Impact:** Changing a question mid-collection means early respondents answered a different question than late respondents. This is a data quality disaster unless carefully controlled.

**Gap 22: Study preview behavior.**
The spec says "Preview study." Does this mean the admin sees the survey as a respondent would? Is it fully interactive? Does preview data get stored (and if so, does it get flagged/excluded)?

**Impact:** If preview responses are stored without flagging, they contaminate real data.

**Gap 23: Study duplication/templating.**
Can an admin duplicate an existing study to create a new one? Can they save question sequences as templates? Given that Storyline runs programmatic/repeat testing programs (mentioned in the context doc), this is likely an important workflow.

**Impact:** Without duplication, admins must manually recreate similar studies, which is time-consuming and error-prone for a firm that runs repeat programs.

---

### Category: Results and Analytics

**Gap 24: Real-time dashboard specification.**
The spec says "Monitor responses in real-time dashboard" but provides no detail on what is shown. Response count? Completion rate? Dropout funnel? Live dial curves? Screening pass/fail rates?

**Impact:** Without definition, the dashboard could be anything from a response counter to a full analytics suite.

**Gap 25: Demographic segmentation definition.**
"Segmentation happens post-hoc based on screening answers." Which screening answers constitute demographics? Is there a standard set (age, gender, region) or is it completely dynamic based on whatever screening questions were asked? Can an admin define custom segments?

**Impact:** This determines whether segmentation is a predefined feature (age groups, gender, etc.) or a fully dynamic cross-tabulation engine. These are very different levels of complexity.

**Gap 26: Video overlay export specification.**
The spec mentions "video overlay export" as an export option. What exactly is this? A video file with dial lines burned in? An interactive web view? A data file that can be loaded into another tool? What format?

**Impact:** Rendering aggregated dial data over video in an exportable format is a significant engineering effort. If it means generating an actual video file server-side, that requires FFmpeg or similar processing and potentially significant compute resources.

**Gap 27: CSV export schema.**
What does the CSV export look like? One row per respondent with all answers as columns? One row per answer? How is video dial data (100+ data points per respondent per video) represented in CSV? Is it a separate export?

**Impact:** Researchers using the data in SPSS, R, or Excel have specific expectations about data format. Getting the export format wrong means the data is unusable without manual transformation.

---

### Category: Mobile and Responsive Design

**Gap 28: Mobile slider interaction model.**
On mobile, a slider that must be manipulated while a video plays is extremely challenging. The user needs to watch the video AND interact with the slider simultaneously. On a small screen, the video and slider compete for space. Touch targets for the lightbulb button must be large enough.

**Impact:** If a significant percentage of respondents use mobile (which is typical for survey panels), a poor mobile experience will cause abandonment and data quality issues.

**Gap 29: Mobile video playback constraints.**
iOS Safari has specific restrictions on autoplay, inline video playback, and fullscreen behavior. Android browsers vary in their treatment of video. The spec does not address these platform-specific behaviors.

**Impact:** The video may not play as expected on mobile, causing a broken experience for a large segment of respondents.

**Gap 30: Responsive layout for all 18 question types.**
IMAGE_AB, IMAGE_LIST, AD_MOCK_UP, GRID, and other visual question types need specific responsive design consideration. None is specified.

**Impact:** Questions that look good on desktop may be unusable on mobile.

---

### Category: Security and Privacy

**Gap 31: Data privacy and consent.**
There is no mention of: informed consent screens, privacy policy acknowledgment, GDPR compliance, data retention policies, right to erasure, or anonymization of respondent data.

**Impact:** For a research firm working with Google/YouTube and operating globally, GDPR and privacy compliance is not optional. This needs to be addressed before any real data is collected.

**Gap 32: Video content security.**
Research videos (often unreleased ads, concepts, or political content) are sensitive. The spec does not address: signed URLs for video access, DRM, download prevention, watermarking, or any content security measures.

**Impact:** If video URLs are guessable or shareable, respondents or bad actors could download and leak unreleased creative content. For a firm handling Google/YouTube ad testing, this is a serious commercial risk.

**Gap 33: Rate limiting and abuse prevention.**
No mention of rate limiting on survey submissions, API endpoints, or admin actions. No mention of bot detection or CAPTCHA for survey access.

**Impact:** Without bot detection, survey data can be poisoned by automated submissions. Without rate limiting, the system is vulnerable to abuse.

**Gap 34: Admin session security.**
No mention of session timeout, multi-factor authentication, or audit logging for admin actions.

**Impact:** Admin accounts have access to sensitive research data and client content. Compromise of an admin account could leak proprietary research.

---

### Category: Performance and Scalability

**Gap 35: Concurrent respondent capacity.**
No mention of expected concurrent respondent load. 10 respondents at once? 10,000? This determines architecture decisions around database connection pooling, video CDN strategy, and real-time data ingestion.

**Impact:** Under-provisioning causes failures during peak collection periods. Over-provisioning wastes resources.

**Gap 36: Video delivery strategy.**
The spec mentions S3/Cloudflare R2 for storage, but not delivery. Are videos served directly from S3? Via a CDN? Is adaptive bitrate streaming (HLS/DASH) supported? What about geographic distribution for global studies?

**Impact:** Serving large video files directly from S3 to global respondents will result in poor buffering performance. A CDN is essential for production use.

**Gap 37: Database performance for dial data.**
Each respondent generates a row of dial data for every second of video. A 60-second video with 1,000 respondents produces 60,000 data points for a single question. Aggregation queries over this data (segmented by demographics) could be expensive.

**Impact:** Without indexing strategy and potential pre-aggregation, the results dashboard will become slow as response counts grow.

---

### Category: Error Handling and Edge Cases

**Gap 38: Survey link for inactive/nonexistent study.**
What does a respondent see if the link points to a study that has been deleted, archived, or never existed?

**Impact:** Without a graceful error page, respondents see a generic 404 or application error, damaging brand perception.

**Gap 39: Video playback failure during dial testing.**
What happens if the video fails to load, stalls permanently, or encounters a codec error? Is the respondent stuck? Can they skip? Is the researcher notified?

**Impact:** A stuck respondent will abandon the survey. The admin has no way to know that video delivery is failing unless this is instrumented.

**Gap 40: Network failure during data submission.**
What happens if a respondent completes the survey but the final submission fails due to network error? Is there retry logic? Is data cached locally?

**Impact:** The respondent believes they completed the survey (and may have been promised an incentive), but their data is lost.

**Gap 41: Browser back button behavior.**
What happens if a respondent presses the browser back button during the survey? Do they go to the previous question? Does it break the flow? Is navigation state managed via the URL (pushState)?

**Impact:** Users instinctively use the back button. If it causes the survey to restart or break, respondent frustration and abandonment will be high.

---

### Category: Internationalization and Localization

**Gap 42: Multi-language support.**
The context document mentions "global delivery" and "multi-market surveys." The spec does not address: translated survey interfaces, RTL language support, translated system UI (buttons, instructions, error messages), or Unicode handling in text responses.

**Impact:** For a firm running multi-market research across global markets, language support is not a nice-to-have.

---

### Category: Accessibility

**Gap 43: WCAG compliance level.**
No accessibility requirements are stated. The slider interaction, video playback, and lightbulb button all present significant accessibility challenges for users with motor, visual, or cognitive disabilities.

**Impact:** Beyond legal compliance requirements, survey panels often include respondents using assistive technologies. Inaccessible surveys exclude these voices from research data.

**Gap 44: Color-blind accessibility for the slider gradient.**
The red-yellow-green gradient slider is specifically problematic for red-green color blindness (affecting approximately 8% of males). No alternative or accommodation is mentioned.

**Impact:** Color-blind respondents cannot use the color gradient as intended, potentially affecting their response behavior and data quality.

---

## Critical Questions Requiring Clarification

### Priority 1: Critical (Blocks Implementation or Creates Data/Security Risks)

**Q1. What is the respondent identity and link model?**
Is the survey link a single shared URL, or does each respondent get a unique tokenized link? How are respondents identified -- anonymous, cookie-tracked, or authenticated?
*Why it matters:* This is the single most foundational architectural decision for the respondent side. It determines the URL routing scheme, session management, duplicate prevention, and data model for responses.
*Assumption if unanswered:* Single shared link with anonymous respondents identified by a server-generated session token stored in a cookie, with no duplicate prevention beyond cookie check.
*Example:* `storylinestudio.com/s/abc123` (shared) vs. `storylinestudio.com/s/abc123?token=unique-per-respondent` (individual).

**Q2. Can respondents pause, rewind, or seek within the video during dial testing?**
Is the video forced to play linearly, or are standard playback controls available?
*Why it matters:* This fundamentally changes the data model. Linear-only playback means "second 15" is unambiguous. If seeking is allowed, you need a mapping between "wall clock time of the recording session" and "video timestamp," and the aggregation logic becomes significantly more complex.
*Assumption if unanswered:* Video plays linearly with no pause, rewind, or seek. This matches the behavior of the original native app dial testing paradigm.

**Q3. What is the data submission strategy for video dial data?**
Is dial data (slider value per second) sent to the server in real time via WebSocket, submitted as a batch when the video ends, or submitted progressively (e.g., every 10 seconds)?
*Why it matters:* Real-time streaming enables live monitoring but requires WebSocket infrastructure. Batch submission is simpler but risks total data loss if the session drops. Progressive submission is a middle ground.
*Assumption if unanswered:* Batch submission when video ends, with a local buffer. This is simpler and matches the "no real-time synchronization between respondents" statement.

**Q4. What is the admin authentication model?**
Email/password? OAuth (Google)? SSO? Is there a multi-tenant / organization model?
*Why it matters:* Blocks all admin-side implementation. Also determines whether multiple researchers can collaborate on studies and how data isolation works between clients.
*Assumption if unanswered:* Email/password with magic link option, single-tenant (all admins share all studies).

**Q5. What content security measures are required for video assets?**
Are videos served via signed/expiring URLs? Is download prevention needed? Watermarking?
*Why it matters:* Storyline tests unreleased ads and creative content for major clients (Google, YouTube). A leak of test content could damage client relationships and create legal liability.
*Assumption if unanswered:* Signed URLs with short expiry (e.g., 4 hours). No DRM or watermarking in V1.

**Q6. What happens when an admin edits a published study that already has responses?**
Can they edit at all? Are changes versioned? Does existing data get flagged?
*Why it matters:* Editing a live survey without controls is a data integrity hazard. Changing question text means early and late respondents answered different questions. This is a common pain point in survey platforms.
*Assumption if unanswered:* Published studies with responses are locked for editing. Admin must duplicate the study to make changes.

**Q7. Is there a consent/privacy screen before the survey begins?**
What data privacy framework applies? GDPR? CCPA? Is consent recorded and auditable?
*Why it matters:* Collecting survey data (especially with video interaction tracking) without informed consent exposes the firm to regulatory risk, particularly given global operations and enterprise clients.
*Assumption if unanswered:* A configurable consent screen is shown before screening begins, with consent logged per respondent.

---

### Priority 2: Important (Significantly Affects UX or Maintainability)

**Q8. What is the slider's initial/default value, and is "never touched" data distinguishable from "deliberately set to 50"?**
*Why it matters:* If the default is 50 (center) and a respondent never touches the slider, their data is indistinguishable from someone who actively chose 50 every second. This skews aggregated results.
*Assumption if unanswered:* Default is 50 (center/neutral). The system stores a flag indicating whether the slider was ever interacted with.

**Q9. Can respondents resume a partially completed survey?**
If they close the tab and return to the link, do they pick up where they left off?
*Why it matters:* Surveys with video content can take 15-30 minutes. Interruptions are common. Without resume, completion rates drop and recruitment costs increase.
*Assumption if unanswered:* Session state is stored server-side (keyed by session token). Respondents can resume within 24 hours.

**Q10. What are the specifications for each of the 18 question types?**
What does each question type display, how is it configured, and what data does it produce?
*Why it matters:* The 17 non-video question types represent the majority of the survey builder's surface area. Without specifications, developers will either block on each type or make assumptions that may not match the original app's behavior.
*Assumption if unanswered:* Refer to the original Luntz-iOS and Luntz-WebPortal implementations as the canonical specification.

**Q11. How does skip logic work technically?**
What is the rule format? What operators are supported? Can rules reference multiple questions (AND/OR)? Can skip logic create forward-only jumps, or can it loop?
*Why it matters:* Skip logic implementation ranges from trivial (if-then-skip) to deeply complex (expression evaluator with compound conditions). The complexity needs to be scoped.
*Assumption if unanswered:* Simple per-question skip logic: "If question X answer is Y, skip to question Z." Single condition, equality operator only, forward jumps only.

**Q12. What exactly does the "video overlay export" produce?**
Is it a rendered video file (MP4 with dial lines burned in)? A web page? A data package for another tool?
*Why it matters:* If it is a rendered video, server-side video processing (FFmpeg) is required, which is a significant infrastructure commitment. If it is a data package, the engineering effort is much smaller.
*Assumption if unanswered:* An interactive web-based player that can be shared via URL, not a rendered video file in V1.

**Q13. What is the expected concurrent respondent scale?**
Is the target 50 simultaneous respondents or 5,000?
*Why it matters:* Determines CDN strategy, database connection pooling, and whether the Next.js server-side rendering approach can handle the load.
*Assumption if unanswered:* Design for 500 concurrent respondents as initial target.

**Q14. How does the browser back button behave during the survey?**
*Why it matters:* Users will press it. If it is not handled, the survey will break.
*Assumption if unanswered:* Browser history is managed via pushState. Back button goes to previous question. Forward re-entering a video question does NOT replay the video but shows a "you already answered this" state.

**Q15. What mobile breakpoint strategy applies, especially for the video dial question?**
On a 375px-wide phone screen, how are the video, slider, and lightbulb button arranged?
*Why it matters:* The core interaction (watching video while manipulating slider) is fundamentally different on mobile. This needs explicit design direction.
*Assumption if unanswered:* Video stacked above slider. Slider is full-width below the video. Lightbulb button is a floating action button overlaying the video area.

---

### Priority 3: Nice-to-Have (Improves Clarity, Has Reasonable Defaults)

**Q16. Is there study duplication or templating functionality?**
*Why it matters:* Given Storyline runs repeat testing programs, this is a high-value workflow feature.
*Assumption if unanswered:* Not in V1. Admin creates each study from scratch.

**Q17. Is there an undo/redo mechanism in the study builder?**
*Why it matters:* Complex study construction benefits from undo capability, but it is not blocking.
*Assumption if unanswered:* No undo/redo in V1.

**Q18. Are there email notifications for admins (e.g., "your study reached 100 responses")?**
*Assumption if unanswered:* Not in V1. Admins check the dashboard manually.

**Q19. Is there any form of respondent incentive tracking or completion redirect?**
Survey panel integrations typically redirect respondents to a panel provider URL upon completion with a unique ID for incentive reconciliation.
*Assumption if unanswered:* The thank-you page supports a configurable redirect URL with respondent ID parameter substitution.

**Q20. What is the annotation prompt after video playback?**
Is it a single text field? Multiple fields? Structured prompts? Is the prompt text configurable by the admin?
*Assumption if unanswered:* Single text field with admin-configurable prompt text.

**Q21. What analytics/tracking is needed on the respondent side?**
Page views, time-per-question, dropout points, device info?
*Assumption if unanswered:* Basic paradata (start time, end time, device type, browser) stored with each response.

**Q22. Is there a "test/soft launch" mode for studies?**
Can an admin send the link to a small group first, verify data quality, then open to the full panel?
*Assumption if unanswered:* Preview mode generates test responses that are flagged and can be deleted before full launch.

---

## Recommended Next Steps

1. **Resolve the seven Critical questions immediately.** Questions Q1-Q7 are architectural decisions that affect database schema, API design, URL structure, and infrastructure choices. These cannot be deferred.

2. **Create detailed specifications for each of the 18 question types.** For each type, document: what the admin configures, what the respondent sees, what validation applies, what data is stored, and how it renders on mobile. Consider extracting this from the original Luntz-iOS and Luntz-WebPortal source code (available as ZIP archives in the project directory at `/Users/joshburris/Projects/Storyline Studio App/Storyline Studio (App)/Storyline-source/`).

3. **Define the skip logic rule engine scope.** This is one of the highest-complexity features. Start with a simple model (single-condition, equality-only, forward-jump) and define the expansion path.

4. **Create wireframes or mockups for the mobile video dial experience.** This is the most novel and challenging UX element. It needs design validation before implementation begins.

5. **Define the survey lifecycle state machine.** Create a formal state diagram showing all valid states (Draft, Active, Paused, Closed, Archived) and the transitions between them, including what actions are available in each state.

6. **Define the data export schemas.** Work backward from what researchers need in their analysis tools (SPSS, R, Excel). Design the CSV schema, then build the data model to support it.

7. **Establish security requirements as a formal document.** Given the client base (Google, YouTube) and content sensitivity (unreleased ads), security and content protection requirements should be explicit, not implicit.

8. **Conduct a technical spike on video delivery.** Test video playback performance across target browsers and devices using S3/R2 with a CDN. Validate that the second-by-second slider recording works reliably on iOS Safari, Android Chrome, and desktop browsers with varying network conditions.

9. **Extract and document the original app's behavior.** The Luntz source code archives (`Luntz-iOS.zip`, `Luntz-Backend.zip`, `Luntz-WebPortal.zip`, `Luntz-MacOS.zip`, `Luntz-Backend.docs.zip`) at `/Users/joshburris/Projects/Storyline Studio App/Storyline Studio (App)/Storyline-source/` represent the canonical implementation of many of these features. Reviewing them would answer many of the question-type and behavior questions without requiring new design decisions.

10. **Define a phased delivery plan.** Given the scope (18 question types, skip logic engine, video dial testing, real-time dashboard, export system), this should be broken into clear phases with a working end-to-end flow delivered early (e.g., Phase 1: single video question survey with basic results, no skip logic, no segmentation).