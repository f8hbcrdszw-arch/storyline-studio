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
      <div className="border-t border-border">
        {activeStudies.map((study) => (
          <StudyRow
            key={study.id}
            study={study}
            checked={selected.has(study.id)}
            onToggle={() => toggle(study.id)}
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
            <div className="mt-2 border-t border-border opacity-60 animate-in fade-in slide-in-from-top-1 duration-200">
              {archivedStudies.map((study) => (
                <StudyRow
                  key={study.id}
                  study={study}
                  checked={selected.has(study.id)}
                  onToggle={() => toggle(study.id)}
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
}: {
  study: StudyItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="group flex items-center border-b border-border py-3 px-2 hover:bg-accent/30 -mx-1 rounded-md">
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
          <p className="text-sm font-medium text-foreground group-hover:text-primary truncate">
            {study.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {study._count.questions}{" "}
            {study._count.questions === 1 ? "question" : "questions"} ·{" "}
            {study._count.responses}{" "}
            {study._count.responses === 1 ? "response" : "responses"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <StatusDot status={study.status} />
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-150" />
        </div>
      </Link>
    </div>
  );
}
