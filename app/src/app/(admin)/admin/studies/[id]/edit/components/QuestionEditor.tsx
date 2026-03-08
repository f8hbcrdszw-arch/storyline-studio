"use client";

import { useState, useCallback, useRef } from "react";
import type { QuestionData, QuestionOptionData } from "@/lib/types/question";
import { MediaUploader } from "./MediaUploader";
import { SkipLogicEditor } from "./SkipLogicEditor";
import { CONFIG_COMPONENTS } from "./configs";

// Re-export for backward compatibility
export type { QuestionOptionData as QuestionOption, MediaItemData } from "@/lib/types/question";

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

// Types that support media attachments (question-level, not per-option)
const MEDIA_TYPES = new Set(["VIDEO_DIAL", "SENTIMENT"]);

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
  const [duplicating, setDuplicating] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof QuestionData>(field: K, value: QuestionData[K]) => {
      onUpdate({ [field]: value } as Partial<QuestionData>);
    },
    [onUpdate]
  );

  const updateConfig = useCallback(
    (key: string, value: unknown) => {
      onUpdate({ config: { ...question.config, [key]: value } });
    },
    [onUpdate, question.config]
  );

  const updateOption = useCallback(
    (index: number, field: keyof QuestionOptionData, value: string) => {
      const updated = question.options.map((opt, i) =>
        i === index ? { ...opt, [field]: value } : opt
      );
      onUpdate({ options: updated });
    },
    [onUpdate, question.options]
  );

  const addOption = useCallback(() => {
    const nextOrder = question.options.length;
    onUpdate({
      options: [
        ...question.options,
        {
          id: `temp-${Date.now()}`,
          label: "",
          value: `option_${nextOrder + 1}`,
          order: nextOrder,
          imageUrl: null,
        },
      ],
    });
  }, [onUpdate, question.options]);

  const removeOption = useCallback(
    (index: number) => {
      onUpdate({ options: question.options.filter((_, i) => i !== index) });
    },
    [onUpdate, question.options]
  );

  // Look up the config component for this question type
  const ConfigComponent = CONFIG_COMPONENTS[question.type] ?? null;

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
          value={question.title}
          onChange={(e) => updateField("title", e.target.value)}
          disabled={isLocked}
          className={`w-full rounded-md border bg-background px-3 py-1.5 text-sm ${
            question.title.trim() === "" ? "border-destructive/50" : "border-input"
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
          value={question.prompt || ""}
          onChange={(e) => updateField("prompt", e.target.value || null)}
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
                onClick={() => updateField("phase", p.value)}
                disabled={isLocked}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  question.phase === p.value
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
        {question.phase === "PRE_BALLOT" && onDuplicateToPhase && !isLocked && (
          <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            {allQuestions.some(
              (q) =>
                q.id !== question.id &&
                q.phase === "POST_BALLOT" &&
                q.type === question.type &&
                q.title === question.title
            ) ? (
              <p className="text-xs text-blue-600">Post-ballot pair exists</p>
            ) : (
              <button
                onClick={async () => {
                  setDuplicating(true);
                  setDupError(null);
                  const err = await onDuplicateToPhase(question, "POST_BALLOT");
                  if (err) setDupError(err);
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
            {dupError && (
              <p className="text-[10px] text-destructive mt-1">{dupError}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 pt-1 border-t border-border">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => updateField("required", e.target.checked)}
              disabled={isLocked}
              className="rounded"
            />
            Required
          </label>

          {question.phase === "SCREENING" && (
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={question.isScreening}
                onChange={(e) => updateField("isScreening", e.target.checked)}
                disabled={isLocked}
                className="rounded"
              />
              Terminate unqualified
            </label>
          )}
        </div>
      </div>

      {/* Type-specific config via registry */}
      {ConfigComponent && (
        <ConfigComponent
          config={question.config}
          onUpdate={updateConfig}
          isLocked={isLocked}
        />
      )}

      {/* Options editor for applicable types */}
      {OPTION_TYPES.has(question.type) && (
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Options
          </label>
          <div className="space-y-2">
            {question.options.map((opt, i) => (
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
                      const updated = question.options.map((o, idx) =>
                        idx === i ? { ...o, imageUrl: key } : o
                      );
                      onUpdate({ options: updated });
                    }}
                    onRemoved={() => {
                      const updated = question.options.map((o, idx) =>
                        idx === i ? { ...o, imageUrl: null } : o
                      );
                      onUpdate({ options: updated });
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
          onMediaAdded={(item) =>
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

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("storage");

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
