"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
import type { QuestionOptionData } from "@/lib/types/question";
import { springForIntent } from "@/lib/motion";

interface OptionsEditorProps {
  options: QuestionOptionData[];
  questionType: string;
  isLocked: boolean;
  onUpdate: (options: QuestionOptionData[]) => void;
}

export function OptionsEditor({
  options,
  questionType,
  isLocked,
  onUpdate,
}: OptionsEditorProps) {
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(0);
  const lastAddTime = useRef(0);
  const newInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = options.findIndex((o) => o.id === active.id);
      const newIndex = options.findIndex((o) => o.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...options];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      onUpdate(reordered.map((o, i) => ({ ...o, order: i })));
    },
    [options, onUpdate]
  );

  // Track rapid-add mode (suppress animation when adding fast)
  const isRapidAdd = useCallback(() => {
    const now = Date.now();
    const timeSinceLast = now - lastAddTime.current;
    return timeSinceLast < 2000 && addCount >= 2;
  }, [addCount]);

  const addOption = useCallback(() => {
    const id = `temp-${Date.now()}`;
    const now = Date.now();
    if (now - lastAddTime.current < 2000) {
      setAddCount((c) => c + 1);
    } else {
      setAddCount(1);
    }
    lastAddTime.current = now;

    onUpdate([
      ...options,
      {
        id,
        label: "",
        value: `option_${options.length + 1}`,
        order: options.length,
        imageUrl: null,
      },
    ]);
    setRecentlyAdded(id);
  }, [options, onUpdate]);

  // Auto-focus newly added option
  useEffect(() => {
    if (recentlyAdded) {
      const timer = setTimeout(() => {
        newInputRef.current?.focus();
        setRecentlyAdded(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [recentlyAdded]);

  const updateOption = useCallback(
    (id: string, field: keyof QuestionOptionData, value: string | boolean | null) => {
      onUpdate(
        options.map((opt) => (opt.id === id ? { ...opt, [field]: value } : opt))
      );
    },
    [options, onUpdate]
  );

  const removeOption = useCallback(
    (id: string) => {
      onUpdate(options.filter((o) => o.id !== id).map((o, i) => ({ ...o, order: i })));
    },
    [options, onUpdate]
  );

  // Handle Enter key on last option → add new option
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "Enter" && index === options.length - 1) {
        e.preventDefault();
        addOption();
      }
      if (e.key === "Backspace" && options[index]?.label === "" && options.length > 1) {
        e.preventDefault();
        removeOption(options[index].id);
      }
    },
    [options, addOption, removeOption]
  );

  const showExclusive = questionType === "MULTIPLE_CHOICE";

  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider block mb-3">
        Options
        <span className="font-normal normal-case tracking-normal text-muted-foreground/40 ml-1.5">
          {options.length}
        </span>
      </label>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={options.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {options.map((opt, i) => (
                <SortableOption
                  key={opt.id}
                  option={opt}
                  index={i}
                  isLocked={isLocked}
                  isLast={i === options.length - 1}
                  isOnly={options.length <= 1}
                  showExclusive={showExclusive}
                  recentlyAdded={recentlyAdded === opt.id}
                  skipAnimation={isRapidAdd()}
                  inputRef={recentlyAdded === opt.id ? newInputRef : undefined}
                  onUpdate={(field, value) => updateOption(opt.id, field, value)}
                  onRemove={() => removeOption(opt.id)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

      {!isLocked && (
        <button
          onClick={addOption}
          className="mt-3 w-full py-2.5 text-xs text-muted-foreground/60 hover:text-primary border border-dashed border-border/60 hover:border-primary/30 rounded-xl transition-all hover:bg-primary/[0.02] group"
        >
          <span className="inline-flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="group-hover:rotate-90 transition-transform duration-200"
            >
              <line x1="6" y1="1" x2="6" y2="11" />
              <line x1="1" y1="6" x2="11" y2="6" />
            </svg>
            Add option
          </span>
        </button>
      )}

      {options.length === 0 && (
        <p className="text-[11px] text-muted-foreground/50 text-center py-4">
          No options yet
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SortableOption({
  option,
  index,
  isLocked,
  isLast,
  isOnly,
  showExclusive,
  recentlyAdded,
  skipAnimation,
  inputRef,
  onUpdate,
  onRemove,
  onKeyDown,
}: {
  option: QuestionOptionData;
  index: number;
  isLocked: boolean;
  isLast: boolean;
  isOnly: boolean;
  showExclusive: boolean;
  recentlyAdded: boolean;
  skipAnimation: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onUpdate: (field: keyof QuestionOptionData, value: string | boolean | null) => void;
  onRemove: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id, disabled: isLocked });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isExclusive = option.value?.includes("__exclusive");

  return (
    <motion.div
      layout={!isDragging}
      initial={skipAnimation ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={springForIntent("reveal")}
    >
      <div
        ref={setNodeRef}
        style={sortableStyle}
        className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-150 ${
          isDragging
            ? "bg-primary/5 shadow-lg z-10 scale-[1.02] ring-1 ring-primary/20"
            : isExclusive
            ? "bg-amber-50/50 border border-amber-200/50 hover:border-amber-300/60"
            : "bg-transparent border border-transparent hover:bg-muted/30 focus-within:bg-muted/20 focus-within:border-border/40"
        }`}
      >
        {/* Drag handle — hidden when locked or only 1 option */}
        {!isLocked && !isOnly && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-muted-foreground/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Drag to reorder option"
            tabIndex={-1}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="3" cy="2" r="1" />
              <circle cx="7" cy="2" r="1" />
              <circle cx="3" cy="5" r="1" />
              <circle cx="7" cy="5" r="1" />
              <circle cx="3" cy="8" r="1" />
              <circle cx="7" cy="8" r="1" />
            </svg>
          </button>
        )}

        {/* Option number */}
        <span className="text-[10px] tabular-nums text-muted-foreground/35 w-3 text-right shrink-0">
          {index + 1}
        </span>

        {/* Label input — borderless, survey-like */}
        <input
          ref={inputRef}
          type="text"
          value={option.label}
          onChange={(e) => onUpdate("label", e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isLocked}
          placeholder={isLast ? "Type and press Enter..." : "Option label"}
          className="flex-1 bg-transparent text-sm outline-none border-none focus:ring-0 placeholder:text-muted-foreground/30 placeholder:italic min-w-0"
        />

        {/* Exclusive badge for MC */}
        {showExclusive && (
          <button
            onClick={() =>
              onUpdate(
                "value",
                isExclusive
                  ? option.value.replace("__exclusive", "")
                  : `${option.value}__exclusive`
              )
            }
            disabled={isLocked}
            className={`shrink-0 px-2 py-0.5 text-[9px] rounded-full border transition-all duration-150 ${
              isExclusive
                ? "border-amber-300/80 bg-amber-50 text-amber-700 font-medium"
                : "border-transparent text-muted-foreground/20 hover:text-muted-foreground/50 hover:border-border/40 opacity-0 group-hover:opacity-100"
            }`}
            title="Make this option exclusive (deselects all others)"
          >
            Exclusive
          </button>
        )}

        {/* Remove button */}
        {!isLocked && !isOnly && (
          <button
            onClick={onRemove}
            className="shrink-0 text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Remove option"
            tabIndex={-1}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="3" x2="9" y2="9" />
              <line x1="9" y1="3" x2="3" y2="9" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}
