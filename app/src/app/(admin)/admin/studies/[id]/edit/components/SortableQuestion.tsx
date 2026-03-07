"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { QuestionData } from "./StudyEditor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuestionEditor } from "./QuestionEditor";

const TYPE_LABELS: Record<string, string> = {
  VIDEO_DIAL: "Video Dial",
  STANDARD_LIST: "Standard List",
  WORD_LIST: "Word List",
  IMAGE_LIST: "Image List",
  LIKERT: "Likert Scale",
  MULTI_LIKERT: "Multi-Item Likert",
  NUMERIC: "Numeric",
  WRITE_IN: "Write-In",
  TEXT_AB: "Text A/B",
  IMAGE_AB: "Image A/B",
  LIST_RANKING: "List Ranking",
  GRID: "Grid",
  COMPARISON: "Comparison",
  AD_MOCK_UP: "Ad Mock-Up",
  OVERALL_REACTION: "Overall Reaction",
  SELECT_FROM_SET: "Select From Set",
  MULTI_AD: "Multi-Ad",
  CREATIVE_COPY: "Creative Copy",
};

const PHASE_COLORS: Record<string, string> = {
  SCREENING: "bg-orange-100 text-orange-800",
  PRE_BALLOT: "bg-blue-100 text-blue-800",
  STIMULUS: "bg-purple-100 text-purple-800",
  POST_BALLOT: "bg-green-100 text-green-800",
};

export function SortableQuestion({
  question,
  allQuestions,
  isSelected,
  isLocked,
  onSelect,
  onDelete,
  onUpdate,
}: {
  question: QuestionData;
  allQuestions: QuestionData[];
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<QuestionData>) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-3 transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        {!isLocked && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </button>
        )}

        {/* Order number */}
        <span className="text-xs text-muted-foreground w-5 text-right font-mono">
          {question.order + 1}
        </span>

        {/* Question info */}
        <button
          onClick={onSelect}
          className="flex-1 text-left"
        >
          <p className="text-sm font-medium text-foreground">{question.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                PHASE_COLORS[question.phase] || "bg-gray-100 text-gray-800"
              }`}
            >
              {question.phase.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted-foreground">
              {TYPE_LABELS[question.type] || question.type}
            </span>
            {question.isScreening && (
              <span className="text-[10px] text-amber-600 font-medium">
                SCREENING
              </span>
            )}
            {question.required && (
              <span className="text-[10px] text-red-500">Required</span>
            )}
          </div>
        </button>

        {/* Actions */}
        {!isLocked && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
            </svg>
          </Button>
        )}
      </div>

      {/* Inline editor */}
      {isSelected && (
        <QuestionEditor
          question={question}
          allQuestions={allQuestions}
          isLocked={isLocked}
          onUpdate={onUpdate}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete question"
        description="This question and its responses will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
