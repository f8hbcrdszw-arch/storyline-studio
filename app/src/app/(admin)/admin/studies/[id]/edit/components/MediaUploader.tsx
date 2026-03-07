"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { parseYouTubeId, getYouTubeThumbnail } from "@/lib/youtube";
import type { MediaItemData } from "./StudyEditor";

export function MediaUploader({
  questionId,
  mediaItems,
  onMediaAdded,
}: {
  questionId: string;
  mediaItems: MediaItemData[];
  onMediaAdded: (item: MediaItemData) => void;
}) {
  const [mode, setMode] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError("");
      setUploading(true);

      try {
        const mediaType = file.type.startsWith("video/") ? "video" : "image";

        // Get presigned upload URL
        const presignRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: file.type,
            mediaType,
            filename: file.name,
          }),
        });

        if (!presignRes.ok) {
          const data = await presignRes.json();
          throw new Error(data.error || "Failed to get upload URL");
        }

        const { uploadUrl, key } = await presignRes.json();

        // Upload directly to R2
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadRes.ok) {
          throw new Error("Upload failed");
        }

        // Create media item record
        const mediaRes = await fetch("/api/media-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            source: "UPLOAD",
            url: key,
            filename: file.name,
            type: mediaType.toUpperCase(),
          }),
        });

        if (mediaRes.ok) {
          const item = await mediaRes.json();
          onMediaAdded(item);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [questionId, onMediaAdded]
  );

  const handleYouTubeAdd = useCallback(async () => {
    setError("");
    const videoId = parseYouTubeId(youtubeUrl);

    if (!videoId) {
      setError("Invalid YouTube URL");
      return;
    }

    setUploading(true);

    try {
      const mediaRes = await fetch("/api/media-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          source: "YOUTUBE",
          youtubeId: videoId,
          type: "VIDEO",
          thumbnailUrl: getYouTubeThumbnail(videoId),
        }),
      });

      if (mediaRes.ok) {
        const item = await mediaRes.json();
        onMediaAdded(item);
        setYoutubeUrl("");
      }
    } catch {
      setError("Failed to add YouTube video");
    } finally {
      setUploading(false);
    }
  }, [questionId, youtubeUrl, onMediaAdded]);

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground block">
        Media
      </label>

      {/* Existing media items */}
      {mediaItems.length > 0 && (
        <div className="space-y-1">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded border border-border p-2"
            >
              {item.thumbnailUrl && (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="w-16 h-10 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {item.filename || item.youtubeId || "Media"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {item.source} · {item.type}
                  {item.durationSecs && ` · ${item.durationSecs}s`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload controls */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setMode("upload")}
          className={`px-2 py-1 text-xs rounded ${
            mode === "upload"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Upload File
        </button>
        <button
          onClick={() => setMode("youtube")}
          className={`px-2 py-1 text-xs rounded ${
            mode === "youtube"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          YouTube URL
        </button>
      </div>

      {mode === "upload" ? (
        <div>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            disabled={uploading}
            className="text-xs"
          />
          {uploading && (
            <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
          <Button
            size="sm"
            onClick={handleYouTubeAdd}
            disabled={uploading || !youtubeUrl}
          >
            Add
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
