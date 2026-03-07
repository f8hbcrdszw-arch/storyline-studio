"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Html5VideoPlayer, type VideoPlayerHandle } from "./Html5VideoPlayer";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";
import { DialSlider } from "./DialSlider";
import { LightbulbButton } from "./LightbulbButton";
import type { SurveyQuestion } from "../SurveyShell";

interface VideoDialProps {
  question: SurveyQuestion;
  onSubmit: (value: unknown) => void;
  loading: boolean;
}

type VideoSource =
  | { type: "html5"; url: string }
  | { type: "youtube"; videoId: string };

export function VideoDial({ question, onSubmit, loading }: VideoDialProps) {
  const playerRef = useRef<VideoPlayerHandle>(null);

  // State
  const [dialValue, setDialValue] = useState(50);
  const [feedback, setFeedback] = useState<Record<number, number>>({});
  const [lightbulbs, setLightbulbs] = useState<number[]>([]);
  const [actions, setActions] = useState<Record<string, number[]>>({});
  const [sliderInteracted, setSliderInteracted] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [annotation, setAnnotation] = useState("");
  const [error, setError] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const dialValueRef = useRef(dialValue);
  const lastInteractionRef = useRef(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync so time-update callback always reads latest dial value
  useEffect(() => {
    dialValueRef.current = dialValue;
  }, [dialValue]);

  // Determine video source
  const config = question.config as Record<string, unknown>;
  const mode = (config.mode as string) || "intensity";
  const actionButtons =
    (config.actionButtons as { id: string; label: string }[]) || [];

  const mediaItem = question.mediaItems?.[0];

  const videoSource: VideoSource | null = mediaItem
    ? mediaItem.source === "YOUTUBE" && mediaItem.youtubeId
      ? { type: "youtube", videoId: mediaItem.youtubeId }
      : mediaItem.source === "UPLOAD"
        ? { type: "html5", url: "" } // URL fetched via media proxy
        : null
    : null;

  // Fetch signed URL for uploaded media
  useEffect(() => {
    if (videoSource?.type === "html5" && mediaItem) {
      fetch(`/api/media/${question.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.signedUrl) setMediaUrl(data.signedUrl);
          else setError("Could not load video");
        })
        .catch(() => setError("Could not load video"));
    }
  }, [videoSource?.type, mediaItem, question.id]);

  // Per-second capture — uses ref so callback identity stays stable
  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (isBuffering) return;
      const second = Math.floor(time);
      setFeedback((prev) => {
        if (prev[second] !== undefined) return prev;
        return { ...prev, [second]: dialValueRef.current };
      });
    },
    [isBuffering]
  );

  // Inactivity warning (3 seconds without slider interaction)
  useEffect(() => {
    if (!videoStarted || videoEnded) return;

    inactivityTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed > 3000 && sliderInteracted) {
        setInactivityWarning(true);
      } else {
        setInactivityWarning(false);
      }
    }, 1000);

    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [videoStarted, videoEnded, sliderInteracted]);

  const handleSliderChange = useCallback((value: number) => {
    setDialValue(value);
    lastInteractionRef.current = Date.now();
    setInactivityWarning(false);
  }, []);

  const handleSliderInteract = useCallback(() => {
    setSliderInteracted(true);
    lastInteractionRef.current = Date.now();
    setInactivityWarning(false);
  }, []);

  const handleLightbulb = useCallback(() => {
    const time = playerRef.current?.getCurrentTime() ?? 0;
    setLightbulbs((prev) => [...prev, Math.floor(time)]);
  }, []);

  const handleAction = useCallback((actionId: string) => {
    const time = playerRef.current?.getCurrentTime() ?? 0;
    setActions((prev) => ({
      ...prev,
      [actionId]: [...(prev[actionId] || []), Math.floor(time)],
    }));
  }, []);

  const handleVideoPlay = useCallback(() => {
    setVideoStarted(true);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setVideoEnded(true);
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit({
      feedback,
      lightbulbs,
      actions: Object.keys(actions).length > 0 ? actions : undefined,
      annotations: annotation ? [annotation] : undefined,
      sliderInteracted,
    });
  }, [feedback, lightbulbs, actions, annotation, sliderInteracted, onSubmit]);

  if (!videoSource) {
    return (
      <div className="rounded-lg border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No video has been configured for this question.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 p-6 text-center space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError("");
            setMediaUrl(null);
            // Re-trigger URL fetch
            if (videoSource.type === "html5" && mediaItem) {
              fetch(`/api/media/${question.id}`)
                .then((res) => res.json())
                .then((data) => {
                  if (data.signedUrl) setMediaUrl(data.signedUrl);
                  else setError("Could not load video");
                })
                .catch(() => setError("Could not load video"));
            }
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video player */}
      {videoSource.type === "youtube" ? (
        <YouTubeVideoPlayer
          ref={playerRef}
          videoId={videoSource.videoId}
          onPlay={handleVideoPlay}
          onEnded={handleVideoEnded}
          onTimeUpdate={handleTimeUpdate}
          onBuffering={setIsBuffering}
          onError={setError}
        />
      ) : mediaUrl ? (
        <Html5VideoPlayer
          ref={playerRef}
          src={mediaUrl}
          onPlay={handleVideoPlay}
          onEnded={handleVideoEnded}
          onTimeUpdate={handleTimeUpdate}
          onBuffering={setIsBuffering}
          onError={setError}
        />
      ) : (
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Buffering indicator */}
      {isBuffering && videoStarted && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Buffering...</p>
        </div>
      )}

      {/* Inactivity warning */}
      {inactivityWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center animate-pulse">
          <p className="text-xs text-yellow-700 font-medium">
            Keep adjusting the slider as you watch!
          </p>
        </div>
      )}

      {/* Dial slider — always visible once video starts */}
      {videoStarted && !videoEnded && (
        <div className="px-2">
          <DialSlider
            value={dialValue}
            onChange={handleSliderChange}
            onInteract={handleSliderInteract}
            mode={mode as "intensity" | "sentiment"}
            disabled={isBuffering}
          />
        </div>
      )}

      {/* Action buttons row */}
      {videoStarted && !videoEnded && (
        <div className="flex items-center justify-center gap-3">
          <LightbulbButton
            onTap={handleLightbulb}
            disabled={isBuffering}
          />
          {actionButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleAction(btn.id)}
              disabled={isBuffering}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors min-h-[44px] disabled:opacity-50"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Post-video annotation + submit */}
      {videoEnded && (
        <div className="space-y-3">
          {config.showAnnotation !== false && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                {(config.annotationPrompt as string) || "Any additional thoughts? (optional)"}
              </label>
              <textarea
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder={(config.annotationPlaceholder as string) || "Share your thoughts about the video..."}
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting..." : "Next"}
            </Button>
          </div>
        </div>
      )}

      {/* Stats (debug info, hidden in production) */}
      {videoStarted && (
        <div className="text-[10px] text-muted-foreground/50 text-center">
          {Object.keys(feedback).length}s captured
          {lightbulbs.length > 0 && ` | ${lightbulbs.length} lightbulbs`}
        </div>
      )}
    </div>
  );
}
