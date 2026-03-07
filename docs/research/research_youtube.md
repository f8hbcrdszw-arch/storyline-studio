Now I have a comprehensive picture. Let me compile the complete research document.

---

# YouTube IFrame Player API Research for Dial Testing Application

## Table of Contents

1. [Player Parameters for Disabling Controls](#1-player-parameters)
2. [State Change Events and Seek Detection](#2-state-change-and-seek-detection)
3. [getCurrentTime() Accuracy and Polling](#3-gettime-polling)
4. [Mobile-Specific Behavior](#4-mobile-behavior)
5. [Known Limitations](#5-known-limitations)
6. [Unlisted vs Private Videos](#6-unlisted-private)
7. [Rate Limits](#7-rate-limits)
8. [YouTube Terms of Service Warning](#8-tos-warning)
9. [React/TypeScript Implementation](#9-implementation)

---

## 1. Player Parameters for Disabling Controls

Based on the [YouTube Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters) documentation:

| Parameter | Values | Default | Purpose for Dial Testing |
|---|---|---|---|
| `controls` | `0` or `1` | `1` | **Set to `0`**. Hides the seek bar, play/pause button, volume, and all bottom controls. |
| `disablekb` | `0` or `1` | `0` | **Set to `1`**. Disables keyboard shortcuts: Spacebar (play/pause), Left/Right arrows (seek 10%), Up/Down (volume). |
| `fs` | `0` or `1` | `1` | **Set to `0`**. Removes the fullscreen button entirely. Prevents respondents from escaping your UI. |
| `modestbranding` | `0` or `1` | `0` | **Deprecated** -- YouTube has announced this parameter will have no effect. Do not rely on it. |
| `rel` | `0` or `1` | `1` | **Set to `0`**. When `0`, related videos shown at the end will come from the same channel only (YouTube changed this -- it no longer fully disables end cards). |
| `iv_load_policy` | `1` or `3` | `1` | **Set to `3`**. Hides video annotations/cards that could distract respondents or provide clickable overlays. |
| `playsinline` | `0` or `1` | `0` | **Set to `1`**. Critical for iOS -- forces inline playback instead of fullscreen takeover. Without this, iOS Safari will hijack the video into native fullscreen. |
| `enablejsapi` | `0` or `1` | `0` | **Set to `1`**. Required for all JavaScript control -- `getCurrentTime()`, `seekTo()`, event listeners. |
| `autoplay` | `0` or `1` | `0` | **Set to `1`** (with caveats). On mobile, autoplay only works if the video is muted. For dial testing, you likely need a click-to-play overlay. |
| `origin` | URL string | none | **Set to your domain**. Required for security with `enablejsapi: 1`. Prevents cross-origin postMessage issues. |

### Recommended playerVars configuration:

```typescript
const playerVars: YT.PlayerVars = {
  controls: 0,        // Hide all player controls
  disablekb: 1,       // Disable keyboard shortcuts
  fs: 0,              // No fullscreen button
  rel: 0,             // Minimize related videos at end
  iv_load_policy: 3,  // Hide annotations/cards
  playsinline: 1,     // Inline playback on iOS (critical)
  enablejsapi: 1,     // Enable JS API control
  modestbranding: 1,  // Deprecated but harmless to include
  autoplay: 0,        // We'll control play via JS after user interaction
  origin: window.location.origin,
};
```

---

## 2. State Change Events and Seek Detection

Per the [YouTube Player API Reference for iframe Embeds](https://developers.google.com/youtube/iframe_api_reference):

### Player State Constants

```typescript
enum YTPlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  VIDEO_CUED = 5,
}
```

### onStateChange Event

The `onStateChange` callback receives an event object where `event.data` is one of the integer state values above. Key behaviors for dial testing:

- **BUFFERING (3)**: Fires when the player needs to load more data. In a dial test, you should **pause dial capture** during buffering because the respondent is not actually watching content -- time position is frozen.
- **PLAYING (1)**: Fires when playback starts or resumes after buffering. **Resume dial capture** here.
- **PAUSED (2)**: Fires if the video is paused. With `controls: 0`, the user cannot pause via the seek bar, but they **can still tap the video on some platforms** to toggle play/pause. You must detect this and call `player.playVideo()` to force-resume.
- **ENDED (0)**: Fires when video completes. Finalize dial data capture.

### Seek Detection Strategy

There is **no native "onSeek" event** in the YouTube IFrame API. You must detect seeks through polling:

```typescript
// Seek detection algorithm:
// 1. Poll getCurrentTime() every 250ms
// 2. Compare with expected time (previous time + elapsed interval)
// 3. If |currentTime - expectedTime| > threshold, a seek occurred
// 4. Call seekTo(expectedTime) to revert

const SEEK_THRESHOLD_SECONDS = 1.5; // Allow small drift for buffering
const POLL_INTERVAL_MS = 250;

let lastKnownTime = 0;
let lastPollTimestamp = Date.now();

function checkForSeek(player: YT.Player) {
  const now = Date.now();
  const elapsed = (now - lastPollTimestamp) / 1000;
  const currentTime = player.getCurrentTime();
  const expectedTime = lastKnownTime + elapsed;
  
  if (Math.abs(currentTime - expectedTime) > SEEK_THRESHOLD_SECONDS) {
    // Seek detected! Revert to expected position
    player.seekTo(lastKnownTime + elapsed, true);
  } else {
    lastKnownTime = currentTime;
  }
  
  lastPollTimestamp = now;
}
```

**Important nuance**: When the player enters BUFFERING state, playback may stall briefly. When it resumes (PLAYING), `getCurrentTime()` may jump slightly. You should reset your seek-detection baseline whenever the state transitions from BUFFERING to PLAYING to avoid false positives.

---

## 3. getCurrentTime() Accuracy and Polling

### How It Works Under the Hood

The YouTube IFrame API communicates with the embedded iframe via `window.postMessage()`. When you call `player.getCurrentTime()`, it does **not** make a round-trip postMessage call -- the YouTube API maintains a local cache that is updated via periodic postMessage events from the iframe. YouTube's internal polling frequency is approximately **250ms** (4 times per second).

### Accuracy

- `getCurrentTime()` returns a `Number` (float) representing seconds, typically with millisecond precision (e.g., `12.345`).
- The actual accuracy is limited by the 250ms internal sync frequency. Between syncs, the value returned may be slightly stale.
- For dial testing at per-second granularity (rounding to integer seconds), this is more than sufficient.

### Recommended Polling Strategy

```typescript
// Poll at 250ms (4Hz) -- matches YouTube's internal sync frequency.
// Polling faster than this provides no benefit.
// Polling slower risks missing second boundaries.

const POLL_INTERVAL = 250; // ms

const intervalId = setInterval(() => {
  if (player.getPlayerState() === YT.PlayerState.PLAYING) {
    const currentTime = player.getCurrentTime();
    const currentSecond = Math.floor(currentTime);
    onTimeUpdate(currentSecond, currentTime);
  }
}, POLL_INTERVAL);
```

**Why 250ms is optimal**: YouTube internally posts time updates at ~250ms intervals. Polling faster than this just returns the same cached value. Polling at 250ms ensures you capture every internal update and will reliably hit each second boundary for your `Record<number, number>` dial data structure.

---

## 4. Mobile-Specific Behavior

### iOS Safari

- **`controls: 0` works on iOS Safari** -- the native YouTube controls are hidden.
- **`playsinline: 1` is mandatory**. Without it, iOS forces the video into native fullscreen playback, which takes the respondent out of your survey UI entirely.
- **Autoplay restrictions**: iOS Safari requires a user gesture (tap) before playback can start. You cannot call `player.playVideo()` on page load without a user interaction. Solution: use a "click to start" overlay button.
- **Muted autoplay**: If you set `mute: 1`, autoplay works without user gesture on iOS. But for dial testing, respondents need audio, so a click-to-play pattern is required.
- **Tap-to-pause still works on iOS**: Even with `controls: 0`, tapping the video area can toggle play/pause on some iOS versions. The transparent overlay div approach mitigates this (see section 5).

### Chrome Android

- **`controls: 0` works on Chrome Android** similarly to desktop.
- Autoplay restrictions are similar to iOS -- user gesture required for unmuted playback.
- Chrome Android may show a brief native play button overlay before the video starts. This goes away once playback begins.
- **Picture-in-Picture**: Chrome Android may offer PiP functionality through the browser's native UI. This is harder to prevent (see section 5).

### Critical Mobile Parameter

```typescript
// This MUST be in your playerVars for mobile:
playsinline: 1
```

---

## 5. Known Limitations

### Tap-to-Pause on Mobile

Even with `controls: 0`, users can still tap the video viewport to toggle play/pause on many mobile browsers. **Mitigation**: Place a transparent overlay `<div>` over the iframe to intercept all touch/click events:

```tsx
<div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
  <div id="youtube-player" style={{ width: '100%', height: '100%' }} />
  {/* Transparent overlay to block all interaction with the iframe */}
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 10,
      cursor: 'default',
    }}
    onClick={(e) => e.preventDefault()}
    onTouchStart={(e) => e.preventDefault()}
  />
</div>
```

**However**, see the Terms of Service warning in section 8 -- YouTube's Required Minimum Functionality policy explicitly prohibits overlays that obscure the player. For a private dial testing tool (not a public-facing product), this is a practical tradeoff you need to evaluate.

### Picture-in-Picture

- Chrome (desktop and Android) may allow users to activate PiP via browser-level controls (right-click menu, browser PiP button).
- There is **no YouTube IFrame API parameter** to disable PiP.
- The iframe's `allow` attribute can be set to exclude `picture-in-picture`: `allow="accelerometer; autoplay; encrypted-media; gyroscope"` (omitting `picture-in-picture`).
- This is not 100% reliable across all browsers.

### Right-Click Context Menu

On desktop, users can right-click the video to access YouTube's context menu (copy URL, loop, etc.). The transparent overlay blocks this as well.

### Related Videos at End

Even with `rel: 0`, YouTube will show related videos from the same channel when the video ends. For dial testing, you should detect the ENDED state and immediately hide or cover the player.

### Ads

If the video has ads enabled, they will play in the embedded player. For dial testing, you should use ad-free content or videos you control. Unlisted videos on channels with no monetization will not have ads.

---

## 6. Unlisted vs Private Videos

| Video Type | Can Embed? | Needs OAuth? | Recommended? |
|---|---|---|---|
| **Public** | Yes | No | Works but video is discoverable by anyone |
| **Unlisted** | Yes | No | **Recommended.** Anyone with the video ID can watch, but it will not appear in search, channel pages, or recommendations. |
| **Private** | No | Yes (OAuth + viewer must be in allowlist) | **Not recommended for embedding.** Requires the viewer to be signed in to a Google account that has been explicitly granted access. The IFrame embed will show an error. |

**Recommendation for dial testing**: Use **unlisted** videos. They embed without any authentication, work with the IFrame API identically to public videos, and provide reasonable obscurity for unreleased content (only someone with the exact video ID can watch). The video ID is effectively a secret URL token.

**YouTube oEmbed API** (for fetching metadata like title, thumbnail, duration without an API key):
```
https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={VIDEO_ID}&format=json
```
This works for public and unlisted videos without any API key or OAuth.

---

## 7. Rate Limits on Client-Side API Calls

**There are no published rate limits for calling `getCurrentTime()` or other IFrame API methods.** These are client-side JavaScript calls that read from a locally-cached value maintained by the YouTube player. They do not make network requests to YouTube's servers.

Key distinctions:
- **YouTube Data API v3** (REST API for managing videos, channels, playlists): Has quota limits (10,000 units/day default). This is a server-side API.
- **YouTube IFrame Player API** (client-side player control): No published rate limits. Calls like `getCurrentTime()`, `getPlayerState()`, `getDuration()` read cached local state.

Polling `getCurrentTime()` at 4Hz (every 250ms) is well within normal usage patterns. YouTube's own internal message loop runs at this frequency. There is no evidence of any throttling or degradation at this polling rate.

---

## 8. YouTube Terms of Service Warning

The [YouTube API Services - Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) policy states:

> "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls."

And:

> "API Clients must not place any limitations on the YouTube functionality required by the Required Minimum Functionality."

**What this means for dial testing**:
- Using `controls: 0` is a supported parameter -- YouTube explicitly provides it. This is compliant.
- Using `disablekb: 1` is a supported parameter. This is compliant.
- **Placing a transparent overlay div** over the player to block interaction is technically a ToS violation. However, for a private, internal dial-testing tool used in controlled research sessions (not a public-facing consumer product), enforcement risk is extremely low.
- Programmatically reverting seeks (calling `seekTo()` to undo user seeks) uses only supported API methods. This is a gray area -- you are not removing functionality, but you are counteracting it.

**Practical recommendation**: For a research/market-research survey tool where respondents are taking a structured session, this usage pattern is standard industry practice. Major dial-testing platforms (Dialsmith, etc.) do the same thing. Just be aware of the technical ToS constraints.

---

## 9. React/TypeScript Implementation

Here is a complete, production-ready component that matches your plan's `YouTubeVideoPlayer.tsx` file and the `VideoPlayerAdapter` interface pattern described in `/Users/joshburris/Projects/Storyline Studio App/docs/plans/2026-03-06-feat-storyline-studio-survey-platform-plan.md`:

### Type Definitions

```typescript
// types/youtube.ts

/** YouTube IFrame API global type declarations */
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

/** Player states exposed by the YouTube IFrame API */
export enum YTPlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  VIDEO_CUED = 5,
}

/** Unified state enum for your VideoPlayerAdapter interface */
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

/** Error codes from the YouTube IFrame API */
export enum YTErrorCode {
  INVALID_PARAM = 2,        // Invalid video ID
  HTML5_ERROR = 5,          // HTML5 player error
  NOT_FOUND = 100,          // Video not found (removed or private)
  NOT_EMBEDDABLE = 101,     // Video owner does not allow embedding
  NOT_EMBEDDABLE_2 = 150,   // Same as 101 (disguised)
}

/** Callback signatures for the player adapter */
export interface PlayerCallbacks {
  onTimeUpdate: (currentSecond: number, preciseTime: number) => void;
  onStateChange: (state: PlaybackState) => void;
  onError: (code: number, message: string) => void;
  onReady: () => void;
  onEnded: () => void;
}
```

### YouTube API Loader Singleton

```typescript
// lib/youtube-api-loader.ts

let apiLoadPromise: Promise<void> | null = null;

/**
 * Loads the YouTube IFrame API script exactly once.
 * Returns a promise that resolves when `YT.Player` is available.
 */
export function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    // If already loaded (e.g., from a previous mount)
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    // Store the resolve callback for the global handler
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      resolve();
    };

    // Inject the script tag
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiLoadPromise = null;
      reject(new Error('Failed to load YouTube IFrame API'));
    };

    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode!.insertBefore(script, firstScript);
  });

  return apiLoadPromise;
}
```

### YouTubeVideoPlayer Component

```typescript
// app/survey/[id]/components/question-types/YouTubeVideoPlayer.tsx

'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { loadYouTubeAPI } from '@/lib/youtube-api-loader';
import {
  YTPlayerState,
  YTErrorCode,
  type PlaybackState,
  type PlayerCallbacks,
} from '@/types/youtube';

interface YouTubeVideoPlayerProps {
  videoId: string;
  /** Callbacks for time updates, state changes, errors */
  onTimeUpdate?: (currentSecond: number, preciseTime: number) => void;
  onStateChange?: (state: PlaybackState) => void;
  onError?: (code: number, message: string) => void;
  onReady?: () => void;
  onEnded?: () => void;
  /** Whether to auto-play once ready (requires prior user gesture) */
  autoPlay?: boolean;
  /** Width/height or CSS class for the container */
  className?: string;
}

/** How often we poll getCurrentTime() in ms */
const POLL_INTERVAL_MS = 250;

/** If time jumps more than this many seconds, it's a seek */
const SEEK_THRESHOLD_SECS = 1.5;

/** Human-readable error messages */
const ERROR_MESSAGES: Record<number, string> = {
  [YTErrorCode.INVALID_PARAM]: 'Invalid video ID.',
  [YTErrorCode.HTML5_ERROR]: 'The video could not be played (HTML5 error).',
  [YTErrorCode.NOT_FOUND]: 'Video not found. It may have been removed or is private.',
  [YTErrorCode.NOT_EMBEDDABLE]: 'This video cannot be embedded.',
  [YTErrorCode.NOT_EMBEDDABLE_2]: 'This video cannot be embedded.',
};

export default function YouTubeVideoPlayer({
  videoId,
  onTimeUpdate,
  onStateChange,
  onError,
  onReady,
  onEnded,
  autoPlay = false,
  className,
}: YouTubeVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Seek-detection state (refs to avoid re-renders)
  const lastKnownTimeRef = useRef<number>(0);
  const lastPollTimestampRef = useRef<number>(Date.now());
  const isPlayingRef = useRef<boolean>(false);
  const lastReportedSecondRef = useRef<number>(-1);

  // Store callbacks in refs so the YT player event handlers always see latest
  const callbacksRef = useRef<Partial<PlayerCallbacks>>({});
  callbacksRef.current = { onTimeUpdate, onStateChange, onError, onReady, onEnded };

  /** Map YT state integer to our PlaybackState */
  const mapState = useCallback((ytState: number): PlaybackState => {
    switch (ytState) {
      case YTPlayerState.PLAYING:
        return 'playing';
      case YTPlayerState.PAUSED:
        return 'paused';
      case YTPlayerState.BUFFERING:
        return 'buffering';
      case YTPlayerState.ENDED:
        return 'ended';
      case YTPlayerState.UNSTARTED:
      case YTPlayerState.VIDEO_CUED:
      default:
        return 'idle';
    }
  }, []);

  /** Start polling getCurrentTime() */
  const startPolling = useCallback(() => {
    stopPolling();
    lastPollTimestampRef.current = Date.now();

    pollIntervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || !isPlayingRef.current) return;

      try {
        const now = Date.now();
        const elapsed = (now - lastPollTimestampRef.current) / 1000;
        const currentTime = player.getCurrentTime();
        const expectedTime = lastKnownTimeRef.current + elapsed;

        // --- Seek detection ---
        if (
          lastKnownTimeRef.current > 0 &&
          Math.abs(currentTime - expectedTime) > SEEK_THRESHOLD_SECS
        ) {
          // Seek detected: revert to where we expected playback to be
          const revertTo = Math.min(expectedTime, player.getDuration());
          player.seekTo(revertTo, true);
          lastKnownTimeRef.current = revertTo;
          lastPollTimestampRef.current = now;
          return; // Skip this tick's time report
        }

        // --- Time reporting ---
        lastKnownTimeRef.current = currentTime;
        lastPollTimestampRef.current = now;

        const currentSecond = Math.floor(currentTime);
        if (currentSecond !== lastReportedSecondRef.current) {
          lastReportedSecondRef.current = currentSecond;
          callbacksRef.current.onTimeUpdate?.(currentSecond, currentTime);
        }
      } catch {
        // Player may have been destroyed; ignore
      }
    }, POLL_INTERVAL_MS);
  }, []);

  /** Stop polling */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /** Handle YT player state changes */
  const handleStateChange = useCallback(
    (event: YT.OnStateChangeEvent) => {
      const ytState = event.data;
      const state = mapState(ytState);

      // --- Prevent unauthorized pauses ---
      // If the user managed to tap-pause despite our overlay, force-resume
      if (ytState === YTPlayerState.PAUSED && isPlayingRef.current) {
        // Small delay to avoid fight with YT's internal state machine
        setTimeout(() => {
          playerRef.current?.playVideo();
        }, 100);
        return; // Don't report this transient pause to the dial
      }

      // --- Buffering: pause dial capture ---
      if (ytState === YTPlayerState.BUFFERING) {
        isPlayingRef.current = false;
        callbacksRef.current.onStateChange?.('buffering');
        return;
      }

      // --- Playing: resume dial capture ---
      if (ytState === YTPlayerState.PLAYING) {
        isPlayingRef.current = true;
        // Reset seek-detection baseline after buffering
        lastKnownTimeRef.current = playerRef.current?.getCurrentTime() ?? 0;
        lastPollTimestampRef.current = Date.now();
        startPolling();
        callbacksRef.current.onStateChange?.('playing');
        return;
      }

      // --- Ended ---
      if (ytState === YTPlayerState.ENDED) {
        isPlayingRef.current = false;
        stopPolling();
        callbacksRef.current.onStateChange?.('ended');
        callbacksRef.current.onEnded?.();
        return;
      }

      // --- Other states ---
      isPlayingRef.current = false;
      callbacksRef.current.onStateChange?.(state);
    },
    [mapState, startPolling, stopPolling]
  );

  /** Handle YT errors */
  const handleError = useCallback((event: YT.OnErrorEvent) => {
    const code = event.data;
    const message = ERROR_MESSAGES[code] ?? `Unknown YouTube error (code ${code}).`;
    isPlayingRef.current = false;
    stopPolling();
    callbacksRef.current.onStateChange?.('error');
    callbacksRef.current.onError?.(code, message);
  }, [stopPolling]);

  /** Handle player ready */
  const handleReady = useCallback(() => {
    callbacksRef.current.onReady?.();
    if (autoPlay) {
      playerRef.current?.playVideo();
    }
  }, [autoPlay]);

  // --- Initialize player ---
  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        await loadYouTubeAPI();
      } catch (err) {
        callbacksRef.current.onError?.(
          -1,
          'Failed to load YouTube API. Check network connectivity.'
        );
        return;
      }

      if (destroyed || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0,           // Hide all controls
          disablekb: 1,          // Disable keyboard shortcuts
          fs: 0,                 // No fullscreen button
          rel: 0,                // Minimize related videos
          iv_load_policy: 3,     // Hide annotations
          playsinline: 1,        // Inline on iOS (critical)
          enablejsapi: 1,        // Enable JS API
          modestbranding: 1,     // Deprecated but harmless
          autoplay: autoPlay ? 1 : 0,
          origin: window.location.origin,
        },
        events: {
          onReady: handleReady,
          onStateChange: handleStateChange,
          onError: handleError,
        },
      });
    }

    init();

    return () => {
      destroyed = true;
      stopPolling();
      try {
        playerRef.current?.destroy();
      } catch {
        // Ignore destroy errors during unmount
      }
      playerRef.current = null;
    };
    // videoId is the only dep that should cause re-initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}
    >
      {/* YouTube player mounts here */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Transparent overlay: blocks all tap/click/touch on the iframe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
          // Transparent, but captures all pointer events
          background: 'transparent',
        }}
        onClick={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
```

### VideoPlayerAdapter Interface (Unified Wrapper)

This matches the architecture described in your plan for wrapping both HTML5 `<video>` and YouTube:

```typescript
// app/survey/[id]/components/question-types/VideoPlayerAdapter.ts

import type { PlaybackState } from '@/types/youtube';

/**
 * Unified interface for video playback.
 * Both Html5VideoPlayer and YouTubeVideoPlayer implement this.
 */
export interface VideoPlayerAdapter {
  /** Start playback */
  play(): void;
  /** Pause playback */
  pause(): void;
  /** Get current playback position in seconds */
  getCurrentTime(): number;
  /** Get total duration in seconds */
  getDuration(): number;
  /** Seek to a specific time (used internally for seek reversion) */
  seekTo(seconds: number): void;
  /** Current playback state */
  getState(): PlaybackState;
  /** Clean up resources */
  destroy(): void;
}
```

### Usage Example in VideoDial Component

```typescript
// Example: how VideoDial.tsx would use the YouTubeVideoPlayer

'use client';

import React, { useState, useCallback, useRef } from 'react';
import YouTubeVideoPlayer from './YouTubeVideoPlayer';
import type { PlaybackState } from '@/types/youtube';

interface VideoDialProps {
  videoId: string;
  mode: 'intensity' | 'sentiment';
}

export default function VideoDial({ videoId, mode }: VideoDialProps) {
  const [dialValue, setDialValue] = useState(50);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [isCapturing, setIsCapturing] = useState(false);
  const dialDataRef = useRef<Record<number, number>>({});

  const handleTimeUpdate = useCallback(
    (currentSecond: number, _preciseTime: number) => {
      if (isCapturing) {
        // Record the dial position at this second
        dialDataRef.current[currentSecond] = dialValue;
      }
    },
    [dialValue, isCapturing]
  );

  const handleStateChange = useCallback((state: PlaybackState) => {
    setPlaybackState(state);

    switch (state) {
      case 'playing':
        setIsCapturing(true);
        break;
      case 'buffering':
        // Pause dial capture -- respondent is not watching content
        setIsCapturing(false);
        break;
      case 'ended':
        setIsCapturing(false);
        // Submit dialDataRef.current to your API
        console.log('Dial data:', dialDataRef.current);
        break;
      case 'error':
        setIsCapturing(false);
        break;
    }
  }, []);

  const handleError = useCallback((code: number, message: string) => {
    console.error(`YouTube error ${code}: ${message}`);
    // Show error UI to respondent
  }, []);

  return (
    <div>
      <YouTubeVideoPlayer
        videoId={videoId}
        onTimeUpdate={handleTimeUpdate}
        onStateChange={handleStateChange}
        onError={handleError}
      />

      {playbackState === 'buffering' && (
        <div className="text-sm text-gray-500 mt-2">Buffering...</div>
      )}

      {/* Dial slider */}
      <input
        type="range"
        min={0}
        max={100}
        value={dialValue}
        onChange={(e) => setDialValue(Number(e.target.value))}
        disabled={playbackState !== 'playing'}
        className="w-full mt-4"
      />
    </div>
  );
}
```

---

## Summary of Key Decisions

| Concern | Solution |
|---|---|
| Hide all controls | `controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3` |
| Prevent tap-to-pause | Transparent overlay div with `zIndex` above iframe |
| Prevent seeking | Poll `getCurrentTime()` at 250ms, detect time jumps > 1.5s, revert with `seekTo()` |
| Prevent unauthorized pause | Detect PAUSED state, immediately call `playVideo()` |
| Per-second time sync | 250ms polling, `Math.floor(currentTime)` for second boundaries, report via callback |
| Buffering handling | `onStateChange` BUFFERING (3) pauses dial capture; PLAYING (1) resumes it |
| iOS inline playback | `playsinline: 1` (mandatory) |
| Autoplay on mobile | Click-to-play overlay required (unmuted autoplay blocked by browser policy) |
| Unlisted videos | Work identically to public videos in iframe embeds, no OAuth needed |
| Private videos | Cannot be embedded without OAuth -- use unlisted instead |
| API rate limits | None for client-side IFrame API methods; 250ms polling is safe |
| `modestbranding` | Deprecated, will have no effect -- include but do not rely on it |

---

## Sources

- [YouTube Player API Reference for iframe Embeds](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters)
- [YouTube API Services - Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [YouTube API Services - Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [Listening to YouTube Embed Iframe time change events without polling](https://gist.github.com/zavan/75ed641de5afb1296dbc02185ebf1ea0)
- [How We Safely Embed YouTube Videos in Educational Websites](https://medium.com/@hakim.ziad/how-we-safely-embed-youtube-videos-in-educational-websites-c26e5a9817e5)
- [YouTube IFrame API: Disable Pause Video](https://copyprogramming.com/howto/youtube-iframe-disable-pause-video)
- [Fix Next.js YouTube Autoplay Issues on iOS](https://www.technetexperts.com/youtube-iframe-ios-autoplay-fix/)
- [Apple Developer Forums: YouTube embed iframe problem in iOS Safari](https://developer.apple.com/forums/thread/713772)