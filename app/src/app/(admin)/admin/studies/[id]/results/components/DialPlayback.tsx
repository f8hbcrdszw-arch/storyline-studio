"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DialAggregation {
  second: number;
  mean: number;
  median: number;
  n: number;
}

interface SegmentLine {
  label: string;
  color: string;
  data: DialAggregation[];
  n: number;
}

interface DialPlaybackProps {
  questionId: string;
  mediaItem: { source: string; youtubeId: string | null; url: string | null };
  dialData: DialAggregation[];
  lightbulbs: Record<number, number>;
  segments?: SegmentLine[];
}

// ─── YouTube API loader (singleton) ─────────────────────────────────────────

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
    if (window.YT?.Player) {
      ytApiLoaded = true;
      resolve();
      return;
    }
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

// ─── Color helpers (match survey dial gradient) ─────────────────────────────

function lerpColor(a: number[], b: number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function dialColor(val: number): string {
  if (val <= 25) return lerpColor([239, 68, 68], [249, 115, 22], val / 25);
  if (val <= 50) return lerpColor([249, 115, 22], [234, 179, 8], (val - 25) / 25);
  if (val <= 75) return lerpColor([234, 179, 8], [132, 204, 22], (val - 50) / 25);
  return lerpColor([132, 204, 22], [34, 197, 94], (val - 75) / 25);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DialPlayback({
  questionId,
  mediaItem,
  dialData,
  lightbulbs,
  segments,
}: DialPlaybackProps) {
  const isCompareMode = segments && segments.length > 1;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<YT.Player | null>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  const isYouTube = mediaItem.source === "YOUTUBE" && !!mediaItem.youtubeId;
  const isUpload = mediaItem.source === "UPLOAD";
  const maxSecond = dialData.length > 0 ? dialData[dialData.length - 1].second : 0;

  // ─── Fetch signed URL for uploaded media ────────────────────────────────

  useEffect(() => {
    if (!isUpload) return;
    fetch(`/api/admin-media/${questionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.signedUrl) setMediaUrl(data.signedUrl);
      })
      .catch(() => {});
  }, [isUpload, questionId]);

  // ─── Initialize YouTube player ──────────────────────────────────────────

  useEffect(() => {
    if (!isYouTube || !mediaItem.youtubeId) return;
    let destroyed = false;

    loadYouTubeApi().then(() => {
      if (destroyed || !ytContainerRef.current) return;

      const el = document.createElement("div");
      el.id = `yt-playback-${questionId}`;
      ytContainerRef.current.appendChild(el);

      ytPlayerRef.current = new YT.Player(el.id, {
        width: "100%",
        height: "100%",
        videoId: mediaItem.youtubeId!,
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
            if (destroyed) return;
            setReady(true);
            setDuration(ytPlayerRef.current?.getDuration() ?? 0);
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (destroyed) return;
            if (event.data === YT.PlayerState.PLAYING) {
              setPlaying(true);
            } else if (event.data === YT.PlayerState.PAUSED) {
              setPlaying(false);
            } else if (event.data === YT.PlayerState.ENDED) {
              setPlaying(false);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    };
  }, [isYouTube, mediaItem.youtubeId, questionId]);

  // ─── HTML5 video ready ──────────────────────────────────────────────────

  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setReady(true);
    setDuration(video.duration);
  }, []);

  // ─── Animation loop: sync time + draw overlay ──────────────────────────

  useEffect(() => {
    const tick = () => {
      // Get current time from the active player
      let time = 0;
      if (isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
        time = ytPlayerRef.current.getCurrentTime() ?? 0;
      } else if (videoRef.current) {
        time = videoRef.current.currentTime;
      }
      setCurrentTime(time);
      drawOverlay(time);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYouTube, dialData, lightbulbs, maxSecond, duration, segments]);

  // ─── Canvas overlay drawing ─────────────────────────────────────────────

  const drawOverlay = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      // Resize canvas if needed
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (dialData.length === 0) return;

      // Chart zone layout: bottom ~30% of video, split into dial + lightbulb row
      const hasLightbulbs = Object.keys(lightbulbs).length > 0;
      const totalZoneH = h * 0.30;
      const lbRowH = hasLightbulbs ? totalZoneH * 0.16 : 0;
      const dialH = totalZoneH - lbRowH;
      const chartTop = h - totalZoneH;
      const lbRowTop = chartTop + dialH;
      const chartW = w;
      const videoDuration = duration || maxSecond + 1;

      // Semi-transparent background strip
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, chartTop, w, totalZoneH);

      // Scale helpers
      const xScale = (sec: number) => (sec / videoDuration) * chartW;
      const yScale = (val: number) => chartTop + dialH - (val / 100) * dialH;

      // 50-line reference
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, yScale(50));
      ctx.lineTo(w, yScale(50));
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      for (const val of [0, 50, 100]) {
        ctx.fillText(String(val), w - 4, yScale(val) + 3);
      }

      if (isCompareMode) {
        // ── Compare mode: draw multiple segment lines ──────────
        // Draw "All" first (dimmed, dashed), then named segments on top
        const sortedSegments = [...segments].sort((a, b) =>
          a.label === "All" ? -1 : b.label === "All" ? 1 : 0
        );

        for (const seg of sortedSegments) {
          const visible = seg.data.filter((d) => d.second <= time);
          if (visible.length < 2) continue;

          const isAll = seg.label === "All";
          ctx.strokeStyle = seg.color;
          ctx.lineWidth = isAll ? 1.5 : 2.5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.globalAlpha = isAll ? 0.35 : 1;

          if (isAll) {
            ctx.setLineDash([6, 3]);
          } else {
            ctx.setLineDash([]);
          }

          ctx.beginPath();
          for (let i = 0; i < visible.length; i++) {
            const x = xScale(visible[i].second);
            const y = yScale(visible[i].mean);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          // Head dot for non-All segments
          if (!isAll) {
            const last = visible[visible.length - 1];
            const lx = xScale(last.second);
            const ly = yScale(last.mean);
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(lx, ly, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = seg.color;
            ctx.beginPath();
            ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Legend at top of overlay zone
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "left";
        let legendX = 6;
        for (const seg of sortedSegments) {
          if (seg.label === "All") continue;
          ctx.fillStyle = seg.color;
          ctx.beginPath();
          ctx.arc(legendX + 4, chartTop + 10, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fillText(seg.label, legendX + 10, chartTop + 14);
          legendX += ctx.measureText(seg.label).width + 20;
        }

        // Current values for each segment (right-aligned column)
        ctx.textAlign = "right";
        let valueY = chartTop + 14;
        for (const seg of sortedSegments) {
          if (seg.label === "All") continue;
          const visible = seg.data.filter((d) => d.second <= time);
          if (visible.length === 0) continue;
          const last = visible[visible.length - 1];
          ctx.fillStyle = seg.color;
          ctx.font = "bold 10px system-ui, sans-serif";
          ctx.fillText(`${seg.label}: ${Math.round(last.mean)}`, w - 6, valueY);
          valueY += 14;
        }
      } else {
        // ── Single mode: original drawing code ─────────────────
        const visibleData = dialData.filter((d) => d.second <= time);
        if (visibleData.length < 2) {
          if (visibleData.length === 1) {
            const d = visibleData[0];
            ctx.fillStyle = dialColor(d.mean);
            ctx.beginPath();
            ctx.arc(xScale(d.second), yScale(d.mean), 4, 0, Math.PI * 2);
            ctx.fill();
          }
          // Still draw lightbulb row even with no dial data
        } else {
          // Gradient fill under line
          for (let i = 0; i < visibleData.length - 1; i++) {
            const d0 = visibleData[i];
            const d1 = visibleData[i + 1];
            const x0 = xScale(d0.second);
            const x1 = xScale(d1.second);
            const y0 = yScale(d0.mean);
            const y1 = yScale(d1.mean);
            const avgVal = (d0.mean + d1.mean) / 2;

            // Fill area
            ctx.fillStyle = dialColor(avgVal).replace("rgb", "rgba").replace(")", ", 0.15)");
            ctx.beginPath();
            ctx.moveTo(x0, yScale(0));
            ctx.lineTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x1, yScale(0));
            ctx.closePath();
            ctx.fill();

            // Line segment
            ctx.strokeStyle = dialColor(avgVal);
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }

          // Current value dot (head of line)
          const last = visibleData[visibleData.length - 1];
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(xScale(last.second), yScale(last.mean), 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = dialColor(last.mean);
          ctx.beginPath();
          ctx.arc(xScale(last.second), yScale(last.mean), 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Current value label
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.textAlign = "center";
          const labelY = yScale(last.mean) - 10;
          ctx.fillText(String(Math.round(last.mean)), xScale(last.second), labelY < chartTop + 12 ? yScale(last.mean) + 16 : labelY);
        }
      }

      // ── Lightbulb / Moments row ──────────────────────────
      if (hasLightbulbs) {
        // Separator line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, lbRowTop);
        ctx.lineTo(w, lbRowTop);
        ctx.stroke();

        // Row label
        ctx.fillStyle = "rgba(250, 204, 21, 0.6)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("💡", w - 4, lbRowTop + lbRowH * 0.6);

        // Markers up to current time
        const lightbulbEntries = Object.entries(lightbulbs)
          .map(([sec, count]) => ({ second: Number(sec), count }))
          .filter((l) => l.second <= time);

        for (const l of lightbulbEntries) {
          const x = xScale(l.second);
          const dotY = lbRowTop + 5;
          const tickBottom = lbRowTop + lbRowH - 2;

          // Vertical tick
          ctx.strokeStyle = "rgba(250, 204, 21, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, dotY);
          ctx.lineTo(x, tickBottom);
          ctx.stroke();

          // Dot at top
          const r = Math.min(2.5 + l.count * 0.5, 5);
          ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
          ctx.beginPath();
          ctx.arc(x, dotY, r, 0, Math.PI * 2);
          ctx.fill();

          // Count label if > 1
          if (l.count > 1) {
            ctx.fillStyle = "rgba(250, 204, 21, 0.7)";
            ctx.font = "7px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(l.count), x, tickBottom + 1);
          }
        }
      }

      // Playback position indicator line (vertical, spans full zone)
      const px = xScale(time);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, chartTop);
      ctx.lineTo(px, chartTop + totalZoneH);
      ctx.stroke();
    },
    [dialData, lightbulbs, maxSecond, duration, isCompareMode, segments]
  );

  // ─── Playback controls ──────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (isYouTube) {
      const player = ytPlayerRef.current;
      if (!player) return;
      const state = player.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    } else {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play();
        setPlaying(true);
      } else {
        video.pause();
        setPlaying(false);
      }
    }
  }, [isYouTube]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const seekTime = parseFloat(e.target.value);
      setCurrentTime(seekTime);
      if (isYouTube) {
        ytPlayerRef.current?.seekTo(seekTime, true);
      } else if (videoRef.current) {
        videoRef.current.currentTime = seekTime;
      }
    },
    [isYouTube]
  );

  // ─── Video export (HTML5 only) ──────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    const video = videoRef.current;
    const overlayCanvas = canvasRef.current;
    if (!video || !overlayCanvas || recording) return;

    setRecording(true);
    setRecordingProgress(0);

    // Create recording canvas at video resolution
    const recCanvas = document.createElement("canvas");
    recCanvas.width = video.videoWidth || 1280;
    recCanvas.height = video.videoHeight || 720;
    const recCtx = recCanvas.getContext("2d")!;

    const stream = recCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp9",
      videoBitsPerSecond: 5_000_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dial-overlay-${questionId}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setRecording(false);
      setRecordingProgress(0);
    };

    // Seek to start and play
    video.currentTime = 0;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    recorder.start();
    video.play();
    setPlaying(true);

    // Composite frames
    const drawFrame = () => {
      if (video.ended || video.paused) {
        recorder.stop();
        setPlaying(false);
        return;
      }

      recCtx.drawImage(video, 0, 0, recCanvas.width, recCanvas.height);

      // Draw overlay scaled to recording canvas
      recCtx.drawImage(overlayCanvas, 0, 0, recCanvas.width, recCanvas.height);

      setRecordingProgress(video.duration > 0 ? video.currentTime / video.duration : 0);
      requestAnimationFrame(drawFrame);
    };

    requestAnimationFrame(drawFrame);
  }, [recording, questionId]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!isYouTube && !isUpload) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Video Playback with Dial Overlay</p>

      {/* Video + canvas overlay container */}
      <div
        ref={containerRef}
        className="relative w-full bg-black rounded-lg overflow-hidden aspect-video"
      >
        {/* Video layer */}
        {isYouTube ? (
          <div
            ref={ytContainerRef}
            className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full"
          />
        ) : mediaUrl ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            onLoadedMetadata={handleVideoLoaded}
            onEnded={() => setPlaying(false)}
            className="absolute inset-0 w-full h-full object-contain"
            playsInline
            crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ pointerEvents: "none" }}
        />

        {/* Click-to-play overlay when not started */}
        {ready && !playing && currentTime === 0 && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/20"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-foreground ml-1">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* Custom playback controls */}
      <div className="flex items-center gap-3 px-1">
        <button
          onClick={togglePlay}
          disabled={!ready}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/80 disabled:opacity-50 transition-colors"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="3.5" height="10" rx="0.5" />
              <rect x="7.5" y="1" width="3.5" height="10" rx="0.5" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="ml-0.5">
              <polygon points="2,0 12,6 2,12" />
            </svg>
          )}
        </button>

        <span className="text-xs text-muted-foreground font-mono w-12 text-right">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1.5 accent-primary cursor-pointer"
        />

        <span className="text-xs text-muted-foreground font-mono w-12">
          {formatTime(duration)}
        </span>

        {/* Download button — HTML5 only */}
        {isUpload && (
          <button
            onClick={handleDownload}
            disabled={!ready || recording}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="Download video with dial overlay"
          >
            {recording ? `${Math.round(recordingProgress * 100)}%` : "Export"}
          </button>
        )}
        {isYouTube && (
          <span className="relative group">
            <span className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted/50 text-muted-foreground cursor-help">
              Export N/A
            </span>
            <span className="absolute bottom-full right-0 mb-2 w-56 rounded-md bg-foreground text-background text-[11px] leading-snug p-2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
              Export is only available for uploaded videos. YouTube videos can&apos;t be exported due to browser restrictions.
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
