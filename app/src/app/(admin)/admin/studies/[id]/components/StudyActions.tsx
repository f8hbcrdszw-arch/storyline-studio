"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Copy, Check } from "lucide-react";

const CONFETTI_COLORS = ["#121C8A", "#F4F3EF", "#100C21", "#6366f1", "#818cf8"];

function fireConfetti() {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  // Inject keyframes once
  if (!document.getElementById("confetti-style")) {
    const style = document.createElement("style");
    style.id = "confetti-style";
    style.textContent = `
      @keyframes confetti-fall {
        0% { opacity:1; transform:translateY(0) translateX(0) rotate(0deg); }
        25% { opacity:1; }
        100% { opacity:0; transform:translateY(var(--dy)) translateX(var(--dx)) rotate(var(--r)); }
      }
    `;
    document.head.appendChild(style);
  }

  // Pieces fall from top like real confetti
  for (let i = 0; i < 120; i++) {
    const piece = document.createElement("div");
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left = Math.random() * 100;
    const size = 8 + Math.random() * 8;
    const xDrift = (Math.random() - 0.5) * 200;
    const fallDistance = 600 + Math.random() * 400;
    const duration = 1700 + Math.random() * 1125;
    const delay = Math.random() * 340;
    const spin = 360 + Math.random() * 720;

    piece.style.cssText = `
      position:absolute;left:${left}%;top:-20px;
      width:${size}px;height:${size * (0.4 + Math.random() * 0.5)}px;
      background:${color};border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      animation:confetti-fall ${duration}ms ${delay}ms ease-in forwards;
      --dy:${fallDistance}px;--dx:${xDrift}px;--r:${spin}deg;
    `;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 3400);
}

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
    { label: "Reopen", variant: "default", confirm: "Reopen this study? It will start accepting responses again." },
    { label: "Archive", variant: "outline", confirm: "Archive this study?" },
  ],
  ARCHIVED: [],
};

const STATUS_MAP: Record<string, string> = {
  "Publish Study": "ACTIVE",
  Pause: "PAUSED",
  Resume: "ACTIVE",
  Reopen: "ACTIVE",
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [surveyUrl, setSurveyUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (slug) {
      setSurveyUrl(`${window.location.origin}/survey/${slug}`);
    }
  }, [slug]);

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
      setJustPublished(true);
      toast("Your study is live!", "success");
      // Fire confetti, then refresh after animation completes
      try { fireConfetti(); } catch (e) { console.error("Confetti error:", e); }
      setTimeout(() => router.refresh(), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish";
      console.error("Publish error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    toast("Link copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const hasControls = actions.length > 0;
  const hasShare = !!surveyUrl;

  if (!hasControls && !hasShare) return null;

  return (
    <>
      {/* Controls toolbar */}
      {hasControls && (
        <div className="toolbar-row">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              size="sm"
              disabled={loading}
              className={action.label === "Publish Study" ? "shadow-sm shadow-primary/25 hover:shadow-md hover:shadow-primary/30" : ""}
              onClick={() => {
                if (action.confirm) {
                  setConfirmAction({
                    label: action.label,
                    message: action.confirm,
                  });
                } else {
                  handleAction(action.label);
                }
              }}
            >
              {loading ? "..." : action.label}
            </Button>
          ))}
          {error && <span className="text-xs text-destructive ml-2">{error}</span>}
        </div>
      )}

      {/* Share toolbar */}
      {hasShare && (
        <div className={`toolbar-row ${justPublished ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}>
          <span className="section-label shrink-0">Survey Link</span>
          <code className="flex-1 text-sm text-foreground truncate select-all">
            {surveyUrl}
          </code>
          <button
            onClick={copyLink}
            className={`shrink-0 p-1.5 rounded-md relative transition-all duration-200 ${
              copied
                ? "text-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <span className={`transition-all duration-200 ${copied ? "opacity-0 scale-75" : "opacity-100 scale-100"}`}>
              <Copy className="w-4 h-4" />
            </span>
            <span className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${copied ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
              <Check className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.label || ""}
        description={confirmAction?.message || ""}
        confirmLabel={confirmAction?.label || "Confirm"}
        confirmVariant={
          confirmAction?.label === "Close" || confirmAction?.label === "Archive"
            ? "destructive"
            : "default"
        }
        onConfirm={() => {
          if (confirmAction) handleAction(confirmAction.label);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
