I now have extensive research gathered. Let me compile the comprehensive competitive analysis.

---

# Dialsmith Competitive Analysis: Deep Dive

## Company Overview

**Dialsmith** is a Portland, Oregon-based technology company founded by David Paull. Paull was VP at Market Strategies International for nearly a decade starting in 2001, then purchased the business unit from MSI in 2008 and re-launched it as Dialsmith in 2009. At time of early press coverage (2013), it was described as a six-person company. They have since grown modestly and launched **Engagious**, an in-house consulting arm led by Paull that provides full-service research using Dialsmith's technology.

Dialsmith positions itself as **"your one-stop source for dial testing research solutions"** and claims over 30 years of history with the Perception Analyzer brand (the technology predates the company). Their technology has been used in more than 45 countries.

---

## 1. Products and Services

Dialsmith operates three distinct product/service tiers:

### Product A: Perception Analyzer (In-Person Hardware System)
- Physical handheld wireless dials given to focus group participants
- Wireless console connects to a PC running their software
- Supports 1 to 100+ dials per session (most common: 10-50)
- PA 9.0 and PA 9.0 Media are the latest versions
- Can be **purchased outright** (includes training) or **rented per-project**
- Contract pricing available for volume commitments

### Product B: Perception Analyzer Online (PA Online) -- Full-Service
- Their flagship online dial testing product
- Typically operated as a managed/full-service engagement
- Three business days turnaround typically required for setup (media hosting, programming, QA)
- Paired with surveys, online focus groups, communities
- Engagious uses this for their consulting work (6-8 week end-to-end projects)

### Product C: Slidermetrix -- Self-Service / DIY
- **Subscription-based** web application for quick-turn online dial testing
- Self-service: spin up studies in 1-2 hours
- Real-time results viewing
- Self-service reporting portal
- Was described as being in "public beta" at some point (may still be limited availability)

### Services Layer
- Survey programming and hosting
- Project management
- Online focus group management and hosting
- Sample procurement and quota management
- Verbatim coding
- Consulting (via Engagious brand)

---

## 2. Technology Platform

### In-Person Hardware
- **Handheld wireless dials**: Physical rotary devices respondents use to indicate continuous feedback
- **Wireless receiver/console**: Communicates with dials, connects to computer
- **Desktop software (Windows)**: PA 9.0 supports latest OS versions and high-resolution displays
- Dials can be polled **discretely** (per-question) or **continuously** (moment-to-moment)
- Results displayed in real-time to moderator and observers

### Online/Web Platform
- **Browser-based**: No plugins, downloads, or special software required
- **Mobile-friendly**: Works on smartphones, tablets, desktops, laptops
- **On-screen slider** replaces the physical dial, positioned near the test media
- Built on what appears to be a proprietary web stack
- Respondents access via **URL/link** sent to them (no app install required)

### Video Infrastructure
- **Built-in Tier 1 CDN** for video hosting with maximum security
- **On-the-fly video transcoding** for optimal format and resolution per device
- Option to **upload media** to their server, host on YouTube, or use your own secure server
- Supports media from 30 seconds to 60+ minutes
- Video and slider are displayed together so respondents rate while watching

---

## 3. Online/Digital Dial Testing Features

Based on all gathered intelligence:

- **On-screen slider (0-100 scale)**: Respondents move slider continuously while watching/listening
- **Second-by-second data capture**: Position recorded every second per respondent
- **"Take Action" buttons**: Configurable actions like "Tune Out," "Change Channel," "Buy," "Skip" -- multiple buttons can be configured simultaneously
- **Integration with survey questions**: Closed-ended questions (Likert, categorical, attitudinal) can be interspersed with dial sessions
- **Third-party survey platform integration**: Embeds into Qualtrics and presumably other platforms via iFrame or similar
- **Real-time data aggregation**: Mean scores calculated second-by-second for total group and configured sub-groups
- **No download/plugin requirement**: Runs entirely in the browser
- **Customizable scales and labels**: Though extent of customization is unclear

---

## 4. Video Playback + Dial Capture

This is the core of their offering:

- Video plays in a media player **with the slider positioned directly below or adjacent**
- Respondent watches video and continuously adjusts slider based on reaction
- System captures slider position **every second** from every respondent
- Data is timestamped and aligned to video timeline
- Video is hosted on their CDN with transcoding for cross-device compatibility
- **Synchronized playback**: Results can be overlaid on the video timeline after collection
- The "moment-to-moment overlay" shows aggregate response lines superimposed on the video playback

**Limitations/unknowns**: It is unclear how they handle:
- Buffering or network issues during video playback
- Whether they enforce that respondents actually watch the full video
- DRM or watermarking on their own platform (competitor Touchstone Research explicitly advertises dynamic user-level watermarking)
- Adaptive bitrate streaming vs. fixed quality

---

## 5. Results/Analytics Dashboard

### Reporting Portal
- **Real-time access** to survey and media rating data
- **Moment-to-moment video overlay**: Aggregate dial lines overlaid on the video timeline -- this is the signature visualization
- **Line charts of dial ratings**: Second-by-second line graphs for total and sub-groups
- **Crosstabs**: Cross-tabulation of data available in the portal
- **Banners and tables**: Can be created within the reporting portal
- **Field and data reports**: Accessible through the portal

### Slidermetrix Reporting Portal
- Self-service access to data visualization and export
- Real-time results as responses come in

**Assessment**: Based on available information, the reporting seems functional but likely feels dated. The emphasis is on traditional market research outputs (crosstabs, banners, SPSS export) rather than modern interactive dashboards. There is no evidence of:
- Interactive drill-down capabilities
- AI-powered insight generation
- Heatmaps or sentiment maps
- Shareable/embeddable dashboards
- Real-time collaborative annotation

---

## 6. Export Capabilities

- **CSV** export
- **Excel** export
- **SPSS** export
- "Most any format you need" (their claim)
- Raw data export with each respondent's second-by-second data points
- Appears oriented toward traditional market research data analysis workflows

**Notable gap**: No mention of PowerPoint export, video clip export with overlay, or API-based data access. Competitor Conjointly explicitly mentions PowerPoint and Excel export.

---

## 7. Question Types Beyond Video Dial Testing

The Perception Analyzer system supports:

- **Discrete Choice** questions
- **Categorical** questions
- **Intensity/Likert Scale** questions
- **Attitudinal** questions
- **Trade-off / Point Allocation** exercises
- **Van Westendorp Price Elasticity**
- **X-Y Scattergram**
- **Conjoint Analysis** (via the in-person dials)
- **Gender/demographic** segmentation questions

For the online platform specifically, the supported question types appear more limited. The emphasis is on **closed-ended questions** that can be asked alongside dial sessions. There is no clear evidence of:
- Open-ended text responses
- Image/concept testing (beyond video)
- MaxDiff
- Card sorting
- Ranking questions
- Matrix/grid questions
- Modern interactive question types

---

## 8. Respondent Access

- **Link-based access**: Respondents receive a URL to the online survey
- **No app installation required**: Browser-based
- **No plugins or downloads**: Works in modern browsers
- **Cross-device**: Desktop, laptop, tablet, smartphone (smartphone has "some restrictions" with Slidermetrix)
- **Integration with panel providers**: Dialsmith offers sample procurement or researchers use their own panels
- **Qualtrics integration**: Can embed dial testing within Qualtrics survey flows

**Assessment**: This is a standard approach. No evidence of:
- Unique respondent authentication
- QR code access
- In-app experiences
- Kiosk mode
- Offline capability

---

## 9. Pricing Model

Dialsmith does **not publish pricing publicly**. Based on research:

- **In-Person Perception Analyzer**: Available for **outright purchase** (with training) or **per-project rental**. Contract pricing for volume. Likely in the **tens of thousands of dollars** for a system purchase given the specialized hardware.
- **PA Online (Full-Service)**: Custom quotes per project. Given full-service nature with 3-day setup, likely **$5,000-$25,000+ per project** depending on scope (this is my estimate based on industry norms, not confirmed).
- **Slidermetrix (Self-Service)**: **Subscription-based**. Pricing not published. Was in "public beta" which suggests it may be newer/less established.
- **Engagious Consulting**: Full 6-8 week projects likely in the **$50,000-$150,000+ range** for complete messaging research engagements.

The overall pricing model is **enterprise/sales-led** with no self-service checkout or transparent pricing -- a classic B2B market research vendor approach.

---

## 10. Notable Clients and Case Studies

Dialsmith has exceptional brand recognition in political research:

- **CNN**: Used Perception Analyzer for presidential debate coverage since 2008; real-time voter reaction focus groups featured prominently on-air
- **Fox News / Frank Luntz**: Luntz's famous focus group dial tests on Fox News use Perception Analyzer
- **MSNBC, CNBC, PBS, NBC, ESPN, BBC**
- **MTV, VH1, Food Network**
- **The Washington Post, The New York Times**
- **TED Conferences**
- **Maslansky+Partners**: Uses Slidermetrix for quick-turn messaging research
- **Super Bowl advertisers**: Technology used to evaluate $4M+ Super Bowl ad spots
- **U.S. Presidential campaigns**: Claims their technology has helped elect every U.S. President since Ronald Reagan

Industry verticals served: political campaigns, litigation/mock juries, advertising, media/entertainment, CPG, corporate communications.

---

## Competitive Landscape

### Direct Competitors

| Company | Product | Strengths | Weaknesses |
|---------|---------|-----------|------------|
| **Touchstone Research** | Dial Tester (launched Jan 2025) | Modern platform, dynamic watermarking, SOC2 Type II, KidSafe certified, full/DIY/hybrid models | Newer entrant, less brand recognition |
| **Conjointly** | Dial Testing solution | Part of broader survey platform, ISO certified, PowerPoint export, global panel access | Not specialized in dial testing |
| **QuestionPro** | TubePulse | Integrated into major survey platform, VideoAI for qualitative, free tier available | Dial testing is a feature, not the core product |
| **SurveyAnalytics** | Dial Testing module | Real-time overlay reporting, integrated survey platform | Limited information on capabilities |
| **Mercury Analytics** | M2M Dial Testing | Mobile-friendly, political research focus | Smaller player, limited public information |

### Indirect Competitors
- **Qualtrics** (via Dialsmith partnership, but could build native)
- **Any video survey platform** that could add continuous rating

---

## Strategic Analysis: Strengths, Weaknesses, and Opportunities

### What Dialsmith Does Well (Learn From)

1. **30+ year brand heritage**: "Perception Analyzer" is essentially synonymous with dial testing in the market research industry. This brand moat is real.

2. **Celebrity-level visibility**: CNN debate coverage provides extraordinary earned media. Every election cycle, millions of viewers see their technology on TV.

3. **Full-stack offering**: They cover in-person hardware, online self-service, online full-service, and consulting -- every tier of the market.

4. **Second-by-second data capture**: The core methodology is proven and well-understood by the research community.

5. **Video overlay visualization**: The signature output -- aggregate dial lines overlaid on video playback -- is the industry-standard visualization that researchers expect and clients understand.

6. **Qualtrics integration**: Smart partnership that extends their reach into the dominant enterprise survey platform.

7. **Configurable "Take Action" buttons**: A clever feature that captures discrete behavioral intent moments alongside continuous feedback.

8. **Broad question type support**: Especially on the in-person system, they support sophisticated exercises like Van Westendorp and conjoint.

### Dialsmith's Weaknesses / Gaps to Exploit

1. **Dated technology and UX**: The website itself is WordPress-based and heavy with CSS issues (the WebFetch tool could barely extract content due to JavaScript rendering problems). If the respondent-facing and researcher-facing UX is similarly aged, this is a major vulnerability. Their latest "major release" announcements reference 2015 features.

2. **No transparent pricing or self-service purchasing**: Everything requires "contact us." In 2026, modern platforms offer instant signup, free trials, and transparent pricing tiers. This is a massive friction point for potential customers.

3. **Small team**: Started as 6 people. Even with growth, this is likely a 15-30 person company. Limited engineering resources mean slower innovation cycles.

4. **Smartphone limitations**: They explicitly note "some restrictions" for smartphone testing with Slidermetrix. In a mobile-first world, this is a significant gap.

5. **No evident content security features**: No mention of watermarking, DRM, or content protection for pre-release media. Touchstone Research explicitly addresses this with dynamic watermarking and SCT integration.

6. **Export-oriented rather than insight-oriented analytics**: Their reporting focuses on getting data out (CSV, SPSS, Excel) rather than providing in-platform insights. No AI-powered analysis, no automated highlight detection, no sentiment analysis, no natural language summaries.

7. **No open-ended or qualitative question types evident online**: The online platform appears limited to closed-ended questions alongside dial testing. No video open-ends, text responses, or modern qual approaches integrated.

8. **Legacy in-person hardware dependency**: A significant portion of their revenue and identity is tied to physical dials and focus group rooms. This makes them culturally and financially anchored to a declining modality.

9. **No API or developer-focused approach**: No evidence of APIs, webhooks, or programmatic access. Modern platforms should offer this for integration with data pipelines and other tools.

10. **Slow setup times**: Three business days for full-service setup is an eternity. A modern platform should enable study creation and launch in minutes.

11. **No real-time collaboration features**: No evidence of team dashboards, collaborative annotation, comment threads on specific video moments, or shared workspaces.

12. **No A/B testing or multivariate testing**: No evidence of built-in experimental design for comparing multiple versions of content.

13. **No panel/audience management**: They offer sample procurement as a service but no built-in panel management tools.

### Your Competitive Opportunities

Based on Dialsmith's gaps, here are the highest-impact areas for differentiation:

1. **Modern, beautiful UX**: Both for researchers (study creation, results viewing) and respondents (video + slider experience). Make it feel like a consumer-grade product, not enterprise research software from 2012.

2. **Instant self-service with transparent pricing**: Free trial, tiered pricing, no sales calls required to get started. Capture the long tail of researchers who cannot justify a Dialsmith engagement.

3. **Mobile-first design**: Build the slider experience for phones first, then scale up to tablets and desktops. Dialsmith went desktop-first and mobile is an afterthought.

4. **AI-powered analytics**: Automatically identify peaks, valleys, and inflection points. Generate natural language summaries. Correlate dial movements with on-screen content. Detect emotional segments. This is the kind of feature that a 30-year-old company will struggle to build.

5. **Content security**: Dynamic per-respondent watermarking, no-download video playback, screenshot prevention (as much as browser allows), viewing attestation. Critical for entertainment and advertising pre-release testing.

6. **Rich question types**: Combine dial testing with modern survey question types -- open-ended text, video responses, image-based questions, MaxDiff, ranking, matrix grids, concept testing. Be a complete research tool, not just a dial.

7. **Real-time collaboration**: Let multiple team members watch results come in together, annotate specific video moments, share findings with stakeholders via live links.

8. **API-first architecture**: Let power users and enterprise customers integrate dial testing data into their existing data pipelines, BI tools, and reporting systems.

9. **Instant video clip export**: When a researcher identifies a key moment, let them clip that video segment with the overlay and export it as a shareable video for presentations. Dialsmith seems to only offer data export, not video/visual export.

10. **Speed**: Study creation in minutes, not days. This alone will win customers from Dialsmith's full-service model.

---

## Sources

- [Dialsmith Homepage](https://www.dialsmith.com/)
- [Dialsmith Technology](https://www.dialsmith.com/technology/)
- [Online Dial Testing](https://www.dialsmith.com/dial-testing-solutions/online-dial-testing/)
- [Perception Analyzer Online](https://www.dialsmith.com/dial-testing-focus-groups-products-and-services/perception-analyzer-online-dial-research/)
- [Perception Analyzer In-Person](https://www.dialsmith.com/dial-testing-focus-groups-products-and-services/perception-analyzer-dial-research/)
- [Slidermetrix Reporting](https://www.dialsmith.com/slidermetrix-reporting/)
- [PA Online New Features (PRWeb 2015)](https://www.prweb.com/releases/dialsmith_releases_new_features_upgrades_in_perception_analyzer_online_/prweb12608010.htm)
- [Dialsmith-Qualtrics Partnership](https://www.dialsmith.com/blog/shedding-light-on-the-qualtrics-dialsmith-partnership/)
- [CNN/Fox News Dial Testing](https://www.dialsmith.com/dial-testing-resources/cnn-and-fox-news-dial-testing/)
- [Political Research Technology](https://www.dialsmith.com/blog/evolving-tech-behind-political-public-policy-research/)
- [Maslansky Case Study](https://www.dialsmith.com/blog/maslansky-uses-slidermetrix-for-quickturn-online-research/)
- [Engagious Online Dial Testing](https://engagious.com/online-dial-testing/)
- [Touchstone Research Dial Tester](https://touchstoneresearch.com/dial-tester/)
- [Conjointly Dial Testing](https://conjointly.com/solutions/dial-testing/)
- [QuestionPro TubePulse](https://www.questionpro.com/features/tubepulse-question.html)
- [SurveyAnalytics Dial Testing](https://www.surveyanalytics.com/dial-testing/)
- [Mercury Analytics M2M](https://www.mercuryanalytics.com/advanced-tools/m2m-dial-testing/)
- [ZoomInfo Dialsmith Profile](https://www.zoominfo.com/c/dialsmith-llc/345689457)
- [David Paull on Medium](https://davidpaull.medium.com/what-is-dial-testing-38fce2b9a0a7)
- [Dialsmith Qualtrics Page](https://www.dialsmith.com/qualtrics/)
- [Touchstone Research - What is Dial Testing](https://touchstoneresearch.com/what-is-dial-testing-how-online-dial-testing-optimizes-content-in-real-time/)