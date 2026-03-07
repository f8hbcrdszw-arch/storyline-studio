Now I have a thorough understanding of the plan. Here is my comprehensive security review.

---

# Security Review: Storyline Studio Web Survey Platform

## Executive Summary

This platform presents a **high-value target** -- it handles unreleased advertising content for major brands (Google/YouTube), making content leakage a business-critical risk. The architecture combines public-facing unauthenticated endpoints (survey runner) with privileged admin surfaces (study builder, results, export), creating a broad attack surface. The plan demonstrates some security awareness (IP hashing, signed URLs, consent logging) but has significant gaps that must be addressed before production deployment.

**Overall Risk Rating: HIGH** -- primarily driven by the value of the protected content, the public attack surface, and several architectural decisions that lack sufficient security controls.

---

## Detailed Findings

### CRITICAL SEVERITY

#### C1. Signed URL Leakage -- Pre-Release Content Exposure

**Location in plan:** "Content Security" section (line 279) and Phase 1 (line 323)

**Issue:** The plan specifies signed URLs with 4-hour expiry for video assets, but a 4-hour window is excessively long. Once a signed URL is obtained by any respondent, it can be shared freely during that window. Combined with the lack of DRM or watermarking, any respondent can:

1. Extract the signed URL from browser DevTools (Network tab)
2. Download the full pre-release video asset directly from R2/S3
3. Distribute it before the client's intended release date

The plan explicitly acknowledges: "No DRM or watermarking in V1" and "Right-click download prevention (CSS pointer-events on video overlay) -- a deterrent, not foolproof." CSS-based download prevention is trivially bypassed.

**Impact:** Leak of unreleased advertising content for major clients (Google, YouTube). Potential contract breach, legal liability, and catastrophic reputational damage to Storyline Strategies.

**Recommendations:**

1. **Reduce signed URL TTL to 15-30 minutes**, not 4 hours. Regenerate URLs on demand when the respondent reaches the video question. The video should be fully buffered within minutes; there is no reason for a 4-hour window.
2. **Bind signed URLs to session context.** Implement a proxy endpoint (e.g., `/api/media/[questionId]`) that validates the respondent's session cookie before issuing a fresh signed URL. Never embed signed URLs directly in HTML source.
3. **Implement referrer and IP binding.** When generating signed URLs, restrict them to the originating IP address or at minimum the Storyline Studio domain via the `Referer` header using CloudFlare access policies.
4. **Add invisible watermarking** (even a simple dynamic text overlay with respondent_id rendered into the video stream via a server-side proxy would deter leaks and enable attribution). This is listed as "Future" but should be prioritized given the client profile.
5. **Implement Content-Disposition headers** on R2 to prevent inline browser rendering if a URL is accessed directly (force download, which is at least auditable).
6. **Add CORS restrictions** on the R2 bucket so that only `storylinestudio.com` origins can fetch video assets.

---

#### C2. No Rate Limiting on Public Survey Endpoints -- Bot/Abuse Vector

**Location in plan:** Phase 7 (line 539) mentions rate limiting as a polish item. Phase 3 (lines 367-401) defines the public survey endpoints.

**Issue:** Rate limiting is deferred to Phase 7 ("Polish & Production Readiness") but the public survey endpoints are deployed in Phase 3. This means the platform will be live and accepting production traffic with zero rate limiting for potentially weeks. The public endpoints require no authentication -- anyone with the survey link can submit unlimited responses.

**Attack vectors:**
- **Data poisoning:** A competitor or bad actor floods a study with thousands of fake responses, destroying data quality for a paying client's research
- **Resource exhaustion:** Automated submission of large JSONB answer payloads (especially VIDEO_DIAL with fabricated per-second data) consumes database storage and processing resources
- **Quota manipulation:** If respondent quotas are used, bots can fill quotas with garbage data before real respondents complete the survey

**Impact:** Complete compromise of research data integrity. Client studies rendered useless.

**Recommendations:**

1. **Rate limiting MUST be implemented in Phase 3, not Phase 7.** This is not polish; it is a fundamental security control for public endpoints.
2. Implement per-IP rate limiting: maximum 1 new response creation per minute per IP, maximum 60 answer submissions per minute per IP.
3. Add a server-side `respondent_id` generation rate limit: maximum 5 new respondent IDs per IP per hour.
4. Implement response velocity checks: flag and block responses that complete suspiciously fast (e.g., a 20-question survey completed in under 60 seconds).
5. Add CAPTCHA or proof-of-work challenge before the first question loads (invisible reCAPTCHA v3 is low-friction).

---

#### C3. Cookie-Only Respondent Identity -- Trivially Bypassed Duplicate Prevention

**Location in plan:** "Respondent Identity & Link Model" section (lines 247-252)

**Issue:** Respondent identity relies entirely on a cookie and localStorage UUID. This duplicate prevention mechanism is trivially defeated by:

1. Opening an incognito/private window
2. Clearing cookies
3. Using a different browser
4. Any automated tool (curl, Puppeteer, etc.) that does not send cookies

The plan describes a shared survey link model (`storylinestudio.com/s/abc123`) with no per-respondent tokens, meaning anyone who obtains the link can take the survey unlimited times.

**Impact:** A single person can submit dozens of responses, skewing research data for paying clients.

**Recommendations:**

1. **Implement browser fingerprinting** as a secondary deduplication signal. Libraries like FingerprintJS can generate a stable device identifier that persists across incognito sessions and cookie clears. Flag (do not necessarily block) responses from the same fingerprint.
2. **Add server-side deduplication heuristics:** Flag responses from the same IP hash that have similar screening answers and complete within a similar timeframe.
3. **Track and surface duplicate indicators to admins** on the results dashboard so they can filter suspicious responses during analysis.
4. **For high-security studies, support per-respondent unique links** (e.g., `storylinestudio.com/s/abc123?t=unique-token`) distributed via panel providers. This is mentioned as a panel integration future consideration but should be available in V1 for clients with unreleased content.

---

### HIGH SEVERITY

#### H1. No Input Validation Specification for JSONB Answer Payloads

**Location in plan:** Answer value shapes (lines 119-138), API routes `app/api/answers/route.ts` (line 408)

**Issue:** The plan defines 17 different answer `value` JSON shapes stored in a JSONB column, but specifies no validation schema or size limits. The `VIDEO_DIAL` type is particularly concerning:

```
{ feedback: { "0": 50, "1": 62, ... }, lightbulbs: [3.2, 17.8], 
  actions: { "tune_out": [5.1, 22.3] }, annotations: ["text..."] }
```

Without validation, an attacker can submit:
- A `feedback` object with millions of keys (DoS via storage exhaustion)
- Arbitrary keys in the `actions` object (data model pollution)
- Extremely long annotation strings (megabytes of text)
- Nested JSON structures that cause parsing/aggregation issues downstream
- XSS payloads in text fields (`annotations`, `WRITE_IN` text, etc.) that execute when admins view results

**Impact:** Storage exhaustion, denial of service, XSS against admin users, data corruption.

**Recommendations:**

1. **Define and enforce a Zod validation schema for every answer type.** Each question type should have a strict schema that validates structure, types, value ranges, array lengths, and string lengths.
2. For `VIDEO_DIAL`: validate that `feedback` keys are integers from 0 to `video_duration_secs`, values are integers 0-100, `lightbulbs` entries are floats within video duration, total payload size under 100KB.
3. For all text fields (`WRITE_IN`, annotations): enforce a maximum character length (e.g., 5000 characters) and strip/escape HTML tags on ingest.
4. Implement a global maximum request body size limit on all API routes (e.g., 1MB).
5. Validate answer submissions against the actual question configuration: if a question has 5 options, reject a `selected` array with IDs not in the option set.

---

#### H2. XSS Risk in Admin-Configured Content Rendered to Respondents

**Location in plan:** Question configuration (lines 62-77), Survey Runner rendering (lines 380-395)

**Issue:** Admins configure question titles, prompts, option labels, and other text content that is rendered to respondents in the Survey Runner. If admin accounts are compromised, or if a future feature allows non-trusted users to create studies, any stored XSS in question content executes in the browsers of potentially thousands of respondents.

Additionally, respondent-submitted text (write-in answers, annotations) is displayed to admins on the results dashboard. This is a classic stored XSS vector: a malicious respondent injects script tags in a write-in answer that executes in the admin's authenticated browser session.

**Impact:** Respondent-to-admin XSS could steal admin session tokens, exfiltrate all study data, or modify studies. Admin-to-respondent XSS (via compromised account) could steal respondent cookies or redirect to phishing pages.

**Recommendations:**

1. **Sanitize all user-provided content on output.** React's JSX escaping handles most cases, but explicitly audit for:
   - `dangerouslySetInnerHTML` usage (must never be used with user content)
   - Rendering of admin content in `href` attributes (javascript: protocol XSS)
   - SVG/image injection via `image_url` fields in `QuestionOption` and `MediaItem`
2. **Implement Content Security Policy (CSP) headers:**
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; 
   style-src 'self' 'unsafe-inline'; img-src 'self' https://*.r2.dev; 
   media-src 'self' https://*.r2.dev https://www.youtube.com; 
   frame-src https://www.youtube.com;
   ```
3. **Sanitize admin-configured HTML** if rich text is ever supported. Use a library like DOMPurify.
4. **Validate URLs in `image_url`, `url`, and `completion_redirect_url` fields** to ensure they use https:// protocol only. The `completion_redirect_url` (line 251) with `{respondent_id}` substitution is a particularly dangerous open redirect vector if not validated.

---

#### H3. Missing CSRF Protection Specification

**Location in plan:** Not mentioned anywhere in the plan.

**Issue:** The plan makes no mention of CSRF protection. Next.js API routes do not automatically include CSRF protection. The survey submission endpoints are particularly vulnerable because they use cookie-based session identification:

1. A malicious website could craft a form that auto-submits answers to a survey on behalf of a visiting respondent (using their existing session cookie)
2. Admin API endpoints (create study, modify questions, export data) could be triggered via CSRF if an admin visits a malicious page while authenticated

**Impact:** Unauthorized study modifications, data exfiltration via forged export requests, or survey response manipulation.

**Recommendations:**

1. **Implement CSRF tokens on all state-changing API endpoints.** For Next.js, use a library like `csrf` or implement the double-submit cookie pattern.
2. **Set `SameSite=Lax` (or `Strict` for admin cookies)** on all session cookies.
3. **Validate `Origin` and `Referer` headers** on all POST/PUT/DELETE API routes.
4. For the public survey API routes, since they use cookie-based respondent identification, CSRF protection is essential even though there is no "login."

---

#### H4. File Upload Security Gaps

**Location in plan:** Phase 1 (line 321) and Phase 2 (lines 348-349) describe presigned upload URLs.

**Issue:** The plan specifies presigned upload URLs to R2/S3 for video and image files but does not mention:

1. **File type validation:** No server-side validation that uploaded content matches the expected MIME type. An attacker (compromised admin or future API user) could upload malicious files disguised as videos.
2. **File size limits:** No maximum file size specified. A malicious upload of a multi-gigabyte file consumes storage quota and bandwidth.
3. **Malware scanning:** No scanning of uploaded content mentioned.
4. **Filename sanitization:** The `MediaItem` model stores `filename` -- unsanitized filenames can cause path traversal or XSS when rendered.

**Impact:** Storage abuse, serving malicious files to respondents via signed URLs, potential path traversal in filename handling.

**Recommendations:**

1. **Enforce file type validation at two layers:**
   - Client-side: restrict file picker to accepted MIME types (video/mp4, video/webm, image/jpeg, image/png, image/webp)
   - Server-side: after upload, validate the file magic bytes (not just extension/Content-Type header)
2. **Set maximum file sizes** on presigned URLs: e.g., 2GB for video, 10MB for images. Configure this in the presigned URL policy.
3. **Sanitize filenames** before storage: strip path separators, special characters, and limit length. Store files with UUID names and keep the original filename only for display.
4. **Run uploaded files through a virus scanning service** (e.g., ClamAV via a Lambda/Edge Function triggered on S3 put events).
5. **Restrict presigned upload URL generation** to authenticated admin users only, and log all upload events.

---

#### H5. Insufficient Admin Authentication and Authorization Model

**Location in plan:** Lines 44 ("Supabase Auth (or NextAuth)"), 317, 547-549

**Issue:** The plan mentions admin authentication but leaves significant gaps:

1. **No MFA/2FA mentioned.** Admin accounts have access to unreleased content from major brands -- single-factor auth is insufficient.
2. **No role-based access control (RBAC) in the data model.** The plan mentions "Study-level access control (who can view/edit)" in Phase 7 but the Prisma schema has no User, Role, or Permission models.
3. **Session management details absent.** No mention of session expiry, concurrent session limits, or session invalidation.
4. **"Supabase Auth (or NextAuth)"** -- this indecision suggests auth has not been thoroughly designed.
5. **No admin action audit trail** in the data model (mentioned as a Phase 7 item but not in the schema).

**Impact:** Unauthorized access to pre-release content, study manipulation, data exfiltration.

**Recommendations:**

1. **Require MFA for all admin accounts.** Supabase Auth supports TOTP-based MFA. Enforce it, do not make it optional.
2. **Define an RBAC model in the Prisma schema:**
   ```
   User { id, email, role: OWNER | ADMIN | VIEWER }
   StudyPermission { study_id, user_id, permission: EDIT | VIEW }
   AuditLog { id, user_id, action, resource_type, resource_id, timestamp, metadata }
   ```
3. **Implement Row-Level Security (RLS)** in Supabase as a defense-in-depth measure, even when using Prisma for queries.
4. **Set admin session TTL to 8 hours** with re-authentication required for sensitive operations (data export, study deletion).
5. **Move RBAC and audit logging to Phase 1**, not Phase 7. These are foundational security controls.

---

### MEDIUM SEVERITY

#### M1. Open Redirect via Completion Redirect URL

**Location in plan:** Line 251: "completion redirect URL with respondent ID parameter substitution (e.g., `?rid={respondent_id}`)"

**Issue:** The `completion_redirect_url` in study settings allows admins to configure an arbitrary URL that respondents are redirected to upon survey completion. If this URL is not validated, it becomes an open redirect vulnerability:

1. An attacker who compromises an admin account (or exploits a future API) sets the redirect URL to a phishing page
2. Thousands of respondents are redirected to the phishing page after completing the survey
3. Respondents trust the redirect because it came from a legitimate survey experience

**Recommendations:**

1. **Validate redirect URLs against an allowlist** of approved domains (panel provider domains).
2. At minimum, require `https://` protocol and block `javascript:`, `data:`, and relative URLs.
3. Display a warning interstitial before redirecting: "You are leaving Storyline Studio and being redirected to [domain]. Continue?"

---

#### M2. Supabase Real-Time Subscriptions -- Data Leakage Risk

**Location in plan:** Line 488: "Real-time response monitoring (Supabase real-time subscriptions)"

**Issue:** Supabase real-time subscriptions broadcast database changes to connected clients. If Row-Level Security policies are not correctly configured, respondent data or study content could leak to unauthorized subscribers. The plan does not specify RLS policies for real-time channels.

**Recommendations:**

1. **Define explicit RLS policies** for all tables before enabling real-time subscriptions.
2. **Restrict real-time subscriptions** to admin-only channels, authenticated via Supabase JWT.
3. **Never expose respondent answer data** via real-time channels -- aggregate on the server and push aggregates only.

---

#### M3. GDPR/Privacy Compliance Gaps

**Location in plan:** "Privacy & Consent" section (lines 285-289)

**Issue:** The plan shows awareness of privacy requirements but has gaps:

1. **IP hashing without salt rotation** -- if the same hashing algorithm and salt are used indefinitely, IP hashes become a persistent pseudonymous identifier that could be correlated across studies, defeating the purpose of hashing.
2. **No data deletion mechanism** -- GDPR requires the ability to delete data upon request. The plan mentions "data retention: configurable per study, default 12 months" but does not describe a deletion workflow.
3. **No Data Processing Agreement (DPA) mentioned** for Supabase, Cloudflare, and Vercel -- all of which will process respondent data.
4. **`user_agent` stored in metadata** -- user agent strings can be part of a browser fingerprint and constitute personal data under GDPR.
5. **Cookie consent** -- the respondent_id cookie is functional (not just analytics), but GDPR still requires disclosure. The plan mentions a "consent screen" but does not specify whether it includes cookie disclosure.
6. **YouTube embed tracking** -- embedding YouTube videos loads Google tracking scripts. This requires consent disclosure under GDPR/ePrivacy.

**Recommendations:**

1. **Use HMAC-SHA256 for IP hashing** with a per-study salt that is rotated and stored separately from the response data.
2. **Implement a data deletion endpoint** (`DELETE /api/responses/:respondent_id`) and automate retention-based deletion via a scheduled job.
3. **Ensure DPAs are in place** with Supabase, Cloudflare, and Vercel before processing EU respondent data.
4. **Disclose cookie and YouTube tracking** in the consent screen.
5. **Add a privacy-enhanced YouTube embed mode** using `youtube-nocookie.com` domain.

---

#### M4. Export Endpoint Security

**Location in plan:** Phase 6 (lines 501-528), export API routes (lines 524-527)

**Issue:** Export endpoints (`/api/export/csv/route.ts`, `/api/export/video/route.ts`, `/api/export/json/route.ts`) generate bulk data dumps. The plan does not specify:

1. Authentication requirements for export endpoints
2. Rate limiting on export endpoints
3. Authorization checks (can any admin export any study's data?)
4. Logging of export events

A single export request for a large study could return all respondent data, making export endpoints a high-value target for data exfiltration.

**Recommendations:**

1. **Require admin authentication** on all export endpoints.
2. **Verify study-level authorization** -- only users with VIEW or higher permission on the study can export its data.
3. **Rate limit exports** to prevent bulk exfiltration: maximum 10 exports per admin per hour.
4. **Log all export events** with admin identity, study ID, export type, and timestamp.
5. **Stream large exports** rather than loading all data into memory. For the JSON export, use NDJSON streaming.
6. **Do not include IP hashes** in standard CSV exports -- make it an explicit opt-in with an additional confirmation step.

---

#### M5. Skip Logic Injection / Manipulation

**Location in plan:** Lines 291-296 (Skip Logic Model), line 76 (`skip_logic jsonb`)

**Issue:** Skip logic is stored as JSONB and evaluated at runtime. If the skip logic evaluation engine does not properly validate the JSONB structure, an attacker who gains access to study editing (compromised admin account) could inject malicious skip logic that:

1. References non-existent questions (causing runtime errors/crashes)
2. Creates infinite loops (despite the "forward jumps only" rule -- the enforcement mechanism is not specified)
3. Evaluates arbitrary expressions if a generic expression evaluator is used

Additionally, respondents interact with skip logic through their answers. If skip logic evaluation uses user-provided answer values in unsafe string comparisons or (worse) `eval()`-style evaluation, this is a code injection vector.

**Recommendations:**

1. **Validate skip logic JSONB against a strict schema** on save:
   ```json
   { "condition": { "question_id": "uuid", "operator": "equals", "value": "string" }, 
     "action": "skip_to | terminate", "target_question_id": "uuid | null" }
   ```
2. **Verify referential integrity** of skip logic targets at save time -- ensure target question exists and is later in the order.
3. **Never use `eval()` or `new Function()`** for skip logic evaluation. Use a simple switch/case comparison engine.
4. **Sanitize the answer values** used in skip logic comparisons -- strict equality on validated enum values only, not arbitrary string matching.

---

#### M6. YouTube Embed Security Considerations

**Location in plan:** Phase 4 (lines 414-451)

**Issue:** YouTube embeds introduce third-party code execution in the respondent's browser:

1. YouTube IFrame API loads scripts from `youtube.com` -- these scripts have full access to the embedding page unless sandboxed.
2. YouTube tracks viewers via cookies and device fingerprints, creating a privacy concern for anonymous respondents.
3. Unlisted YouTube videos (recommended for unreleased content per line 421) can still be discovered via URL sharing -- YouTube unlisted != private.

**Recommendations:**

1. **Use `youtube-nocookie.com`** for embeds to reduce tracking.
2. **Sandbox YouTube iframes** with appropriate `sandbox` attribute permissions: `sandbox="allow-scripts allow-same-origin allow-presentation"`.
3. **Document to admins** that unlisted YouTube videos are not truly private. For unreleased content, direct upload to R2 is the only secure option.
4. **Update CSP headers** to explicitly whitelist YouTube domains and block all others.

---

### LOW SEVERITY

#### L1. Session Cookie Security Configuration

**Location in plan:** Lines 248-249 (respondent_id in cookie + localStorage)

**Issue:** The plan does not specify cookie security attributes.

**Recommendations:**

- Set `HttpOnly` flag on the respondent session cookie (prevents JavaScript access / XSS exfiltration)
- Set `Secure` flag (HTTPS only)
- Set `SameSite=Lax` (CSRF mitigation)
- Set `Path=/survey/` to limit cookie scope to survey routes only
- The localStorage backup of respondent_id is acceptable as a fallback but should not be the primary identifier (localStorage is accessible to XSS)

---

#### L2. Error Message Information Leakage

**Location in plan:** Phase 7 (line 533) mentions error boundaries.

**Issue:** Error handling is deferred to Phase 7. During earlier phases, unhandled errors in API routes will likely return stack traces, database error messages, or internal IDs to the client.

**Recommendations:**

1. **Implement a global error handler in Phase 1** that catches all API route errors and returns generic messages (e.g., `{ error: "Internal server error" }`) with a request ID for debugging.
2. Never return Prisma/PostgreSQL error details to the client.
3. Log full error details server-side with structured logging.

---

#### L3. Dependency Supply Chain Risk

**Location in plan:** Tech stack (lines 33-46)

**Issue:** The plan lists 10+ npm dependencies but does not mention:
- Dependency auditing (`npm audit`)
- Lock file pinning
- Dependabot or Renovate for automated updates
- Subresource Integrity (SRI) for CDN-loaded scripts

**Recommendations:**

1. Run `npm audit` in CI/CD pipeline and fail on high-severity vulnerabilities.
2. Use `package-lock.json` and commit it to version control.
3. Enable Dependabot or Renovate for automated dependency updates.
4. Pin Supabase client versions and audit Supabase SDK releases.

---

#### L4. Vercel Serverless Function Timeout and FFmpeg Risk

**Location in plan:** Line 594 (FFmpeg risk), line 519 (video overlay export)

**Issue:** Running FFmpeg in a serverless function for video export is both a performance risk and a security risk. If user-controlled parameters (video file path, overlay configuration) are passed to FFmpeg without sanitization, command injection is possible.

**Recommendations:**

1. **Never construct FFmpeg commands via string concatenation with user input.** Use a library like `fluent-ffmpeg` with explicit parameter binding.
2. Run FFmpeg in an isolated environment (container, not serverless function) with resource limits (CPU time, memory, output file size).
3. Validate that the input video file is a genuine video before processing (check magic bytes, not just extension).

---

## Security Requirements Checklist

| Requirement | Status in Plan | Severity |
|---|---|---|
| All inputs validated and sanitized | NOT ADDRESSED (deferred to Phase 7, line 540) | CRITICAL |
| No hardcoded secrets or credentials | Not yet applicable (no code) -- ensure `.env` in `.gitignore` | LOW |
| Proper authentication on all endpoints | PARTIAL -- admin auth mentioned, no endpoint-level mapping | HIGH |
| SQL queries use parameterization | LIKELY OK -- Prisma ORM handles this | LOW |
| XSS protection implemented | NOT ADDRESSED | HIGH |
| HTTPS enforced | LIKELY OK -- Vercel defaults to HTTPS | LOW |
| CSRF protection enabled | NOT ADDRESSED | HIGH |
| Security headers configured | NOT ADDRESSED | MEDIUM |
| Error messages don't leak sensitive info | NOT ADDRESSED (deferred to Phase 7) | MEDIUM |
| Dependencies up-to-date and vulnerability-free | NOT ADDRESSED | LOW |

---

## Remediation Roadmap

### Immediate -- Must be in Phase 1 (Foundation)

1. **Implement input validation framework** (Zod schemas for all API request bodies)
2. **Configure security headers** (CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy)
3. **Set up CSRF protection** on all API routes
4. **Configure cookie security attributes** (HttpOnly, Secure, SameSite)
5. **Implement global error handler** with generic client-facing error messages
6. **Require MFA** for admin authentication
7. **Add RBAC model** to Prisma schema
8. **Add audit logging model** to Prisma schema
9. **Configure CORS** on R2 bucket to restrict to application domain
10. **Reduce signed URL TTL** from 4 hours to 15-30 minutes

### Must be in Phase 3 (Survey Runner) -- Before Any Public Traffic

11. **Implement rate limiting** on all public endpoints (survey access, response creation, answer submission)
12. **Add bot detection** (reCAPTCHA v3 or equivalent)
13. **Implement response velocity checks** (flag suspiciously fast completions)
14. **Add browser fingerprinting** as secondary deduplication signal
15. **Validate completion redirect URL** against domain allowlist
16. **Implement Zod validation schemas** for all 17 answer types

### Must be in Phase 4 (Video Dial) -- Before Serving Video Content

17. **Implement media proxy endpoint** that validates session before issuing signed URLs
18. **Use `youtube-nocookie.com`** for YouTube embeds
19. **Sandbox YouTube iframes** appropriately
20. **Document upload-vs-YouTube security tradeoffs** for admins

### Must be in Phase 6 (Export) -- Before Enabling Data Export

21. **Authenticate and authorize all export endpoints**
22. **Rate limit exports** (max 10 per admin per hour)
23. **Log all export events** with admin identity and study context
24. **Exclude IP hashes from standard exports** (opt-in only)

### Before Production Launch

25. **File upload validation** (magic bytes, size limits, filename sanitization)
26. **DPAs in place** with Supabase, Cloudflare, Vercel
27. **GDPR data deletion workflow** implemented
28. **Dependency audit** in CI/CD pipeline
29. **Penetration test** of public survey endpoints and admin panel
30. **Security review of Supabase RLS policies** before enabling real-time subscriptions

---

## Summary of Most Impactful Recommendations

The three changes that would most significantly improve the security posture of this platform are:

1. **Move security controls from Phase 7 to Phase 1.** Input validation, rate limiting, CSRF, and error handling are categorized as "polish" in the plan. They are not polish. They are foundational security controls that must be in place before any code handles user input or serves content.

2. **Redesign the video content delivery pipeline.** The current approach (4-hour signed URLs, no watermarking, CSS-based download prevention) is inadequate for protecting pre-release content from major brands. Implement a session-validated media proxy, short-lived signed URLs, CORS restrictions, and at minimum an invisible watermark overlay.

3. **Implement server-side validation for all JSONB payloads.** The flexible JSONB answer model is architecturally convenient but creates a massive attack surface if not validated. Every answer type needs a strict Zod schema enforced on the API boundary.