"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { parseYouTubeId, getYouTubeThumbnail } from "@/lib/youtube";
import type { MediaItemData } from "./StudyEditor";

export function MediaUploader({
  questionId,
  mediaItems,
  onMediaAdded,
  onMediaRemoved,
  maxItems,
}: {
  questionId: string;
  mediaItems: MediaItemData[];
  onMediaAdded: (item: MediaItemData) => void;
  onMediaRemoved: (id: string) => void;
  maxItems?: number;
}) {
  const atLimit = maxItems !== undefined && mediaItems.length >= maxItems;
  const [mode, setMode] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const handleDelete = useCallback(
    async (id: string) => {
      setConfirmDeleteId(null);
      setDeleting(id);
      try {
        const res = await fetch(`/api/media-items/${id}`, { method: "DELETE" });
        if (res.ok) {
          onMediaRemoved(id);
        } else {
          setError("Couldn't remove media. Please try again.");
        }
      } catch {
        setError("Couldn't remove media. Please try again.");
      } finally {
        setDeleting(null);
      }
    },
    [onMediaRemoved]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError("");
      setUploading(true);

      try {
        const mediaType = file.type.startsWith("video/") ? "video" : "image";

        // Step 1: Get presigned upload URL
        console.log("[upload] step 1: requesting presigned URL", { contentType: file.type, mediaType, filename: file.name });
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
          const data = await presignRes.json().catch(() => ({}));
          console.error("[upload] step 1 failed:", presignRes.status, data);
          throw new Error(data.error || "server");
        }

        const { uploadUrl, key } = await presignRes.json();
        console.log("[upload] step 1 ok, key:", key);

        // Step 2: Upload directly to R2
        console.log("[upload] step 2: uploading to R2", { size: file.size, type: file.type });
        let uploadRes: Response;
        try {
          uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
        } catch (e) {
          console.error("[upload] step 2 network error:", e);
          throw new Error("storage");
        }

        if (!uploadRes.ok) {
          console.error("[upload] step 2 failed:", uploadRes.status, await uploadRes.text().catch(() => ""));
          throw new Error("storage");
        }
        console.log("[upload] step 2 ok");

        // Step 3: Create media item record
        console.log("[upload] step 3: creating media item record");
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

        if (!mediaRes.ok) {
          console.error("[upload] step 3 failed:", mediaRes.status, await mediaRes.json().catch(() => ({})));
          throw new Error("server");
        }
        console.log("[upload] step 3 ok");

        const item = await mediaRes.json();
        onMediaAdded(item);
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        const message =
          code === "storage"
            ? "Upload failed — please try again or use a smaller file"
            : "Something went wrong. Please try again.";
        setError(message);
      } finally {
        setUploading(false);
        setFileInputKey((k) => k + 1);
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
      setError("Couldn't add video. Please check the URL and try again.");
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
              <button
                onClick={() => setConfirmDeleteId(item.id)}
                disabled={deleting === item.id}
                className="text-muted-foreground hover:text-destructive text-xs px-1.5 py-0.5 rounded hover:bg-destructive/10 disabled:opacity-50"
              >
                {deleting === item.id ? "..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload controls */}
      {atLimit ? (
        <p className="text-xs text-muted-foreground">
          {maxItems === 1 ? "Remove the current media to replace it." : `Maximum ${maxItems} media items.`}
        </p>
      ) : (
        <>
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
                key={fileInputKey}
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
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Remove media"
        description="This media will be permanently removed from the question."
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
