Now I have comprehensive research across all seven topics. Let me compile this into a thorough response.

---

# Video Dial Testing / Continuous Rating System: Browser Implementation Best Practices (2025-2026)

This is a comprehensive technical guide covering all seven areas of your research request, synthesized from official documentation, W3C standards, and current browser behavior.

---

## 1. HTML5 Video API Precise Timing

There are three main approaches for synchronizing slider data capture to video playback, each with different accuracy characteristics.

### Approach Comparison

| Method | Frequency | Accuracy | Use Case |
|--------|-----------|----------|----------|
| `timeupdate` event | 4-66 Hz (variable) | Low | Basic progress bars, non-critical timing |
| `requestAnimationFrame` | ~60 Hz (display rate) | Medium | UI animations synced to display |
| `requestVideoFrameCallback` | Video frame rate | High | Per-frame video processing, precise sync |
| `setInterval(fn, 1000)` | ~1 Hz (nominal) | Low (drifts) | Crude per-second sampling, unreliable |

### Recommendation: `requestVideoFrameCallback` with `setInterval` Fallback

For a dial testing system that needs **per-second** accuracy, `requestVideoFrameCallback` is the best primary method, with `requestAnimationFrame` as a fallback for browsers that do not yet support it.

```javascript
class VideoTimeSampler {
  constructor(videoElement, onSecondTick) {
    this.video = videoElement;
    this.onSecondTick = onSecondTick;
    this.lastRecordedSecond = -1;
    this._rafId = null;
    this._rvfcId = null;
  }

  start() {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      this._useRVFC();
    } else {
      this._useRAF();
    }
  }

  stop() {
    if (this._rvfcId !== null) {
      this.video.cancelVideoFrameCallback(this._rvfcId);
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
    }
  }

  _useRVFC() {
    const tick = (now, metadata) => {
      // metadata.mediaTime gives the precise presentation timestamp
      const currentSecond = Math.floor(metadata.mediaTime);
      if (currentSecond !== this.lastRecordedSecond && !this.video.paused) {
        this.lastRecordedSecond = currentSecond;
        this.onSecondTick(currentSecond, metadata.mediaTime);
      }
      this._rvfcId = this.video.requestVideoFrameCallback(tick);
    };
    this._rvfcId = this.video.requestVideoFrameCallback(tick);
  }

  _useRAF() {
    const tick = () => {
      if (!this.video.paused && !this.video.ended) {
        const currentSecond = Math.floor(this.video.currentTime);
        if (currentSecond !== this.lastRecordedSecond) {
          this.lastRecordedSecond = currentSecond;
          this.onSecondTick(currentSecond, this.video.currentTime);
        }
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }
}
```

### Why NOT `timeupdate`

The [MDN documentation for `timeupdate`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) states that user agents vary the frequency between **4 Hz and 66 Hz** based on system load. This means:
- At 4 Hz you get a reading every 250ms, which could miss second boundaries.
- The frequency is unpredictable and not configurable.
- Event handlers must complete within 250ms or the browser will reduce frequency further.

### Why NOT `setInterval`

`setInterval(fn, 1000)` drifts over time because JavaScript timers are not guaranteed to fire on schedule, especially when the tab is throttled or the main thread is busy. Over a 60-second video, drift can accumulate to several hundred milliseconds.

### Handling Buffering Gaps and Stalls

```javascript
class BufferAwareTimeSampler extends VideoTimeSampler {
  constructor(videoElement, onSecondTick, onBuffering) {
    super(videoElement, onSecondTick);
    this.onBuffering = onBuffering;
    this._isBuffering = false;

    // Detect when video stalls
    this.video.addEventListener('waiting', () => {
      this._isBuffering = true;
      this.onBuffering(true, Math.floor(this.video.currentTime));
    });

    // Detect when playback resumes after stall
    this.video.addEventListener('playing', () => {
      if (this._isBuffering) {
        this._isBuffering = false;
        this.onBuffering(false, Math.floor(this.video.currentTime));
        // Re-anchor lastRecordedSecond to prevent duplicate ticks
        this.lastRecordedSecond = Math.floor(this.video.currentTime) - 1;
      }
    });

    // Detect unexpected seeks (should not happen in dial test, but guard)
    this.video.addEventListener('seeked', () => {
      this.lastRecordedSecond = Math.floor(this.video.currentTime) - 1;
    });
  }
}
```

### Browser Compatibility for `requestVideoFrameCallback`

Per [Can I Use](https://caniuse.com/mdn-api_htmlvideoelement_requestvideoframecallback) and the [MDN page](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback), this API reached **Baseline 2024** (newly available across major browsers since October 2024):
- Chrome 83+
- Edge 83+
- Safari 15.4+
- Firefox 132+ (added late 2024)
- **Note**: This API is NOT available for YouTube IFrame embeds since you do not have access to the underlying `<video>` element.

---

## 2. YouTube IFrame Player API

### Critical Legal Constraint

**Before designing around YouTube embeds, understand the [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) rules:**

- You **must not** modify, add to, or block the standard playback function of the YouTube player.
- You **must not** display overlays, frames, or visual elements in front of any part of the player, including controls.
- You **must not** disable or block related video links after playback ends.
- Player must be at minimum **200x200 pixels**.

This means **you cannot fully disable seeking or hide the progress bar** while remaining compliant with YouTube's Terms of Service. If your dial test requires preventing seek/pause, you must either:

1. **Self-host the video** using HTML5 `<video>` (recommended for full control).
2. Accept that users *can* seek and design your data capture to detect and handle it.

### YouTube Embed Setup (if proceeding)

```javascript
// Load the IFrame Player API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

let player;

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player-container', {
    videoId: 'YOUR_VIDEO_ID',
    playerVars: {
      controls:    0,        // Hide controls (but user can still tap to pause)
      disablekb:   1,        // Disable keyboard controls
      fs:          0,        // Disable fullscreen button
      rel:         0,        // Don't show related videos
      playsinline: 1,        // Required for iOS inline playback
      enablejsapi: 1,        // Enable JS API
      iv_load_policy: 3,     // Disable video annotations
      // modestbranding is DEPRECATED as of 2025 - do not use
    },
    events: {
      onReady:       onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError:       onPlayerError,
    },
  });
}
```

### Important: `controls: 0` Does NOT Prevent Seeking

Setting `controls: 0` hides the control bar but users can still:
- Tap/click the video to pause/play.
- Double-tap to seek forward/backward on mobile.

### Polling `getCurrentTime()` for YouTube

Since `requestVideoFrameCallback` is unavailable for YouTube embeds, you must poll:

```javascript
class YouTubeDialTracker {
  constructor(player, onSecondTick) {
    this.player = player;
    this.onSecondTick = onSecondTick;
    this.lastSecond = -1;
    this.pollInterval = null;
    this.expectedTime = 0;
  }

  start() {
    // Poll at ~4x per second to catch every second boundary
    this.pollInterval = setInterval(() => {
      if (this.player.getPlayerState() === YT.PlayerState.PLAYING) {
        const currentTime = this.player.getCurrentTime();
        const currentSecond = Math.floor(currentTime);

        // Detect seek: if time jumped more than 2 seconds from expected
        if (Math.abs(currentTime - this.expectedTime) > 2) {
          console.warn(`Seek detected: expected ~${this.expectedTime.toFixed(1)}s, got ${currentTime.toFixed(1)}s`);
          // Option A: Mark this data as tainted
          // Option B: seekTo back to expected position
          // this.player.seekTo(this.expectedTime, true);
        }

        if (currentSecond !== this.lastSecond) {
          this.lastSecond = currentSecond;
          this.onSecondTick(currentSecond, currentTime);
        }
        this.expectedTime = currentTime + 0.25; // next expected time
      }
    }, 250);
  }

  stop() {
    clearInterval(this.pollInterval);
  }
}
```

### Handling YouTube Buffering States

```javascript
function onPlayerStateChange(event) {
  switch (event.data) {
    case YT.PlayerState.BUFFERING:  // 3
      // Pause data collection, show buffering indicator
      dialTracker.pause();
      showBufferingOverlay();
      break;
    case YT.PlayerState.PLAYING:    // 1
      dialTracker.resume();
      hideBufferingOverlay();
      break;
    case YT.PlayerState.PAUSED:     // 2
      // User managed to pause - auto-resume or flag
      player.playVideo();
      break;
    case YT.PlayerState.ENDED:      // 0
      dialTracker.stop();
      submitResults();
      break;
  }
}
```

### Mobile Safari and Chrome Android Quirks

| Issue | Safari iOS | Chrome Android |
|-------|-----------|----------------|
| Autoplay with sound | Blocked always | Blocked without MEI |
| Muted autoplay | Allowed (except Low Power Mode) | Allowed |
| `playsinline` | Required, or video opens fullscreen | Default behavior is inline |
| `getCurrentTime()` accuracy | ~100ms precision | ~50ms precision |
| Double-tap to seek | Works even with `controls: 0` | Works even with `controls: 0` |
| `onAutoplayBlocked` event | Supported (2025+) | Supported (2025+) |

### Deprecated YouTube Parameters (Do Not Use)

- `modestbranding` -- deprecated, no effect
- `showinfo` -- deprecated
- `autohide` -- deprecated
- `theme` -- deprecated

---

## 3. Custom Slider / Range Input for Continuous Rating

### HTML Structure

```html
<div class="dial-container" role="group" aria-label="Content rating dial">
  <label for="dial-slider" class="dial-label">
    Rate this moment: <output id="dial-value">50</output>
  </label>
  <input
    type="range"
    id="dial-slider"
    min="0"
    max="100"
    value="50"
    step="1"
    aria-label="Content rating"
    aria-valuetext="Neutral"
    aria-describedby="dial-instructions"
  />
  <div class="dial-labels" aria-hidden="true">
    <span>Negative</span>
    <span>Neutral</span>
    <span>Positive</span>
  </div>
  <p id="dial-instructions" class="sr-only">
    Drag the slider left for negative, right for positive. 
    Respond continuously as the video plays.
  </p>
</div>
```

### Cross-Browser CSS for Gradient Track

The key challenge is that Webkit/Blink and Firefox use different pseudo-elements. This CSS covers both engine families:

```css
/* ======= Reset and Base ======= */
input[type="range"].dial-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 48px;          /* Large touch target */
  background: transparent;
  cursor: pointer;
  margin: 0;
  padding: 0;
}

/* ======= Track Styling ======= */
input[type="range"].dial-slider::-webkit-slider-runnable-track {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    to right,
    #d32f2f 0%,      /* Red - negative */
    #f9a825 25%,     /* Yellow-orange */
    #fdd835 50%,     /* Yellow - neutral */
    #8bc34a 75%,     /* Light green */
    #2e7d32 100%     /* Green - positive */
  );
  border: 1px solid rgba(0, 0, 0, 0.15);
}

input[type="range"].dial-slider::-moz-range-track {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    to right,
    #d32f2f 0%,
    #f9a825 25%,
    #fdd835 50%,
    #8bc34a 75%,
    #2e7d32 100%
  );
  border: 1px solid rgba(0, 0, 0, 0.15);
}

/* ======= Thumb Styling ======= */
input[type="range"].dial-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid #333;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  margin-top: -11px;   /* Center thumb on track: (trackH - thumbH) / 2 */
  /* touch-action prevents scroll interference on mobile */
  touch-action: none;
}

input[type="range"].dial-slider::-moz-range-thumb {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid #333;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  touch-action: none;
}

/* ======= Focus States ======= */
input[type="range"].dial-slider:focus-visible::-webkit-slider-thumb {
  outline: 3px solid #1a73e8;
  outline-offset: 3px;
}

input[type="range"].dial-slider:focus-visible::-moz-range-thumb {
  outline: 3px solid #1a73e8;
  outline-offset: 3px;
}
```

### High-Performance Input Capture

For continuous rating, you need to capture every value change without dropping frames. The key is to avoid expensive work in the `input` event handler:

```javascript
class DialCapture {
  constructor(sliderElement, outputElement) {
    this.slider = sliderElement;
    this.output = outputElement;
    this.currentValue = parseInt(sliderElement.value, 10);
    this._pendingWrite = false;

    // Use 'input' event (fires continuously during drag).
    // 'change' event only fires on release -- not useful here.
    this.slider.addEventListener('input', this._onInput.bind(this));

    // Prevent page scroll while dragging on mobile
    this.slider.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevents scroll, keeps slider functional
    }, { passive: false });
  }

  _onInput(e) {
    this.currentValue = parseInt(e.target.value, 10);

    // Batch DOM updates to next animation frame
    if (!this._pendingWrite) {
      this._pendingWrite = true;
      requestAnimationFrame(() => {
        this.output.textContent = this.currentValue;
        this._updateAriaValueText(this.currentValue);
        this._pendingWrite = false;
      });
    }
  }

  _updateAriaValueText(value) {
    let text;
    if (value <= 20)      text = 'Very negative';
    else if (value <= 40) text = 'Somewhat negative';
    else if (value <= 60) text = 'Neutral';
    else if (value <= 80) text = 'Somewhat positive';
    else                  text = 'Very positive';
    this.slider.setAttribute('aria-valuetext', text);
  }

  /** Called by the timing system each second */
  sampleValue() {
    return this.currentValue;
  }
}
```

### Performance Note

The `input` event on a range slider can fire at 60+ Hz during drag. Never do any of the following inside the handler:
- Network requests
- `localStorage.setItem()` (synchronous, blocks main thread)
- DOM layout-triggering reads (e.g., `offsetHeight`)

Instead, read the value into a variable, and let the timing sampler read that variable once per second.

---

## 4. Browser Autoplay Policies (2025-2026)

### Current State by Browser

| Browser | Muted Autoplay | Unmuted Autoplay | Notes |
|---------|---------------|------------------|-------|
| **Chrome Desktop** | Always allowed | Allowed if MEI threshold crossed or user interacted | [MEI viewable at `chrome://media-engagement`](https://developer.chrome.com/blog/autoplay) |
| **Chrome Android** | Always allowed | Requires user gesture or PWA homescreen | |
| **Safari Desktop** | Allowed | Blocked by default | User can allow per-site in settings |
| **Safari iOS** | Allowed (requires `playsinline`) | Blocked | **Completely blocked in Low Power Mode**, even muted |
| **Firefox** | Allowed | Blocked by default | User can configure in `about:preferences` |
| **Edge** | Same as Chrome | Same as Chrome | Uses Chromium engine |

### Media Engagement Index (MEI) - Chrome Specifics

Chrome's [autoplay policy](https://developer.chrome.com/blog/autoplay) uses the Media Engagement Index, which is a ratio of visits to significant media playback events per origin. The threshold requires:
- Media consumption greater than 7 seconds
- Audio present and unmuted
- Tab with video is active
- Video dimensions greater than 200x140 pixels

### Click-to-Play Overlay Pattern

For a dial test, always use a click-to-play pattern. This guarantees the user gesture requirement is met on all browsers:

```javascript
class PlayGate {
  constructor(videoElement, overlayElement) {
    this.video = videoElement;
    this.overlay = overlayElement;
    this.hasUserGesture = false;

    this.overlay.addEventListener('click', () => this._handleClick());
    this.overlay.addEventListener('touchend', (e) => {
      e.preventDefault(); // Prevent ghost click
      this._handleClick();
    });
  }

  async _handleClick() {
    if (this.hasUserGesture) return;
    this.hasUserGesture = true;

    try {
      // The play() call must happen synchronously within the user gesture
      // handler -- do NOT await anything before calling play().
      await this.video.play();
      this.overlay.hidden = true;
      this.overlay.setAttribute('aria-hidden', 'true');
      this._onPlaybackStarted();
    } catch (err) {
      // Autoplay was blocked despite user gesture (e.g., iOS Low Power Mode)
      this.hasUserGesture = false;
      console.error('Playback failed:', err);
      this._showRetryUI();
    }
  }

  _showRetryUI() {
    this.overlay.textContent = 'Tap again to play video';
  }

  _onPlaybackStarted() {
    // Signal to dial test system that playback has begun
    document.dispatchEvent(new CustomEvent('dial-test:playback-started'));
  }
}
```

### `playsinline` on iOS Safari

```html
<!-- All three attributes required for reliable iOS inline playback -->
<video
  playsinline
  webkit-playsinline
  muted
  preload="auto"
  src="video.mp4"
>
</video>
```

Important iOS behaviors:
- Without `playsinline`, iOS Safari will open the video in a **native fullscreen player**, which breaks the dial test UI.
- `webkit-playsinline` is needed for older iOS WebViews.
- In **Low Power Mode** (iOS 17+), even muted autoplay is completely blocked. There is no programmatic workaround -- you must detect the failure and show a play button.

### YouTube-Specific Autoplay

For YouTube embeds, the `iframe` tag itself needs the `allow` attribute:

```html
<iframe
  id="player-container"
  src="https://www.youtube.com/embed/VIDEO_ID?enablejsapi=1&playsinline=1&mute=1"
  allow="autoplay; encrypted-media"
  allowfullscreen
  frameborder="0"
></iframe>
```

The `onAutoplayBlocked` event (added 2025) notifies your application when autoplay is blocked:

```javascript
function onPlayerReady(event) {
  event.target.playVideo();
}

// New in 2025 YouTube API
function onAutoplayBlocked(event) {
  showClickToPlayOverlay();
}
```

---

## 5. Video Preloading Strategies

### Strategy: Fully Buffer Before Playback

For a dial test, you want uninterrupted playback. Here is a complete preloading implementation:

```javascript
class VideoPreloader {
  constructor(videoElement, progressCallback) {
    this.video = videoElement;
    this.progressCallback = progressCallback;
    this.isFullyBuffered = false;
  }

  async preload() {
    return new Promise((resolve, reject) => {
      // Force the browser to begin downloading
      this.video.preload = 'auto';

      // Some browsers need a load() call to begin fetching
      this.video.load();

      const checkBuffer = () => {
        if (this.video.readyState < 1) return; // No metadata yet

        const duration = this.video.duration;
        if (!duration || !isFinite(duration)) return;

        let totalBuffered = 0;
        for (let i = 0; i < this.video.buffered.length; i++) {
          totalBuffered += this.video.buffered.end(i) - this.video.buffered.start(i);
        }

        const pct = Math.min(100, (totalBuffered / duration) * 100);
        this.progressCallback(pct, totalBuffered, duration);

        // Check if the end of the video is buffered
        if (this.video.buffered.length > 0) {
          const lastEnd = this.video.buffered.end(this.video.buffered.length - 1);
          if (lastEnd >= duration - 0.5) {
            this.isFullyBuffered = true;
            resolve();
            return;
          }
        }
      };

      // 'progress' fires as data downloads
      this.video.addEventListener('progress', checkBuffer);

      // 'canplaythrough' fires when browser estimates it can play through
      // NOTE: This is a HINT, not a guarantee -- Chrome is known to fire
      // this prematurely. The progress-based check above is more reliable.
      this.video.addEventListener('canplaythrough', () => {
        // Double-check with our own buffer calculation
        checkBuffer();
      });

      this.video.addEventListener('error', (e) => {
        reject(new Error(`Video load error: ${this.video.error?.message}`));
      });

      // Timeout safety net: resolve after 60s even if not fully buffered
      setTimeout(() => {
        if (!this.isFullyBuffered) {
          console.warn('Preload timeout -- proceeding with partial buffer');
          resolve();
        }
      }, 60000);
    });
  }
}

// Usage
const video = document.getElementById('test-video');
const preloader = new VideoPreloader(video, (pct) => {
  document.getElementById('load-bar').style.width = `${pct}%`;
  document.getElementById('load-text').textContent = `Loading: ${Math.round(pct)}%`;
});

preloader.preload().then(() => {
  document.getElementById('start-button').disabled = false;
});
```

### Mobile Preloading Challenges

Mobile browsers **ignore** `preload="auto"` to conserve bandwidth. The [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload) explicitly states that `preload` values are "hints" that mobile browsers choose not to follow.

Workarounds for mobile:

```javascript
// Strategy: Use fetch() + blob URL to force-download on mobile
async function preloadVideoBlob(url) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const contentLength = parseInt(response.headers.get('Content-Length'), 10);

  let receivedLength = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;

    const pct = contentLength ? (receivedLength / contentLength * 100) : 0;
    updateProgress(pct);
  }

  const blob = new Blob(chunks, { type: 'video/mp4' });
  return URL.createObjectURL(blob);
}

// Usage
preloadVideoBlob('https://example.com/test-video.mp4').then((blobUrl) => {
  video.src = blobUrl;
  video.load();
});
```

**Caution for large files (100MB+):** The blob approach loads the entire file into memory. On mobile devices with limited RAM, this can cause the browser tab to crash. For files over ~50MB, consider:
- Using **Media Source Extensions (MSE)** to stream in chunks.
- Accepting that some buffering may occur and handling it with the stall detection from Section 1.
- Compressing the video to a lower bitrate (a 1080p video at 2 Mbps is ~15 MB/min).

---

## 6. Data Capture Reliability

### Ensuring No Seconds Are Missed

The core data structure for a dial test session:

```javascript
class DialTestSession {
  constructor(videoDurationSeconds) {
    this.duration = videoDurationSeconds;
    // Pre-allocate array: null means "not yet recorded"
    this.data = new Array(videoDurationSeconds).fill(null);
    this.metadata = {
      startTime: null,
      endTime: null,
      bufferEvents: [],
      visibilityChanges: [],
      version: 1,
    };
  }

  recordSecond(second, value) {
    if (second >= 0 && second < this.duration) {
      this.data[second] = value;
    }
  }

  getMissedSeconds() {
    return this.data
      .map((val, idx) => val === null ? idx : -1)
      .filter(idx => idx !== -1);
  }

  isComplete() {
    return this.data.every(val => val !== null);
  }

  toJSON() {
    return {
      data: this.data,
      metadata: this.metadata,
      missed: this.getMissedSeconds(),
      completeness: (this.data.filter(v => v !== null).length / this.duration * 100).toFixed(1) + '%',
    };
  }
}
```

### Periodic Local Save with IndexedDB

Use IndexedDB (not localStorage) for periodic saves. IndexedDB is asynchronous and will not block the main thread during video playback:

```javascript
class DialTestPersistence {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.db = null;
    this.saveInterval = null;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DialTestDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async save(session) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      store.put({ id: this.sessionId, ...session.toJSON(), savedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  startAutoSave(session, intervalMs = 5000) {
    // Save every 5 seconds during playback
    this.saveInterval = setInterval(() => {
      this.save(session).catch(err => console.error('Auto-save failed:', err));
    }, intervalMs);
  }

  stopAutoSave() {
    clearInterval(this.saveInterval);
  }

  async recover() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const request = store.get(this.sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  }
}
```

### Page Visibility API Handling

When the user switches tabs, browsers throttle timers and may pause video. This must be handled to avoid data gaps:

```javascript
class VisibilityHandler {
  constructor(videoElement, session) {
    this.video = videoElement;
    this.session = session;
    this.wasPlayingBeforeHidden = false;

    document.addEventListener('visibilitychange', () => {
      const timestamp = Date.now();
      const videoTime = Math.floor(this.video.currentTime);

      if (document.hidden) {
        // Tab became hidden
        this.wasPlayingBeforeHidden = !this.video.paused;

        // Option A: Pause video (recommended for dial testing)
        this.video.pause();

        this.session.metadata.visibilityChanges.push({
          type: 'hidden',
          timestamp,
          videoTime,
        });
      } else {
        // Tab became visible again
        this.session.metadata.visibilityChanges.push({
          type: 'visible',
          timestamp,
          videoTime,
        });

        if (this.wasPlayingBeforeHidden) {
          // Show a "ready to continue?" overlay rather than auto-resuming
          // This prevents the user from missing content
          this._showResumeOverlay();
        }
      }
    });
  }

  _showResumeOverlay() {
    const overlay = document.getElementById('resume-overlay');
    overlay.hidden = false;
    overlay.querySelector('button').addEventListener('click', () => {
      overlay.hidden = true;
      this.video.play();
    }, { once: true });
  }
}
```

### Final Submission with Gap Detection

```javascript
async function submitDialData(session, persistence) {
  persistence.stopAutoSave();

  const missed = session.getMissedSeconds();
  if (missed.length > 0) {
    console.warn(`Missing data for seconds: ${missed.join(', ')}`);
    // Option: Fill gaps with interpolated values
    for (const sec of missed) {
      const before = session.data.slice(0, sec).findLast(v => v !== null);
      const after = session.data.slice(sec + 1).find(v => v !== null);
      if (before !== undefined && after !== undefined) {
        session.data[sec] = Math.round((before + after) / 2);
      } else if (before !== undefined) {
        session.data[sec] = before;
      }
    }
  }

  const payload = session.toJSON();

  try {
    const response = await fetch('/api/dial-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // Clean up local backup
      await persistence.save({ ...payload, submitted: true });
    } else {
      throw new Error(`Server responded ${response.status}`);
    }
  } catch (err) {
    // Network error -- data is safe in IndexedDB
    console.error('Submission failed, data preserved locally:', err);
    alert('Your response has been saved. It will be submitted when you reconnect.');
  }
}
```

---

## 7. Accessibility for Continuous Rating

### ARIA Slider Pattern (W3C WAI-APG Compliant)

Following the [W3C WAI ARIA Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/):

```javascript
function setupAccessibleDial(slider) {
  // Ensure required ARIA attributes
  slider.setAttribute('role', 'slider');
  slider.setAttribute('aria-valuemin', '0');
  slider.setAttribute('aria-valuemax', '100');
  slider.setAttribute('aria-valuenow', slider.value);
  slider.setAttribute('aria-label', 'Content rating');

  // Map numeric values to meaningful text
  function valueToText(val) {
    if (val <= 10) return 'Very negative, ' + val + ' out of 100';
    if (val <= 30) return 'Negative, ' + val + ' out of 100';
    if (val <= 45) return 'Slightly negative, ' + val + ' out of 100';
    if (val <= 55) return 'Neutral, ' + val + ' out of 100';
    if (val <= 70) return 'Slightly positive, ' + val + ' out of 100';
    if (val <= 90) return 'Positive, ' + val + ' out of 100';
    return 'Very positive, ' + val + ' out of 100';
  }

  slider.addEventListener('input', () => {
    slider.setAttribute('aria-valuenow', slider.value);
    slider.setAttribute('aria-valuetext', valueToText(parseInt(slider.value, 10)));
  });

  // Keyboard controls (native <input type="range"> already handles arrows,
  // but we add Page Up/Down for larger steps)
  slider.addEventListener('keydown', (e) => {
    const step = 1;
    const largeStep = 10;
    let val = parseInt(slider.value, 10);

    switch (e.key) {
      case 'PageUp':
        e.preventDefault();
        slider.value = Math.min(100, val + largeStep);
        slider.dispatchEvent(new Event('input'));
        break;
      case 'PageDown':
        e.preventDefault();
        slider.value = Math.max(0, val - largeStep);
        slider.dispatchEvent(new Event('input'));
        break;
      case 'Home':
        e.preventDefault();
        slider.value = 0;
        slider.dispatchEvent(new Event('input'));
        break;
      case 'End':
        e.preventDefault();
        slider.value = 100;
        slider.dispatchEvent(new Event('input'));
        break;
    }
  });
}
```

### Color-Blind Alternatives to Red-Yellow-Green Gradient

The red-yellow-green gradient is **not accessible** for users with protanopia or deuteranopia (the two most common forms of color blindness, affecting ~8% of males). Three alternative approaches:

**Option A: Add text labels and patterns (recommended)**

```css
/* Use a gradient that includes a pattern overlay for differentiation */
.dial-track-accessible {
  position: relative;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    to right,
    #d32f2f 0%,
    #fdd835 50%,
    #2e7d32 100%
  );
}

/* Pattern overlay using CSS repeating-linear-gradient */
.dial-track-accessible::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background:
    /* Diagonal lines on left (negative) zone */
    linear-gradient(135deg,
      rgba(255,255,255,0.3) 25%, transparent 25%,
      transparent 50%, rgba(255,255,255,0.3) 50%,
      rgba(255,255,255,0.3) 75%, transparent 75%
    ),
    /* Solid center (neutral) zone -- no pattern */
    /* Dots on right (positive) zone handled by labels */
    ;
  background-size: 8px 8px;
  /* Only show pattern on left third */
  mask: linear-gradient(to right, black 33%, transparent 33%);
  -webkit-mask: linear-gradient(to right, black 33%, transparent 33%);
  pointer-events: none;
}
```

**Option B: Use a color-blind-safe palette**

```css
/* Blue-to-orange diverging palette (safe for all common color blindness types) */
.dial-track-cb-safe {
  background: linear-gradient(
    to right,
    #2166ac 0%,    /* Blue - negative */
    #67a9cf 25%,
    #f7f7f7 50%,   /* Neutral white/grey */
    #ef8a62 75%,
    #b2182b 100%   /* Red-orange - positive */
  );
}
```

**Option C: Add "-" and "+" symbols alongside the gradient**

```html
<div class="dial-track-wrapper">
  <span class="dial-icon dial-icon--negative" aria-hidden="true">&#x2212;</span>
  <input type="range" class="dial-slider" min="0" max="100" value="50" />
  <span class="dial-icon dial-icon--positive" aria-hidden="true">&#x002B;</span>
</div>
```

```css
.dial-track-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dial-icon {
  font-size: 24px;
  font-weight: bold;
  user-select: none;
}

.dial-icon--negative { color: #333; }
.dial-icon--positive { color: #333; }
```

### Screen Reader Considerations for Video + Slider

```html
<!-- Live region to announce current value periodically -->
<div id="dial-live-region" aria-live="polite" aria-atomic="true" class="sr-only">
  <!-- Updated by JavaScript every 5 seconds to avoid overwhelming screen readers -->
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
```

```javascript
// Announce slider position every 5 seconds (not every second,
// which would be overwhelming for screen reader users)
let announceCounter = 0;
function announceIfNeeded(second, value) {
  announceCounter++;
  if (announceCounter % 5 === 0) {
    const liveRegion = document.getElementById('dial-live-region');
    liveRegion.textContent = `At ${second} seconds: rating is ${value} out of 100`;
  }
}
```

---

## Complete Integration: Putting It All Together

Here is how these systems connect:

```javascript
// Main initialization
async function initDialTest(videoSrc, videoDuration) {
  const video = document.getElementById('test-video');
  const slider = document.getElementById('dial-slider');
  const output = document.getElementById('dial-value');

  // 1. Set up persistence
  const persistence = new DialTestPersistence(generateSessionId());
  await persistence.open();

  // 2. Check for recoverable session
  const recovered = await persistence.recover();
  if (recovered && !recovered.submitted) {
    // Offer to resume
  }

  // 3. Set up data session
  const session = new DialTestSession(videoDuration);

  // 4. Set up dial capture
  const dial = new DialCapture(slider, output);

  // 5. Set up preloader
  video.src = videoSrc;
  const preloader = new VideoPreloader(video, (pct) => {
    document.getElementById('load-progress').style.width = `${pct}%`;
  });
  await preloader.preload();

  // 6. Set up timing sampler
  const sampler = new BufferAwareTimeSampler(video, (second) => {
    const value = dial.sampleValue();
    session.recordSecond(second, value);
    announceIfNeeded(second, value);
  }, (isBuffering, atSecond) => {
    session.metadata.bufferEvents.push({ isBuffering, atSecond, timestamp: Date.now() });
  });

  // 7. Set up visibility handler
  const visibility = new VisibilityHandler(video, session);

  // 8. Set up auto-save
  persistence.startAutoSave(session);

  // 9. Set up play gate
  const playGate = new PlayGate(video, document.getElementById('play-overlay'));
  document.addEventListener('dial-test:playback-started', () => {
    session.metadata.startTime = Date.now();
    sampler.start();
  });

  // 10. Handle end
  video.addEventListener('ended', async () => {
    sampler.stop();
    session.metadata.endTime = Date.now();
    await submitDialData(session, persistence);
  });

  // 11. Set up accessibility
  setupAccessibleDial(slider);
}
```

---

## Summary of Key Recommendations

| Area | Recommendation |
|------|---------------|
| **Timing** | Use `requestVideoFrameCallback` with `requestAnimationFrame` fallback. Never rely on `timeupdate` alone. |
| **YouTube vs Self-Hosted** | Self-host video for full control. YouTube TOS prohibits disabling seek/controls. |
| **Autoplay** | Always use click-to-play overlay. Assume autoplay will fail on mobile. |
| **Slider** | Native `<input type="range">` with CSS gradients. 48px minimum touch target. |
| **Preloading** | Use `fetch()` + blob URL on mobile. Monitor `buffered` TimeRanges. Accept partial buffer for large files. |
| **Data Reliability** | Pre-allocate array for all seconds. Auto-save to IndexedDB every 5s. Pause video on tab hide. |
| **Accessibility** | Use `aria-valuetext` for meaningful labels. Blue-orange palette for color-blind safety. Do not announce every second to screen readers. |

---

## Sources

- [MDN: requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)
- [MDN: timeupdate event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event)
- [MDN: Media buffering, seeking, and time ranges](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery/buffering_seeking_time_ranges)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: Permissions-Policy autoplay](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/autoplay)
- [web.dev: requestVideoFrameCallback](https://web.dev/articles/requestvideoframecallback-rvfc)
- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay)
- [Can I Use: requestVideoFrameCallback](https://caniuse.com/mdn-api_htmlvideoelement_requestvideoframecallback)
- [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Player Parameters](https://developers.google.com/youtube/player_parameters)
- [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide)
- [W3C WAI ARIA Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- [W3C WAI ARIA Rating Slider Example](https://www.w3.org/WAI/ARIA/apg/patterns/slider/examples/slider-rating/)
- [W3C Range-Related Properties](https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/)
- [LogRocket: Custom CSS Range Slider](https://blog.logrocket.com/creating-custom-css-range-slider-javascript-upgrades/)
- [web.dev: Fast Playback with Preload](https://web.dev/fast-playback-with-preload/)
- [Dialsmith: Perception Analyzer Online](https://www.dialsmith.com/dial-testing-focus-groups-products-and-services/perception-analyzer-online-dial-research/)
- [localForage (IndexedDB/localStorage abstraction)](https://github.com/localForage/localForage)
- [LogRocket: Offline-First Frontend Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)