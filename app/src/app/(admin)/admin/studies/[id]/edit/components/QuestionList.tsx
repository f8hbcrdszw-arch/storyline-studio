"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "@/stores/editor-store";
import { TYPE_LABELS, PHASE_COLORS } from "@/lib/constants/editor";

// Phase band background colors (subtle environmental shift)
const PHASE_BANDS: Record<string, string> = {
  SCREENING: "bg-amber-50/40",
  PRE_BALLOT: "bg-transparent",
  STIMULUS: "bg-primary/[0.03]",
  POST_BALLOT: "bg-transparent",
};

/**
 * Question list sidebar — the survey spine.
 * Shows questions as nodes on a vertical path with phase grouping.
 */
export function QuestionList({ isLocked }: { isLocked: boolean }) {
  const questions = useEditorStore((s) => s.questions);
  const selectedQuestionId = useEditorStore((s) => s.selectedQuestionId);
  const selectQuestion = useEditorStore((s) => s.selectQuestion);
  const reorderQuestions = useEditorStore((s) => s.reorderQuestions);
  const study = useEditorStore((s) => s.study);
  const [searchQuery, setSearchQuery] = useState("");

  const reorderControllerRef = useRef<AbortController | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...questions];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      reorderQuestions(reordered.map((q, i) => ({ ...q, order: i })));

      reorderControllerRef.current?.abort();
      const controller = new AbortController();
      reorderControllerRef.current = controller;

      await fetch("/api/questions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId: study?.id,
          questionIds: reordered.map((q) => q.id),
        }),
        signal: controller.signal,
      }).catch((err) => {
        if (err.name !== "AbortError") console.error("Reorder failed:", err);
      });
    },
    [questions, study?.id, reorderQuestions]
  );

  const canDrag = !isLocked && questions.length > 1;

  // Filter questions by search
  const filtered = searchQuery.trim()
    ? questions.filter(
        (q) =>
          q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (TYPE_LABELS[q.type] || q.type)
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : questions;

  // Group by phase for headers
  const phaseBreaks = useMemo(() => {
    const breaks = new Set<string>();
    let lastPhase = "";
    for (const q of filtered) {
      if (q.phase !== lastPhase) {
        breaks.add(q.id);
        lastPhase = q.phase;
      }
    }
    return breaks;
  }, [filtered]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          Questions
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground/40">
          {questions.length}
        </span>
      </div>

      {/* Search — only show with 5+ questions */}
      {questions.length >= 5 && (
        <div className="relative mb-3">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/30"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-border/60 bg-background/80 placeholder:text-muted-foreground/30 outline-none focus:border-primary/30 transition-colors"
          />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filtered.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* The spine */}
          <div className="relative">
            {/* Vertical spine line */}
            {filtered.length > 1 && (
              <div
                className="absolute left-[15px] top-4 bottom-4 w-px bg-border/50"
                aria-hidden="true"
              />
            )}

            <div className="space-y-0.5">
              {filtered.map((q, i) => (
                <div key={q.id}>
                  {/* Phase header — when phase changes */}
                  {phaseBreaks.has(q.id) && (
                    <div className={`px-2 py-1.5 -mx-1 rounded-md ${PHASE_BANDS[q.phase] || ""} ${i > 0 ? "mt-2" : ""}`}>
                      <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider pl-6">
                        {q.phase.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                  <QuestionListItem
                    id={q.id}
                    title={q.title}
                    type={q.type}
                    phase={q.phase}
                    order={q.order}
                    isSelected={selectedQuestionId === q.id}
                    canDrag={canDrag}
                    onSelect={() => selectQuestion(selectedQuestionId === q.id ? null : q.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </SortableContext>
      </DndContext>

      {filtered.length === 0 && searchQuery && (
        <p className="text-[11px] text-muted-foreground/50 text-center py-4">
          No match for &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {questions.length === 0 && (
        <div className="text-center py-8">
          {/* Empty spine — single node */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-dashed border-muted-foreground/20" />
            <p className="text-[11px] text-muted-foreground/40 italic">
              Your survey starts here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function QuestionListItem({
  id,
  title,
  type,
  order,
  isSelected,
  canDrag,
  onSelect,
}: {
  id: string;
  title: string;
  type: string;
  phase: string;
  order: number;
  isSelected: boolean;
  canDrag: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`w-full text-left pl-2 pr-2.5 py-2 rounded-lg text-xs transition-all duration-100 group relative ${
        isDragging
          ? "bg-primary/10 shadow-md z-10 scale-[1.02]"
          : isSelected
          ? "bg-primary/8 text-foreground"
          : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"
      }`}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
    >
      {/* Selected accent bar */}
      {isSelected && (
        <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />
      )}

      <div className="flex items-start gap-2">
        {/* Spine node */}
        <div className="mt-1 shrink-0 relative">
          <div
            className={`w-[10px] h-[10px] rounded-full border-2 transition-colors duration-150 ${
              isSelected
                ? "border-primary bg-primary/20"
                : "border-border bg-background group-hover:border-muted-foreground/40"
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-[12px] leading-snug ${
            isSelected ? "font-medium text-foreground" : "font-normal"
          }`}>
            {title || "Untitled"}
          </p>
          <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">
            {TYPE_LABELS[type] || type}
          </span>
        </div>

        {/* Order number */}
        <span className="text-[9px] tabular-nums text-muted-foreground/30 mt-0.5 shrink-0">
          {order + 1}
        </span>
      </div>
    </button>
  );
}
