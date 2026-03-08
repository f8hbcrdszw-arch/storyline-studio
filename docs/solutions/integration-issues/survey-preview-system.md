---
title: "Survey preview system for question-level and full-survey testing"
category: integration-issues
tags: [preview, survey, next.js, modal, testing, ux]
module: survey-preview
symptoms:
  - "No way to see respondent view before activating study"
  - "Cannot test survey flow without creating real responses"
  - "Draft studies show 'Survey Unavailable' when trying to preview"
  - "API blocks non-ACTIVE studies even for preview"
date_solved: 2026-03-07
severity: medium
---

# Survey Preview System for Question-Level and Full-Survey Testing

## Problem

Survey designers had no way to see what respondents would see before going live. Building and configuring questions was a blind process — you had to activate the study and take it yourself to verify the experience. Additionally, previewing DRAFT studies was impossible since the survey page and API both blocked non-ACTIVE studies.

## Root Cause

No preview infrastructure existed. The survey rendering pipeline (`/api/surveys/[slug]` -> `SurveyShell` -> `QuestionRenderer`) was tightly coupled to the live response flow — it always created real responses and submitted real answers.

## Solution

### 1. Per-Question Preview Modal (`QuestionPreviewModal.tsx` — new)

- Follows existing `ConfirmDialog` pattern (custom backdrop + CSS animations, no extra deps)
- Transforms admin `QuestionData` -> survey `SurveyQuestion` (drops admin-only fields like `url`, `filename` from mediaItems)
- Reuses the actual `QuestionRenderer` component from the survey side — renders exactly what respondents see
- Eye icon button added to every question card in `SortableQuestion.tsx` (visible even when study is locked)
- onSubmit callback just closes the modal

### 2. Full Survey Preview Mode (`?preview=true` query param)

Three layers needed fixing to allow preview of non-ACTIVE studies:

**a. Survey page (`page.tsx`):**
- Reads `searchParams` for `preview=true`
- Bypasses `study.status !== "ACTIVE"` check when preview
- Falls back `slug={study.slug || study.id}` for draft studies without slugs

**b. Survey API (`/api/surveys/[slug]/route.ts`):**
- Accepts `?preview=true` param to bypass ACTIVE status check
- Added UUID detection to also look up studies by ID (not just slug) — needed because preview URLs use study ID

**c. SurveyShell (`SurveyShell.tsx`):**
- Accepts `preview?: boolean` prop
- `startSurvey()`: skips POST /api/responses, sets fake responseId, goes directly to survey screen
- `submitAnswer()`: skips POST /api/answers, stores in local state only, advances linearly
- Yellow "Preview Mode — responses are not recorded" banner throughout
- Consent screen shows "Begin Preview" button
- Completion shows "Preview Complete" with "Restart Preview" button to reset all state
- `loadStudy()` passes `?preview=true` to the API fetch

### 3. Preview buttons on admin pages

- `StudyEditor.tsx` header: "Preview Survey" link (opens new tab)
- `admin/studies/[id]/page.tsx` header: "Preview" button with eye icon next to Edit/Results

## Key Files

| File | Role |
|------|------|
| `.../edit/components/QuestionPreviewModal.tsx` | Per-question preview modal (new) |
| `.../edit/components/SortableQuestion.tsx` | Added eye icon preview button |
| `.../edit/components/StudyEditor.tsx` | Added "Preview Survey" header link |
| `src/app/(survey)/survey/[id]/page.tsx` | Reads ?preview=true, bypasses status check |
| `.../survey/[id]/components/SurveyShell.tsx` | Preview mode logic (skip API, banner, restart) |
| `src/app/api/surveys/[slug]/route.ts` | API preview bypass + ID lookup |
| `src/app/(admin)/admin/studies/[id]/page.tsx` | Added Preview button |

## Prevention

- New survey features should always consider preview mode — check the `preview` prop before making API calls
- Any new status checks on the survey pipeline need `isPreview` bypass
- The `QuestionPreviewModal` automatically works for new question types since it reuses `QuestionRenderer`

## Gotchas

- Skip logic is NOT evaluated in preview mode — preview advances linearly through all questions. This is intentional (keeps it simple; per-question preview covers individual testing).
- VIDEO_DIAL preview works because the admin is authenticated and the media proxy endpoint (`/api/media/[questionId]`) returns signed URLs regardless of study status.
- Draft studies may not have a slug — the slug fallback to study ID is critical for preview to work.
- The `?preview=true` param on the API is not auth-gated — anyone with the study ID could preview. This is acceptable since the survey data (questions/options) is public anyway when the study is active.
