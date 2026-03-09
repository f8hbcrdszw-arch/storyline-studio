"use client";

import { useCallback, useRef, useState } from "react";
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

/**
 * Compact question list for the left panel of the split-pane editor.
 * Shows question titles with type/phase badges. Click to select.
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

  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Questions ({questions.length})
      </p>

      {/* Search — only show with 5+ questions */}
      {questions.length >= 5 && (
        <div className="relative mb-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter questions..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors"
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
          <div className="space-y-px">
            {filtered.map((q) => (
              <QuestionListItem
                key={q.id}
                id={q.id}
                title={q.title}
                type={q.type}
                phase={q.phase}
                order={q.order}
                isSelected={selectedQuestionId === q.id}
                canDrag={canDrag}
                onSelect={() => selectQuestion(selectedQuestionId === q.id ? null : q.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {filtered.length === 0 && searchQuery && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No questions match &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {questions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No questions yet
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function QuestionListItem({
  id,
  title,
  type,
  phase,
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
      className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all group ${
        isSelected
          ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      }`}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] tabular-nums text-muted-foreground mt-0.5 shrink-0">
          {order + 1}
        </span>
        <div className="min-w-0">
          <p className={`truncate font-medium ${isSelected ? "text-foreground" : ""}`}>
            {title || "Untitled"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`rounded-full px-1.5 py-px text-[9px] font-medium ${
                PHASE_COLORS[phase] || "bg-gray-100 text-gray-800"
              }`}
            >
              {phase.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {TYPE_LABELS[type] || type}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
