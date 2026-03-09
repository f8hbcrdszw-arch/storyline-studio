"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { StatusDot } from "@/components/ui/status-dot";
import { ChevronRight, ChevronDown } from "lucide-react";

interface StudyItem {
  id: string;
  title: string;
  status: string;
  _count: { responses: number; questions: number };
}

type BatchAction = "archive" | "close" | "delete";

// Human-readable descriptions for chained actions
const CHAIN_DESCRIPTIONS: Record<string, string> = {
  archive_ACTIVE: "close and then archive",
  archive_PAUSED: "close and then archive",
  archive_DRAFT: "cannot archive draft studies",
};

export function StudyList({ studies }: { studies: StudyItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    label: string;
    variant: "default" | "destructive";
    onConfirm: () => void;
  } | null>(null);

  const activeStudies = studies.filter((s) => s.status !== "ARCHIVED");
  const archivedStudies = studies.filter((s) => s.status === "ARCHIVED");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    // Only toggle active studies (not archived)
    const activeIds = activeStudies.map((s) => s.id);
    if (activeIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeIds));
    }
  };

  const runBatch = async (action: BatchAction, force = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/studies/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action, force }),
      });

      if (!res.ok) {
        toast("Batch action failed", "error");
        return;
      }

      const { results } = await res.json() as {
        results: { id: string; success: boolean; error?: string }[];
      };

      // Check if any need intermediate steps
      const needsIntermediate = results.filter(
        (r) => r.error === "requires_intermediate"
      );

      if (needsIntermediate.length > 0 && !force) {
        // Figure out what statuses need chaining
        const selectedStudies = studies.filter((s) => selected.has(s.id));
        const statusesNeedingChain = [
          ...new Set(
            selectedStudies
              .filter((s) => needsIntermediate.some((r) => r.id === s.id))
              .map((s) => s.status)
          ),
        ];

        const steps = statusesNeedingChain
          .map((status) => CHAIN_DESCRIPTIONS[`${action}_${status}`])
          .filter(Boolean);

        const description = steps.length > 0
          ? `Some studies need to be ${steps[0]} first. Proceed?`
          : `Some studies need intermediate status changes. Proceed?`;

        setConfirm({
          title: `${action.charAt(0).toUpperCase() + action.slice(1)} Studies`,
          description,
          label: `${action.charAt(0).toUpperCase() + action.slice(1)} All`,
          variant: "default",
          onConfirm: () => {
            setConfirm(null);
            runBatch(action, true);
          },
        });
        return;
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed === 0) {
        const verb = action === "delete" ? "deleted" : action === "close" ? "closed" : "archived";
        toast(`${succeeded} ${succeeded === 1 ? "study" : "studies"} ${verb}`, "success");
      } else if (succeeded > 0) {
        toast(`${succeeded} succeeded, ${failed} skipped`, "success");
      } else {
        toast(`No studies could be ${action === "delete" ? "deleted" : action + "d"}`, "error");
      }

      setSelected(new Set());
      router.refresh();
    } catch {
      toast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: BatchAction) => {
    if (action === "delete") {
      const draftCount = studies.filter(
        (s) => selected.has(s.id) && s.status === "DRAFT"
      ).length;
      const nonDraftCount = selected.size - draftCount;

      setConfirm({
        title: "Delete Studies",
        description:
          nonDraftCount > 0
            ? `Only ${draftCount} draft ${draftCount === 1 ? "study" : "studies"} will be deleted. ${nonDraftCount} non-draft ${nonDraftCount === 1 ? "study" : "studies"} will be skipped. This cannot be undone.`
            : `Delete ${draftCount} ${draftCount === 1 ? "study" : "studies"}? This cannot be undone.`,
        label: "Delete",
        variant: "destructive",
        onConfirm: () => {
          setConfirm(null);
          runBatch("delete");
        },
      });
      return;
    }

    runBatch(action);
  };

  const hasSelection = selected.size > 0;

  return (
    <>
      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg border border-border bg-accent/30 animate-in fade-in slide-in-from-top-1 duration-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeStudies.every((s) => selected.has(s.id))}
              onChange={toggleAll}
              className="accent-primary w-3.5 h-3.5"
            />
            <span className="text-sm font-medium text-foreground">
              {selected.size} selected
            </span>
          </label>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleAction("close")}
          >
            Close
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleAction("archive")}
          >
            Archive
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={loading}
            onClick={() => handleAction("delete")}
          >
            Delete
          </Button>
        </div>
      )}

      {/* Active studies */}
      <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
        {activeStudies.map((study, i) => (
          <StudyRow
            key={study.id}
            study={study}
            checked={selected.has(study.id)}
            onToggle={() => toggle(study.id)}
            isLast={i === activeStudies.length - 1}
          />
        ))}
      </div>

      {/* Archived studies — collapsed */}
      {archivedStudies.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                showArchived ? "" : "-rotate-90"
              }`}
            />
            <span>
              {archivedStudies.length} archived{" "}
              {archivedStudies.length === 1 ? "study" : "studies"}
            </span>
          </button>
          {showArchived && (
            <div className="mt-2 rounded-xl border border-border/40 bg-background overflow-hidden opacity-60 animate-in fade-in slide-in-from-top-1 duration-200">
              {archivedStudies.map((study, i) => (
                <StudyRow
                  key={study.id}
                  study={study}
                  checked={selected.has(study.id)}
                  onToggle={() => toggle(study.id)}
                  isLast={i === archivedStudies.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.label || "Confirm"}
        confirmVariant={confirm?.variant || "default"}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function StudyRow({
  study,
  checked,
  onToggle,
  isLast,
}: {
  study: StudyItem;
  checked: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <div className={`group flex items-center py-3 px-4 hover:bg-accent/30 transition-colors ${
      !isLast ? "border-b border-border/40" : ""
    }`}>
      <label
        className="flex items-center shrink-0 pr-3 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="accent-primary w-3.5 h-3.5"
        />
      </label>
      <Link
        href={`/admin/studies/${study.id}`}
        className="flex items-center justify-between flex-1 min-w-0"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground group-hover:text-primary truncate transition-colors">
            {study.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">
              {study._count.questions} {study._count.questions === 1 ? "question" : "questions"}
            </span>
            <span className="text-muted-foreground/20">&middot;</span>
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">
              {study._count.responses} {study._count.responses === 1 ? "response" : "responses"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <StatusDot status={study.status} />
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
        </div>
      </Link>
    </div>
  );
}
