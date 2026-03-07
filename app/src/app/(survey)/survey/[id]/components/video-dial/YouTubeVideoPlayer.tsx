"use client";

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import type { VideoPlayerHandle } from "./Html5VideoPlayer";

interface YouTubeVideoPlayerProps {
  videoId: string;
  onPlay: () => void;
  onEnded: () => void;
  onTimeUpdate: (time: number) => void;
  onBuffering: (isBuffering: boolean) => void;
  onError: (error: string) => void;
}

// Extend window for YouTube IFrame API
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: typeof YT;
  }
}

let ytApiLoaded = false;
let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (ytApiLoaded) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      existingCallback?.();
      resolve();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });

  return ytApiPromise;
}

export const YouTubeVideoPlayer = forwardRef<VideoPlayerHandle, YouTubeVideoPlayerProps>(
  function YouTubeVideoPlayer(
    { videoId, onPlay, onEnded, onTimeUpdate, onBuffering, onError },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const seekGuardRef = useRef({ lastKnownTime: 0, lastPollTs: 0 });
    const [showOverlay, setShowOverlay] = useState(true);
    const [ready, setReady] = useState(false);

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo(),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getDuration: () => playerRef.current?.getDuration() ?? 0,
    }));

    // Initialize YouTube player
    useEffect(() => {
      let destroyed = false;

      loadYouTubeApi().then(() => {
        if (destroyed || !containerRef.current) return;

        // Create a child div for YouTube to replace
        const el = document.createElement("div");
        el.id = `yt-player-${videoId}`;
        containerRef.current.appendChild(el);

        playerRef.current = new YT.Player(el.id, {
          videoId,
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            enablejsapi: 1,
            autoplay: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (!destroyed) setReady(true);
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (destroyed) return;

              switch (event.data) {
                case YT.PlayerState.PLAYING:
                  setShowOverlay(false);
                  onPlay();
                  onBuffering(false);
                  // Reset seek guard baseline after buffering
                  seekGuardRef.current.lastKnownTime =
                    playerRef.current?.getCurrentTime() ?? 0;
                  seekGuardRef.current.lastPollTs = Date.now();
                  startPolling();
                  break;
                case YT.PlayerState.BUFFERING:
                  onBuffering(true);
                  break;
                case YT.PlayerState.ENDED:
                  stopPolling();
                  onEnded();
                  break;
                case YT.PlayerState.PAUSED:
                  // Force resume — respondents shouldn't be able to pause
                  playerRef.current?.playVideo();
                  break;
              }
            },
            onError: (event: YT.OnErrorEvent) => {
              onError(`YouTube error: ${event.data}`);
            },
          },
        });
      });

      return () => {
        destroyed = true;
        stopPolling();
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    const startPolling = useCallback(() => {
      if (pollRef.current) return;

      pollRef.current = setInterval(() => {
        const player = playerRef.current;
        if (!player || player.getPlayerState() !== YT.PlayerState.PLAYING) return;

        const currentTime = player.getCurrentTime();
        const now = Date.now();
        const elapsed = (now - seekGuardRef.current.lastPollTs) / 1000;
        const expectedTime = seekGuardRef.current.lastKnownTime + elapsed;

        // Seek detection
        if (Math.abs(currentTime - expectedTime) > 1.5) {
          player.seekTo(seekGuardRef.current.lastKnownTime + elapsed, true);
          seekGuardRef.current.lastPollTs = now;
          return;
        }

        seekGuardRef.current.lastKnownTime = currentTime;
        seekGuardRef.current.lastPollTs = now;
        onTimeUpdate(currentTime);
      }, 250);
    }, [onTimeUpdate]);

    const stopPolling = useCallback(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, []);

    const handleClickOverlay = useCallback(() => {
      if (ready) {
        playerRef.current?.playVideo();
      }
    }, [ready]);

    return (
      <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-video">
        {/* YouTube player container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Transparent overlay to prevent tap-to-pause */}
        {!showOverlay && (
          <div className="absolute inset-0" style={{ pointerEvents: "auto" }} />
        )}

        {/* Click-to-play overlay */}
        {showOverlay && (
          <button
            onClick={handleClickOverlay}
            disabled={!ready}
            className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity hover:bg-black/30"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              {ready ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-foreground ml-1"
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              ) : (
                <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </button>
        )}
      </div>
    );
  }
);
