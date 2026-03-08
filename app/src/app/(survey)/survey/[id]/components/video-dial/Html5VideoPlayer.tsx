"use client";

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";

export interface VideoPlayerHandle {
  play: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface Html5VideoPlayerProps {
  src: string;
  onPlay: () => void;
  onEnded: () => void;
  onTimeUpdate: (time: number) => void;
  onBuffering: (isBuffering: boolean) => void;
  onError: (error: string) => void;
}

// Keys that could seek or control the video — block them on the video element
const BLOCKED_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  " ",        // Space (play/pause)
  "Home",
  "End",
  "j",        // YouTube-style seek back
  "l",        // YouTube-style seek forward
  "k",        // YouTube-style play/pause
  "m",        // mute toggle
  "f",        // fullscreen
]);

export const Html5VideoPlayer = forwardRef<VideoPlayerHandle, Html5VideoPlayerProps>(
  function Html5VideoPlayer({ src, onPlay, onEnded, onTimeUpdate, onBuffering, onError }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [showOverlay, setShowOverlay] = useState(true);
    // Track the last known legitimate time for seek protection
    const lastTimeRef = useRef(0);

    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => videoRef.current?.duration ?? 0,
    }));

    const handlePlay = useCallback(() => {
      setShowOverlay(false);
      onPlay();
    }, [onPlay]);

    const handleClickOverlay = useCallback(() => {
      videoRef.current?.play();
    }, []);

    // Block keyboard seeks on the video element
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLVideoElement>) => {
      if (BLOCKED_KEYS.has(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, []);

    // Monitor buffered ranges
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onWaiting = () => onBuffering(true);
      const onPlaying = () => onBuffering(false);
      const onVideoError = () => {
        const err = video.error;
        onError(err?.message || "Video playback error");
      };

      video.addEventListener("waiting", onWaiting);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("error", onVideoError);

      return () => {
        video.removeEventListener("waiting", onWaiting);
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("error", onVideoError);
      };
    }, [onBuffering, onError]);

    // Seek protection: detect time jumps and snap back
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleSeeking = () => {
        // Allow seeks near the end (video.ended triggers a small seek)
        if (video.ended) return;

        const delta = Math.abs(video.currentTime - lastTimeRef.current);
        // If the jump is > 1.5s, it's likely a manual seek — snap back
        if (delta > 1.5 && lastTimeRef.current > 0) {
          video.currentTime = lastTimeRef.current;
        }
      };

      video.addEventListener("seeking", handleSeeking);
      return () => video.removeEventListener("seeking", handleSeeking);
    }, []);

    // Time update via RVFC or RAF
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let rvfcId: number | null = null;
      let rafId: number | null = null;

      if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
        const tick = (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
          lastTimeRef.current = metadata.mediaTime;
          onTimeUpdate(metadata.mediaTime);
          rvfcId = video.requestVideoFrameCallback(tick);
        };
        rvfcId = video.requestVideoFrameCallback(tick);
      } else {
        const tick = () => {
          if (!video.paused && !video.ended) {
            lastTimeRef.current = video.currentTime;
            onTimeUpdate(video.currentTime);
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      }

      return () => {
        if (rvfcId !== null) video.cancelVideoFrameCallback(rvfcId);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }, [onTimeUpdate]);

    return (
      <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-video">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          preload="auto"
          playsInline
          onPlay={handlePlay}
          onEnded={onEnded}
          onKeyDown={handleKeyDown}
          className="w-full h-full object-contain"
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          // Prevent right-click context menu
          onContextMenu={(e) => e.preventDefault()}
          // Remove from tab order so keyboard users interact with the dial, not the video
          tabIndex={-1}
        />

        {/* Click-to-play overlay */}
        {showOverlay && (
          <button
            onClick={handleClickOverlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity hover:bg-black/30"
            aria-label="Play video"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-foreground ml-1"
                aria-hidden="true"
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </button>
        )}
      </div>
    );
  }
);
