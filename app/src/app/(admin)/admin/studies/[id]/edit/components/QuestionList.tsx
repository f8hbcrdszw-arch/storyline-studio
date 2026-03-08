"use client";

import { useCallback, useRef } from "react";
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
} from "@dnd-kit/sortable";
import { useEditorStore } from "@/stores/editor-store";

const PHASE_COLORS: Record<string, string> = {
  SCREENING: "bg-orange-100 text-orange-800",
  PRE_BALLOT: "bg-blue-100 text-blue-800",
  STIMULUS: "bg-purple-100 text-purple-800",
  POST_BALLOT: "bg-green-100 text-green-800",
};

const TYPE_LABELS: Record<string, string> = {
  VIDEO_DIAL: "Video Dial",
  MULTIPLE_CHOICE: "Multiple Choice",
  LIKERT: "Likert Scale",
  OPEN_TEXT: "Open Text",
  NUMERIC: "Numeric",
  AB_TEST: "A/B Test",
  RANKING: "Ranking",
  MATRIX: "Matrix",
  MULTI_ITEM_RATING: "Multi-Item Rating",
  SENTIMENT: "Sentiment",
  REACTION: "Reaction",
};

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

  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Questions ({questions.length})
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-px">
            {questions.map((q) => (
              <QuestionListItem
                key={q.id}
                id={q.id}
                title={q.title}
                type={q.type}
                phase={q.phase}
                order={q.order}
                isSelected={selectedQuestionId === q.id}
                isLocked={isLocked}
                onSelect={() => selectQuestion(selectedQuestionId === q.id ? null : q.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {questions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No questions yet
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function QuestionListItem({
  id,
  title,
  type,
  phase,
  order,
  isSelected,
  isLocked,
  onSelect,
}: {
  id: string;
  title: string;
  type: string;
  phase: string;
  order: number;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isLocked });

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
      className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors group ${
        isSelected
          ? "bg-primary/10 text-foreground"
          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      }`}
      {...attributes}
      {...listeners}
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
