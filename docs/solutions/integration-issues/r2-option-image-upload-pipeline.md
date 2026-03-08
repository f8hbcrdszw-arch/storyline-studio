---
title: R2 Option Image Upload Pipeline
category: integration-issues
tags: [cloudflare-r2, csp, presigned-url, zod, next-js]
module: media-upload
symptoms:
  - "Failed to fetch on image upload"
  - "404 on option images in preview"
  - "Save fails with 400 after uploading images"
  - "blob: thumbnail blocked by CSP"
date: 2026-03-07
---

# R2 Option Image Upload Pipeline

## Problem

Getting Cloudflare R2 image uploads working for per-option images (AB test question type) required solving six cascading issues. Each fix revealed the next failure, spanning presigned URL generation, CSP policy, data architecture, Zod validation, blob preview rendering, and admin preview URL signing.

## Problems Solved (in order of discovery)

### 1. ContentLength mismatch in presigned URL

`PutObjectCommand` had `ContentLength: MAX_FILE_SIZES[mediaType]` which told R2 to expect exactly 10MB for every image upload. R2 rejects uploads where the actual file size does not match the declared ContentLength.

**Fix**: Remove `ContentLength` from `PutObjectCommand` — let R2 accept any size up to the bucket's limit.

### 2. CSP blocking uploads to R2

The browser's `connect-src` CSP directive did not include R2's domain. This manifested as "Failed to fetch" — it looked like a CORS error but was actually CSP.

**Fix**: Add `https://*.r2.cloudflarestorage.com` to `connect-src`, `img-src`, and `media-src` in `next.config.ts`.

**Key learning**: CSP errors look identical to CORS/network errors in catch blocks. Check the browser console for the actual CSP violation message — it will explicitly say which directive blocked the request.

### 3. Architecture mismatch: question-level vs option-level media

`MediaUploader` creates question-level `mediaItems` (linked to the question). `ABTestQuestion` renders per-option `opt.imageUrl` (linked to each option). These are completely separate data paths — uploading via `MediaUploader` never populates the option's `imageUrl` field.

**Fix**: Created a per-option `OptionImageUpload` component that uploads directly to R2 and stores the resulting key on the option's `imageUrl` field.

### 4. Zod `.url()` rejecting R2 keys

`questionOptionSchema` had `imageUrl: z.string().url()` which requires full URL format (e.g., `https://...`). R2 keys are stored as path-style strings like `images/uuid.jpeg`, not as URLs. Zod parse throws on these values, `withErrorHandler` returns 400, and the save fails silently on the client.

**Fix**: Remove `.url()` validator, keep `.string().max(2000).optional().nullable()`.

### 5. CSP blocking blob: thumbnail previews

`URL.createObjectURL()` creates `blob:` URLs for local image previews before upload completes. The `img-src` CSP directive did not include `blob:`, so the browser blocked the thumbnail from rendering.

**Fix**: Add `blob:` to `img-src` in `next.config.ts`.

### 6. Admin preview showing raw R2 keys as relative URLs

`QuestionPreviewModal` passes option data directly to survey components. The option `imageUrl` is an R2 key like `images/uuid.jpeg`. The browser resolves this as a relative URL against the current page, resulting in a 404. The survey API signs keys to full URLs for respondents, but the admin preview modal does not use that API path.

**Fix**: Created `/api/signed-url` endpoint (admin-only, accepts an array of keys, returns signed URLs). `QuestionPreviewModal` calls it when opened to sign option image URLs before rendering the survey component.

## Key Files

| File | Role |
|------|------|
| `src/lib/storage.ts` | R2 presigned URL generation |
| `next.config.ts` | CSP headers (`connect-src`, `img-src`, `media-src`) |
| `src/lib/schemas/question.ts` | Zod validation for question options |
| `src/app/api/signed-url/route.ts` | Admin-only URL signing endpoint |
| `src/app/(admin)/.../QuestionPreviewModal.tsx` | Signs option images before preview render |
| `src/app/(admin)/.../QuestionEditor.tsx` | `OptionImageUpload` component |
| `src/app/api/surveys/[slug]/route.ts` | Signs option images for survey respondents |

## Prevention

- **R2 key storage**: When adding image/file fields to schemas, use `.string()` not `.string().url()` if storing R2 keys. R2 keys are paths, not URLs.
- **CSP for new domains**: When adding new external domains for fetch or image loading, update CSP in `next.config.ts` — add to `connect-src`, `img-src`, and `media-src` as needed.
- **Blob previews**: When using `URL.createObjectURL()` for local previews, ensure `blob:` is in the `img-src` CSP directive.
- **Admin preview signing**: Admin preview components that render survey question components need to sign any R2 keys before passing data through. The signing that happens in the survey API does not apply to admin-side previews — these are separate code paths.
- **CSP debugging**: CSP violations in catch blocks look like generic network errors ("Failed to fetch"). Always check the browser console first for the actual CSP violation message before investigating CORS or network issues.
