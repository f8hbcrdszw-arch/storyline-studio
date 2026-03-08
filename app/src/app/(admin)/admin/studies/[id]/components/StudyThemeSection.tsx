"use client";

import { useState, useCallback, useRef } from "react";
import { ThemeEditor } from "../edit/components/ThemeEditor";
import { DEFAULT_THEME, type SurveyTheme } from "@/lib/types/json-fields";

export function StudyThemeSection({
  studyId,
  initialTheme,
  settings,
}: {
  studyId: string;
  initialTheme: SurveyTheme;
  settings: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [theme, setTheme] = useState<SurveyTheme>(initialTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveTheme = useCallback(
    async (newTheme: SurveyTheme) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/studies/${studyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: { ...settings, theme: newTheme },
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to save theme");
        }
      } catch {
        setError("Network error");
      } finally {
        setSaving(false);
      }
    },
    [studyId, settings]
  );

  const handleUpdate = useCallback(
    (newTheme: SurveyTheme) => {
      setTheme(newTheme);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => saveTheme(newTheme), 800);
    },
    [saveTheme]
  );

  return (
    <div className="mt-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full"
      >
        <p className="section-label">Appearance</p>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {saving && (
          <span className="text-[10px] text-muted-foreground ml-auto">Saving...</span>
        )}
        {error && (
          <span className="text-[10px] text-destructive ml-auto">{error}</span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 rounded-lg border border-border p-4">
          <ThemeEditor
            theme={theme}
            onUpdate={handleUpdate}
            isLocked={false}
          />
        </div>
      )}
    </div>
  );
}
