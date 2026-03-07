"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const TRANSITIONS: Record<string, { label: string; variant: "default" | "outline" | "destructive"; confirm?: string }[]> = {
  DRAFT: [
    { label: "Publish Study", variant: "default" },
  ],
  ACTIVE: [
    { label: "Pause", variant: "outline" },
    { label: "Close", variant: "destructive", confirm: "Close this study? No new responses will be accepted." },
  ],
  PAUSED: [
    { label: "Resume", variant: "default" },
    { label: "Close", variant: "destructive", confirm: "Close this study? No new responses will be accepted." },
  ],
  CLOSED: [
    { label: "Archive", variant: "outline", confirm: "Archive this study?" },
  ],
  ARCHIVED: [],
};

const STATUS_MAP: Record<string, string> = {
  "Publish Study": "ACTIVE",
  Pause: "PAUSED",
  Resume: "ACTIVE",
  Close: "CLOSED",
  Archive: "ARCHIVED",
};

export function StudyActions({
  studyId,
  status,
  slug,
  questionCount,
  responseCount,
}: {
  studyId: string;
  status: string;
  slug: string | null;
  questionCount: number;
  responseCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [surveyUrl, setSurveyUrl] = useState(
    slug ? `${window.location.origin}/survey/${slug}` : ""
  );
  const [copied, setCopied] = useState(false);

  const actions = TRANSITIONS[status] || [];

  const handleAction = async (label: string) => {
    if (label === "Publish Study") {
      await handlePublish();
      return;
    }

    const targetStatus = STATUS_MAP[label];
    if (!targetStatus) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/studies/${studyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (questionCount === 0) {
      setError("Add at least one question before publishing.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/studies/${studyId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to publish");
      }

      const data = await res.json();
      setSurveyUrl(data.surveyUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/studies/${studyId}/duplicate`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to duplicate");
      }

      const data = await res.json();
      router.push(`/admin/studies/${data.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (actions.length === 0 && !surveyUrl) return null;

  return (
    <div className="mb-6 rounded-lg border border-border p-4 space-y-3">
      {/* Survey link */}
      {surveyUrl && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground shrink-0">
            Survey Link
          </label>
          <input
            type="text"
            readOnly
            value={surveyUrl}
            className="flex-1 rounded-md border border-input bg-muted px-3 py-1.5 text-sm text-foreground"
          />
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              size="sm"
              disabled={loading}
              onClick={() => {
                if (action.confirm && !confirm(action.confirm)) return;
                handleAction(action.label);
              }}
            >
              {loading ? "..." : action.label}
            </Button>
          ))}

          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleDuplicate}
          >
            Duplicate
          </Button>

          {status !== "DRAFT" && (
            <span className="text-xs text-muted-foreground ml-auto">
              {responseCount} responses collected
            </span>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
