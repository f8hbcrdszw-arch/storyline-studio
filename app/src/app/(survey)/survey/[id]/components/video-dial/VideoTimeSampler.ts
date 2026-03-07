/**
 * Per-second time sampler for video playback.
 * Uses requestVideoFrameCallback when available (HTML5 video),
 * falls back to requestAnimationFrame.
 */
export class VideoTimeSampler {
  private video: HTMLVideoElement;
  private onSecondTick: (second: number) => void;
  private onBuffering: (isBuffering: boolean) => void;
  private lastRecordedSecond = -1;
  private rvfcId: number | null = null;
  private rafId: number | null = null;
  private isBuffering = false;

  constructor(
    video: HTMLVideoElement,
    onSecondTick: (second: number) => void,
    onBuffering: (isBuffering: boolean) => void
  ) {
    this.video = video;
    this.onSecondTick = onSecondTick;
    this.onBuffering = onBuffering;
  }

  start() {
    // Listen for buffer events
    this.video.addEventListener("waiting", this.handleWaiting);
    this.video.addEventListener("playing", this.handlePlaying);

    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      this.useRVFC();
    } else {
      this.useRAF();
    }
  }

  stop() {
    if (this.rvfcId !== null) {
      this.video.cancelVideoFrameCallback(this.rvfcId);
      this.rvfcId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.video.removeEventListener("waiting", this.handleWaiting);
    this.video.removeEventListener("playing", this.handlePlaying);
  }

  private handleWaiting = () => {
    this.isBuffering = true;
    this.onBuffering(true);
  };

  private handlePlaying = () => {
    if (this.isBuffering) {
      this.isBuffering = false;
      this.onBuffering(false);
      // Re-anchor to prevent duplicate ticks after buffer
      this.lastRecordedSecond = Math.floor(this.video.currentTime) - 1;
    }
  };

  private useRVFC() {
    const tick = (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
      const currentSecond = Math.floor(metadata.mediaTime);
      if (currentSecond !== this.lastRecordedSecond && !this.video.paused && !this.isBuffering) {
        this.lastRecordedSecond = currentSecond;
        this.onSecondTick(currentSecond);
      }
      this.rvfcId = this.video.requestVideoFrameCallback(tick);
    };
    this.rvfcId = this.video.requestVideoFrameCallback(tick);
  }

  private useRAF() {
    const tick = () => {
      if (!this.video.paused && !this.video.ended && !this.isBuffering) {
        const currentSecond = Math.floor(this.video.currentTime);
        if (currentSecond !== this.lastRecordedSecond) {
          this.lastRecordedSecond = currentSecond;
          this.onSecondTick(currentSecond);
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}

/**
 * Per-second time sampler for YouTube IFrame API.
 * Polls getCurrentTime() at 250ms (matching YouTube's internal sync frequency).
 */
export class YouTubeTimeSampler {
  private player: YT.Player;
  private onSecondTick: (second: number) => void;
  private lastRecordedSecond = -1;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastKnownTime = 0;
  private lastPollTimestamp = 0;

  constructor(
    player: YT.Player,
    onSecondTick: (second: number) => void
  ) {
    this.player = player;
    this.onSecondTick = onSecondTick;
  }

  start() {
    this.lastPollTimestamp = Date.now();
    this.lastKnownTime = this.player.getCurrentTime();

    this.intervalId = setInterval(() => {
      const state = this.player.getPlayerState();
      if (state !== YT.PlayerState.PLAYING) return;

      const currentTime = this.player.getCurrentTime();
      const now = Date.now();
      const elapsed = (now - this.lastPollTimestamp) / 1000;

      // Seek detection: if time jumped more than 1.5s from expected, revert
      const expectedTime = this.lastKnownTime + elapsed;
      if (Math.abs(currentTime - expectedTime) > 1.5) {
        this.player.seekTo(this.lastKnownTime + elapsed, true);
        this.lastPollTimestamp = now;
        return;
      }

      this.lastKnownTime = currentTime;
      this.lastPollTimestamp = now;

      const currentSecond = Math.floor(currentTime);
      if (currentSecond !== this.lastRecordedSecond) {
        this.lastRecordedSecond = currentSecond;
        this.onSecondTick(currentSecond);
      }
    }, 250);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
