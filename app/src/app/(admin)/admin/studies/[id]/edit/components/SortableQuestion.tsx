"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "motion/react";
import type { QuestionData } from "./StudyEditor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuestionEditor } from "./QuestionEditor";
import { QuestionPreviewModal } from "./QuestionPreviewModal";
import { TYPE_LABELS, PHASE_COLORS } from "@/lib/constants/editor";
import { springForIntent, staggerDelay } from "@/lib/motion";

export function SortableQuestion({
  question,
  allQuestions,
  isSelected,
  isLocked,
  onSelect,
  onDelete,
  onUpdate,
  onDuplicateToPhase,
}: {
  question: QuestionData;
  allQuestions: QuestionData[];
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<QuestionData>) => void;
  onDuplicateToPhase?: (question: QuestionData, targetPhase: string) => Promise<string | null>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Disable drag when selected (editing) or when only 1 question
  const canDrag = !isLocked && !isSelected && allQuestions.length > 1;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border transition-[border-color,box-shadow] duration-150 ${
        isDragging
          ? "border-primary/40 shadow-lg scale-[1.01]"
          : isSelected
          ? "border-primary/30 bg-background shadow-md ring-1 ring-primary/8"
          : "border-border hover:border-primary/20 bg-background shadow-sm"
      }`}
    >
      {/* Header row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isSelected ? "" : "cursor-pointer"}`}
        onClick={isSelected ? undefined : onSelect}
      >
        {/* Drag handle — only when draggable */}
        {canDrag ? (
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors shrink-0 -ml-1"
            aria-label="Drag to reorder"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
          </button>
        ) : (
          /* Spacer to keep alignment when handle is hidden */
          !isSelected && <div className="w-[14px] shrink-0 -ml-1" />
        )}

        {/* Order number */}
        <span className="text-xs text-muted-foreground/50 w-5 text-right font-mono shrink-0 tabular-nums">
          {question.order + 1}
        </span>

        {/* Question info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate transition-colors duration-150 ${
            isSelected ? "text-primary" : "text-foreground"
          }`}>
            {question.title || "Untitled question"}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                PHASE_COLORS[question.phase] || "bg-gray-100 text-gray-800"
              }`}
            >
              {question.phase.replace(/_/g, " ")}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {TYPE_LABELS[question.type] || question.type}
            </span>
            {question.isScreening && (
              <span className="text-[10px] text-amber-600 font-medium">
                SCREENING
              </span>
            )}
            {question.required && (
              <span className="text-[10px] text-red-500/70">Required</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(true);
            }}
            className="text-muted-foreground/40 hover:text-foreground"
            title="Preview question"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
          {!isLocked && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              className="text-muted-foreground/40 hover:text-destructive"
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
      </div>

      {/* Inline editor — animated expand/collapse */}
      <AnimatePresence mode="sync">
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springForIntent(isSelected ? "expand" : "collapse")}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <QuestionEditor
                question={question}
                allQuestions={allQuestions}
                isLocked={isLocked}
                onUpdate={onUpdate}
                onDuplicateToPhase={onDuplicateToPhase}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <QuestionPreviewModal
        open={showPreview}
        question={question}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
}
