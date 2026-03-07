# Feature: Video Dial Playback with Overlay on Results Page

**Date:** 2026-03-07
**Status:** Planned — ready to implement

## Problem
The results page currently shows a static SVG chart of dial data separate from the video. Users have to manually find the video to understand what was playing at each moment. Industry tools (Dialsmith, Perception Analyzer) let you replay the video with the dial line animating as an overlay so you can see audience reaction in context — and export that composite video for reports.

## Goal
Build a `DialPlayback` component on the admin results page that:
1. Plays the video (YouTube or uploaded HTML5) with a semi-transparent dial line overlay
2. The dial line draws progressively as the video plays, synced to current time
3. Lightbulb markers flash as the video reaches their timestamp
4. Play/pause/scrub controls for admin review
5. "Download Overlay Video" button that records the composite to WebM (HTML5 uploads only — YouTube is cross-origin)

## Architecture

```
┌──────────────────────────────────────┐
│  Video Player (aspect-video)         │
│  ┌────────────────────────────────┐  │
│  │ YouTube iframe / <video>       │  │
│  │                                │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ <canvas> overlay (abs)   │  │  │
│  │  │ pointer-events: none     │  │  │
│  │  │ - dial line up to now    │  │  │
│  │  │ - lightbulb markers      │  │  │
│  │  │ - 50-line reference      │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
│                                      │
│  [▶ Play] ────────●──────── 1:23/2:18│
│                                      │
│  [Download Overlay Video]            │
└──────────────────────────────────────┘

Below this: existing static SVG chart + annotations (unchanged)
```

## Files to Create/Modify

### NEW: `app/src/app/api/admin-media/[questionId]/route.ts`
Admin-authenticated media URL endpoint. The existing `/api/media/[questionId]` requires respondent cookies — admins need their own endpoint.

```typescript
// GET /api/admin-media/[questionId]
// - requireAdmin() for auth
// - Verify ownership: mediaItem → question → study → createdBy === auth.userId
// - UPLOAD source: return { signedUrl } via createSignedReadUrl()
// - YOUTUBE source: return { youtubeId }
```

**Reuse:**
- `requireAdmin()` from `@/lib/middleware/require-admin`
- `createSignedReadUrl()` from `@/lib/storage`
- `withErrorHandler()` from `@/lib/api/error-handler`

### NEW: `app/src/app/(admin)/admin/studies/[id]/results/components/DialPlayback.tsx`
Main new component. ~250-350 lines.

**Props:**
```typescript
interface DialPlaybackProps {
  questionId: string;
  mediaItem: { source: string; youtubeId: string | null; url: string | null };
  dialData: DialAggregation[];
  lightbulbs: Record<number, number>;
}
```

**Video layer:**
- YouTube: use `loadYouTubeApi()` from `YouTubeVideoPlayer.tsx` (module-level singleton, importable). Create YT.Player with `controls: 0` (custom controls). Poll `getCurrentTime()` via `requestAnimationFrame`.
- HTML5 `<video>`: fetch signed URL from `/api/admin-media/[questionId]`. Use `timeupdate` event or `requestAnimationFrame` loop for time sync.

**Canvas overlay layer:**
- `<canvas>` positioned `absolute inset-0` over the video container
- `pointer-events: none` so clicks pass through
- On each `requestAnimationFrame`:
  1. Clear canvas
  2. Draw semi-transparent dark strip across bottom ~30% of canvas
  3. Draw 50-line dashed reference
  4. For each dial data point where `second <= currentTime`: draw color-coded line segment using `dialColor()` / `lerpColor()`
  5. Draw lightbulb markers at timestamps that have been passed
  6. Draw current value indicator dot at the line head
- Resize canvas to match video container dimensions (use `ResizeObserver`)

**Color functions (copy from QuestionResults.tsx DialResultView):**
```typescript
function dialColor(val: number): string {
  // red(0) → orange(25) → yellow(50) → lime(75) → green(100)
  // Uses lerpColor() between RGB stops
}

function lerpColor(a: number[], b: number[], t: number): string {
  // Linear interpolation between two RGB colors
}
```

**Custom playback controls:**
- Play/pause toggle button
- Seek bar: `<input type="range">` synced to `currentTime / duration`
- Time display: `formatTime(currentTime) / formatTime(duration)`
- For YouTube: `player.playVideo()`, `player.pauseVideo()`, `player.seekTo(sec, true)`
- For HTML5: `video.play()`, `video.pause()`, `video.currentTime = sec`

**Video export (HTML5 only):**
- On "Download" click:
  1. Create hidden `<canvas>` at video resolution
  2. Seek video to 0, start playback
  3. On each frame: `ctx.drawImage(videoElement, 0, 0)` then `ctx.drawImage(overlayCanvas, 0, 0)`
  4. `canvas.captureStream(30)` → `MediaRecorder` (codec: `video/webm; codecs=vp9`)
  5. Collect chunks, on video `ended`: stop recorder, assemble Blob, trigger download
  6. Show progress bar during recording
- YouTube: disable button, show tooltip "Export not available for YouTube videos"

### MODIFY: `app/src/app/(admin)/admin/studies/[id]/results/page.tsx`
Add `url: true` to the `mediaItems` select in the Prisma query (line 39):
```typescript
mediaItems: {
  select: { id: true, source: true, youtubeId: true, url: true },
},
```

### MODIFY: `app/src/app/(admin)/admin/studies/[id]/results/components/ResultsDashboard.tsx`
Update `QuestionInfo` interface to include `url`:
```typescript
mediaItems: { id: string; source: string; youtubeId: string | null; url: string | null }[];
```

### MODIFY: `app/src/app/(admin)/admin/studies/[id]/results/components/QuestionResults.tsx`
1. Update `QuestionInfo.mediaItems` type to include `url`
2. In the VIDEO_DIAL rendering section, add `DialPlayback` above the existing `DialResultView`:
```typescript
{question.type === "VIDEO_DIAL" && dialData && (
  <>
    {question.mediaItems[0] && (
      <DialPlayback
        questionId={question.id}
        mediaItem={question.mediaItems[0]}
        dialData={dialData.dialData}
        lightbulbs={dialData.lightbulbs}
      />
    )}
    <DialResultView data={dialData} />
  </>
)}
```

### POSSIBLY MODIFY: `app/next.config.ts`
May need to add R2 bucket domain to CSP `media-src` for admin video playback if signed URLs point to a different domain than what's already allowed.

## YouTube Limitations
- YouTube iframe is cross-origin — `canvas.drawImage(iframe)` throws a security error
- Therefore: video export/download is **HTML5 uploads only**
- The canvas overlay sitting ON TOP of the iframe works perfectly for both sources
- Playback time sync works for both via `getCurrentTime()` polling

## Reusable Code Map

| What | Where | How to Reuse |
|------|-------|-------------|
| `loadYouTubeApi()` | `YouTubeVideoPlayer.tsx` lines 26-44 | Import directly (module singleton) |
| `dialColor()` / `lerpColor()` | `QuestionResults.tsx` lines 517-538 | Copy to DialPlayback (or extract to shared util) |
| `formatTime()` | `QuestionResults.tsx` lines 581-585 | Copy (trivial helper) |
| `createSignedReadUrl()` | `/lib/storage.ts` line 68 | Import in admin-media route |
| `requireAdmin()` | `/lib/middleware/require-admin.ts` | Import in admin-media route |
| `withErrorHandler()` | `/lib/api/error-handler.ts` | Import in admin-media route |
| YT.Player setup pattern | `YouTubeVideoPlayer.tsx` lines 76-126 | Adapt (simpler version, with controls) |

## Implementation Order
1. Admin media endpoint (simple, unblocks HTML5 video loading)
2. Update results page query + interfaces (url field)
3. DialPlayback component (core feature — video + canvas overlay + controls)
4. Video export button (enhancement — MediaRecorder + canvas composite)
5. Wire into QuestionResults (final integration)
6. Test with both YouTube and uploaded video

## Verification Checklist
- [ ] YouTube VIDEO_DIAL: video plays with dial overlay animating in sync
- [ ] HTML5 VIDEO_DIAL: video plays with dial overlay animating in sync
- [ ] Lightbulb markers appear at correct timestamps during playback
- [ ] Play/pause button works
- [ ] Scrub bar seeks video and overlay redraws correctly
- [ ] HTML5: "Download" produces a WebM with overlay baked into the video
- [ ] YouTube: download button is disabled with explanation tooltip
- [ ] Static SVG chart still renders below the video player
- [ ] Annotations still display at the bottom
- [ ] Canvas resizes correctly on window resize
- [ ] TypeScript check passes
- [ ] Build passes
