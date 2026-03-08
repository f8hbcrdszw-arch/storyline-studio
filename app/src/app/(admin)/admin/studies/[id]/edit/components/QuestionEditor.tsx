"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { QuestionData, QuestionOption, MediaItemData } from "./StudyEditor";
import { MediaUploader } from "./MediaUploader";
import { SkipLogicEditor } from "./SkipLogicEditor";

const PHASE_OPTIONS = [
  { value: "SCREENING", label: "Screening" },
  { value: "PRE_BALLOT", label: "Pre-Ballot" },
  { value: "STIMULUS", label: "Stimulus" },
  { value: "POST_BALLOT", label: "Post-Ballot" },
];

// Question types that use options
const OPTION_TYPES = new Set([
  "MULTIPLE_CHOICE",
  "AB_TEST",
  "RANKING",
  "SENTIMENT",
  "REACTION",
  "MULTI_ITEM_RATING",
]);

// Types that need likert config
const LIKERT_TYPES = new Set(["LIKERT", "MULTI_ITEM_RATING", "REACTION"]);

// Types that need numeric config
const NUMERIC_TYPES = new Set(["NUMERIC"]);

// Types that need matrix (grid) config
const MATRIX_TYPES = new Set(["MATRIX"]);

// Types that support media attachments (question-level, not per-option)
const MEDIA_TYPES = new Set([
  "VIDEO_DIAL",
  "SENTIMENT",
]);

export function QuestionEditor({
  question,
  allQuestions,
  isLocked,
  onUpdate,
  onDuplicateToPhase,
}: {
  question: QuestionData;
  allQuestions: QuestionData[];
  isLocked: boolean;
  onUpdate: (updates: Partial<QuestionData>) => void;
  onDuplicateToPhase?: (question: QuestionData, targetPhase: string) => Promise<string | null>;
}) {
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"saved" | "error" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [title, setTitle] = useState(question.title);
  const [prompt, setPrompt] = useState(question.prompt || "");
  const [phase, setPhase] = useState(question.phase);
  const [required, setRequired] = useState(question.required);
  const [isScreening, setIsScreening] = useState(question.isScreening);
  const [options, setOptions] = useState<QuestionOption[]>(question.options);
  const [config, setConfig] = useState<Record<string, unknown>>(
    question.config
  );

  const save = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);
    setSaveError(null);
    const body: Record<string, unknown> = {
      title,
      prompt: prompt || null,
      phase,
      required,
      isScreening,
      config,
      skipLogic: question.skipLogic,
    };

    if (OPTION_TYPES.has(question.type)) {
      body.options = options;
    }

    try {
      const res = await fetch(`/api/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdate({
          title,
          prompt: prompt || null,
          phase,
          required,
          isScreening,
          config,
          options: updated.options ?? options,
        });
        setSaveResult("saved");
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.error("[save] failed:", res.status, errBody);
        setSaveResult("error");
        if (errBody.details) {
          setSaveError(errBody.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`).join(", "));
        }
      }
    } catch {
      setSaveResult("error");
    }
    setSaving(false);
  }, [
    title,
    prompt,
    phase,
    required,
    isScreening,
    config,
    options,
    question.id,
    question.type,
    onUpdate,
  ]);

  const markDirty = useCallback(() => { setSaveResult(null); setSaveError(null); }, []);

  const addOption = useCallback(() => {
    const nextOrder = options.length;
    setOptions((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        label: "",
        value: `option_${nextOrder + 1}`,
        order: nextOrder,
        imageUrl: null,
      },
    ]);
    markDirty();
  }, [options.length, markDirty]);

  const removeOption = useCallback((index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  }, [markDirty]);

  const updateOption = useCallback(
    (index: number, field: keyof QuestionOption, value: string) => {
      setOptions((prev) =>
        prev.map((opt, i) =>
          i === index ? { ...opt, [field]: value } : opt
        )
      );
      markDirty();
    },
    [markDirty]
  );

  const updateConfig = useCallback(
    (key: string, value: unknown) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
      markDirty();
    },
    [markDirty]
  );

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-5">
      {/* Question text */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Question Text
          <span className="font-normal text-muted-foreground/60 ml-1">required</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); markDirty(); }}
          disabled={isLocked}
          className={`w-full rounded-md border bg-background px-3 py-1.5 text-sm ${
            title.trim() === "" ? "border-destructive/50" : "border-input"
          }`}
          placeholder="What respondents will see..."
        />
        <p className="text-[10px] text-muted-foreground mt-1">Visible to respondents</p>
      </div>

      {/* Instructions */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Instructions
          <span className="font-normal text-muted-foreground/60 ml-1">optional</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); markDirty(); }}
          disabled={isLocked}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm resize-none"
          placeholder="Additional context or directions for this question..."
        />
      </div>

      {/* Phase + settings */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            Phase
          </label>
          <div className="flex gap-1">
            {PHASE_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPhase(p.value); markDirty(); }}
                disabled={isLocked}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  phase === p.value
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Post-ballot pair prompt */}
        {phase === "PRE_BALLOT" && onDuplicateToPhase && !isLocked && (
          <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            {allQuestions.some(
              (q) =>
                q.id !== question.id &&
                q.phase === "POST_BALLOT" &&
                q.type === question.type &&
                q.title === question.title
            ) ? (
              <p className="text-xs text-blue-600">
                Post-ballot pair exists
              </p>
            ) : (
              <button
                onClick={async () => {
                  setDuplicating(true);
                  // Use current editor state (not stale prop) for the duplicate
                  const current: QuestionData = {
                    ...question,
                    title,
                    prompt,
                    phase,
                    required,
                    isScreening,
                    options,
                    config,
                  };
                  const err = await onDuplicateToPhase(current, "POST_BALLOT");
                  if (err) {
                    setSaveResult("error");
                    setSaveError(err);
                  }
                  setDuplicating(false);
                }}
                disabled={duplicating}
                className="text-xs text-blue-700 font-medium hover:underline disabled:opacity-50"
              >
                {duplicating ? "Creating..." : "Create post-ballot pair"}
              </button>
            )}
            <p className="text-[10px] text-blue-500 mt-0.5">
              Measure attitude shift by asking the same question after stimulus
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 pt-1 border-t border-border">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => { setRequired(e.target.checked); markDirty(); }}
              disabled={isLocked}
              className="rounded"
            />
            Required
          </label>

          {phase === "SCREENING" && (
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={isScreening}
                onChange={(e) => { setIsScreening(e.target.checked); markDirty(); }}
                disabled={isLocked}
                className="rounded"
              />
              Terminate unqualified
            </label>
          )}
        </div>
      </div>

      {/* Type-specific config */}
      {question.type === "MULTIPLE_CHOICE" && (
        <MultipleChoiceConfig config={config} onUpdate={updateConfig} isLocked={isLocked} />
      )}

      {LIKERT_TYPES.has(question.type) && (
        <LikertConfig config={config} onUpdate={updateConfig} isLocked={isLocked} />
      )}

      {NUMERIC_TYPES.has(question.type) && (
        <NumericConfig config={config} onUpdate={updateConfig} isLocked={isLocked} />
      )}

      {MATRIX_TYPES.has(question.type) && (
        <MatrixConfig config={config} onUpdate={updateConfig} isLocked={isLocked} />
      )}

      {question.type === "SENTIMENT" && (
        <SentimentConfig config={config} onUpdate={updateConfig} isLocked={isLocked} />
      )}

      {question.type === "VIDEO_DIAL" && (
        <VideoDialConfig config={config} onUpdate={updateConfig} isLocked={isLocked} />
      )}

      {/* Options editor for applicable types */}
      {OPTION_TYPES.has(question.type) && (
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Options
          </label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={opt.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 text-right">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(i, "label", e.target.value)}
                    disabled={isLocked}
                    placeholder="Option label"
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                  <input
                    type="text"
                    value={opt.value}
                    onChange={(e) => updateOption(i, "value", e.target.value)}
                    disabled={isLocked}
                    placeholder="Value"
                    className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                  {!isLocked && (
                    <button
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground hover:text-destructive text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* Per-option image upload for AB_TEST */}
                {question.type === "AB_TEST" && (
                  <OptionImageUpload
                    imageUrl={opt.imageUrl}
                    disabled={isLocked}
                    onUploaded={(key) => {
                      setOptions((prev) =>
                        prev.map((o, idx) => idx === i ? { ...o, imageUrl: key } : o)
                      );
                      markDirty();
                    }}
                    onRemoved={() => {
                      setOptions((prev) =>
                        prev.map((o, idx) => idx === i ? { ...o, imageUrl: null } : o)
                      );
                      markDirty();
                    }}
                  />
                )}
              </div>
            ))}
            {!isLocked && (
              <button
                onClick={addOption}
                className="text-xs text-primary hover:underline"
              >
                + Add option
              </button>
            )}
          </div>
        </div>
      )}

      {/* Media uploader for applicable types */}
      {MEDIA_TYPES.has(question.type) && (
        <MediaUploader
          questionId={question.id}
          mediaItems={question.mediaItems}
          onMediaAdded={(item: MediaItemData) =>
            onUpdate({ mediaItems: [...question.mediaItems, item] })
          }
          onMediaRemoved={(id: string) =>
            onUpdate({ mediaItems: question.mediaItems.filter((m) => m.id !== id) })
          }
          maxItems={question.type === "VIDEO_DIAL" ? 1 : undefined}
        />
      )}

      {/* Skip logic */}
      <SkipLogicEditor
        question={question}
        allQuestions={allQuestions}
        onUpdate={(skipLogic) => {
          onUpdate({ skipLogic: skipLogic as QuestionData["skipLogic"] });
        }}
        isLocked={isLocked}
      />

      {/* Save button */}
      {!isLocked && (
        <div className="flex items-center justify-end gap-2">
          {saveResult === "error" && (
            <span className="text-xs text-destructive">
              {saveError || (title.trim() === "" ? "Question text is required" : "Save failed")}
            </span>
          )}
          <Button
            size="sm"
            onClick={save}
            loading={saving}
            disabled={title.trim() === ""}
            variant={saveResult === "saved" ? "ghost" : "default"}
            className={
              saveResult === "saved"
                ? "text-green-600 pointer-events-none"
                : undefined
            }
          >
            {saveResult === "saved" ? "Saved" : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific config components
// ─────────────────────────────────────────────────────────────────────────────

function MultipleChoiceConfig({
  config,
  onUpdate,
  isLocked,
}: {
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  isLocked: boolean;
}) {
  const displayStyle = (config.displayStyle as string) || "list";

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Display Style
      </label>
      <div className="flex gap-1">
        {[
          { value: "list", label: "List" },
          { value: "bubbles", label: "Bubbles" },
          { value: "images", label: "Images" },
        ].map((style) => (
          <button
            key={style.value}
            onClick={() => onUpdate("displayStyle", style.value)}
            disabled={isLocked}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              displayStyle === style.value
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs">
          Max select:
          <input
            type="number"
            value={(config.maxSelect as number) ?? ""}
            onChange={(e) =>
              onUpdate("maxSelect", e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={isLocked}
            min={1}
            className="ml-1 w-16 rounded border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={(config.randomizeOptions as boolean) || false}
            onChange={(e) => onUpdate("randomizeOptions", e.target.checked)}
            disabled={isLocked}
            className="rounded"
          />
          Randomize
        </label>
      </div>
    </div>
  );
}

function LikertConfig({
  config,
  onUpdate,
  isLocked,
}: {
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  isLocked: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Likert Scale
      </label>
      <div className="flex items-center gap-3">
        <label className="text-xs">
          Scale points:
          <select
            value={(config.likertScale as number) || 7}
            onChange={(e) => onUpdate("likertScale", Number(e.target.value))}
            disabled={isLocked}
            className="ml-1 rounded border border-input bg-background px-1 py-0.5 text-sm"
          >
            {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <input
          type="text"
          value={
            (config.likertLabels as { low: string; high: string })?.low || ""
          }
          onChange={(e) =>
            onUpdate("likertLabels", {
              ...(config.likertLabels as object),
              low: e.target.value,
            })
          }
          disabled={isLocked}
          placeholder="Low label"
          className="w-32 rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
        <input
          type="text"
          value={
            (config.likertLabels as { low: string; high: string })?.high || ""
          }
          onChange={(e) =>
            onUpdate("likertLabels", {
              ...(config.likertLabels as object),
              high: e.target.value,
            })
          }
          disabled={isLocked}
          placeholder="High label"
          className="w-32 rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}

function NumericConfig({
  config,
  onUpdate,
  isLocked,
}: {
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  isLocked: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs">
        Min:
        <input
          type="number"
          value={(config.minValue as number) ?? ""}
          onChange={(e) =>
            onUpdate(
              "minValue",
              e.target.value ? Number(e.target.value) : undefined
            )
          }
          disabled={isLocked}
          className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs">
        Max:
        <input
          type="number"
          value={(config.maxValue as number) ?? ""}
          onChange={(e) =>
            onUpdate(
              "maxValue",
              e.target.value ? Number(e.target.value) : undefined
            )
          }
          disabled={isLocked}
          className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs">
        Step:
        <input
          type="number"
          value={(config.step as number) ?? ""}
          onChange={(e) =>
            onUpdate(
              "step",
              e.target.value ? Number(e.target.value) : undefined
            )
          }
          disabled={isLocked}
          className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}

function MatrixConfig({
  config,
  onUpdate,
  isLocked,
}: {
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  isLocked: boolean;
}) {
  const rows = (config.rows as { id: string; label: string }[]) || [];
  const columns = (config.columns as { id: string; label: string }[]) || [];

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Rows
        </label>
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={row.label}
              onChange={(e) => {
                const updated = [...rows];
                updated[i] = { ...row, label: e.target.value };
                onUpdate("rows", updated);
              }}
              disabled={isLocked}
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
            />
            {!isLocked && (
              <button
                onClick={() => onUpdate("rows", rows.filter((_, j) => j !== i))}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!isLocked && (
          <button
            onClick={() =>
              onUpdate("rows", [
                ...rows,
                { id: `row_${rows.length}`, label: "" },
              ])
            }
            className="text-xs text-primary hover:underline"
          >
            + Add row
          </button>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Columns
        </label>
        {columns.map((col, i) => (
          <div key={col.id} className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={col.label}
              onChange={(e) => {
                const updated = [...columns];
                updated[i] = { ...col, label: e.target.value };
                onUpdate("columns", updated);
              }}
              disabled={isLocked}
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
            />
            {!isLocked && (
              <button
                onClick={() =>
                  onUpdate("columns", columns.filter((_, j) => j !== i))
                }
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!isLocked && (
          <button
            onClick={() =>
              onUpdate("columns", [
                ...columns,
                { id: `col_${columns.length}`, label: "" },
              ])
            }
            className="text-xs text-primary hover:underline"
          >
            + Add column
          </button>
        )}
      </div>
    </div>
  );
}

function SentimentConfig({
  config,
  onUpdate,
  isLocked,
}: {
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  isLocked: boolean;
}) {
  const attributes = (config.attributes as string[]) || ["Positive", "Negative"];

  const updateAttribute = (index: number, value: string) => {
    const updated = [...attributes];
    updated[index] = value;
    onUpdate("attributes", updated);
  };

  const removeAttribute = (index: number) => {
    onUpdate("attributes", attributes.filter((_, i) => i !== index));
  };

  const addAttribute = () => {
    onUpdate("attributes", [...attributes, ""]);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        Sentiment Attributes
      </label>
      <p className="text-[10px] text-muted-foreground">
        Respondents will tag options with each attribute (e.g. Positive, Negative, Memorable).
      </p>
      {attributes.map((attr, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={attr}
            onChange={(e) => updateAttribute(i, e.target.value)}
            disabled={isLocked}
            placeholder="Attribute name"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
          {!isLocked && attributes.length > 1 && (
            <button
              onClick={() => removeAttribute(i)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!isLocked && attributes.length < 10 && (
        <button
          onClick={addAttribute}
          className="text-xs text-primary hover:underline"
        >
          + Add attribute
        </button>
      )}
    </div>
  );
}

function VideoDialConfig({
  config,
  onUpdate,
  isLocked,
}: {
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  isLocked: boolean;
}) {
  const mode = (config.mode as string) || "intensity";
  const actionButtons =
    (config.actionButtons as { id: string; label: string }[]) || [];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Dial Mode
        </label>
        <select
          value={mode}
          onChange={(e) => onUpdate("mode", e.target.value)}
          disabled={isLocked}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="intensity">Intensity (0-100)</option>
          <option value="sentiment">Sentiment (Negative-Positive)</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Action Buttons (max 4)
        </label>
        {actionButtons.map((btn, i) => (
          <div key={btn.id} className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={btn.label}
              onChange={(e) => {
                const updated = [...actionButtons];
                updated[i] = { ...btn, label: e.target.value };
                onUpdate("actionButtons", updated);
              }}
              disabled={isLocked}
              placeholder="Button label"
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
            />
            {!isLocked && (
              <button
                onClick={() =>
                  onUpdate(
                    "actionButtons",
                    actionButtons.filter((_, j) => j !== i)
                  )
                }
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!isLocked && actionButtons.length < 4 && (
          <button
            onClick={() =>
              onUpdate("actionButtons", [
                ...actionButtons,
                { id: `action_${actionButtons.length}`, label: "" },
              ])
            }
            className="text-xs text-primary hover:underline"
          >
            + Add action button
          </button>
        )}
      </div>

      {/* Post-video open-end annotation */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          Post-Video Open-End
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.showAnnotation !== false}
              onChange={(e) => onUpdate("showAnnotation", e.target.checked)}
              disabled={isLocked}
              className="rounded border-input"
            />
            Show open-ended text field after video
          </label>
          {config.showAnnotation !== false && (
            <>
              <input
                type="text"
                value={(config.annotationPrompt as string) || ""}
                onChange={(e) => onUpdate("annotationPrompt", e.target.value)}
                disabled={isLocked}
                placeholder="Any additional thoughts? (optional)"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={(config.annotationPlaceholder as string) || ""}
                onChange={(e) => onUpdate("annotationPlaceholder", e.target.value)}
                disabled={isLocked}
                placeholder="Share your thoughts about the video..."
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground"
              />
            </>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Video/media is configured in the Media section after saving.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-option image upload (AB Test)
// ─────────────────────────────────────────────────────────────────────────────

function OptionImageUpload({
  imageUrl,
  disabled,
  onUploaded,
  onRemoved,
}: {
  imageUrl: string | null;
  disabled: boolean;
  onUploaded: (key: string) => void;
  onRemoved: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    // Create local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    try {
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          mediaType: "image",
          filename: file.name,
        }),
      });

      if (!presignRes.ok) throw new Error("server");

      const { uploadUrl, key } = await presignRes.json();

      try {
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!uploadRes.ok) throw new Error("storage");
      } catch {
        throw new Error("storage");
      }

      onUploaded(key);
    } catch {
      setError("Upload failed — please try again.");
      URL.revokeObjectURL(localUrl);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="ml-6 flex items-center gap-2">
      {imageUrl ? (
        <>
          {previewUrl && (
            <img src={previewUrl} alt="" className="w-10 h-10 object-cover rounded border border-border" />
          )}
          <span className="text-[10px] text-green-600">Image attached</span>
          {!disabled && (
            <button
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                onRemoved();
              }}
              className="text-[10px] text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          )}
        </>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            disabled={disabled || uploading}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="text-[10px] text-primary hover:text-primary/80 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {uploading ? "Uploading..." : "Add image"}
          </button>
        </>
      )}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
