"use client";

import { useState, useCallback } from "react";
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  type SurveyTheme,
} from "@/lib/types/json-fields";

interface ThemeEditorProps {
  theme: SurveyTheme;
  onUpdate: (theme: SurveyTheme) => void;
  isLocked: boolean;
}

const hexRegex = /^#[0-9a-fA-F]{6}$/;

const COLOR_FIELDS: { key: keyof SurveyTheme; label: string }[] = [
  { key: "primaryColor", label: "Primary" },
  { key: "backgroundColor", label: "Background" },
  { key: "textColor", label: "Text" },
  { key: "accentColor", label: "Accent" },
];

const BUTTON_STYLES: { value: SurveyTheme["buttonStyle"]; label: string }[] = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "square", label: "Square" },
];

const PROGRESS_STYLES: { value: SurveyTheme["progressBarStyle"]; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "dots", label: "Dots" },
  { value: "fraction", label: "Fraction" },
  { value: "hidden", label: "Hidden" },
];

// Curated brand-adjacent palette (2 rows of 6)
const COLOR_PALETTE = [
  "#121C8A", "#2563EB", "#0891B2", "#059669", "#65A30D", "#CA8A04",
  "#DC2626", "#E11D48", "#9333EA", "#7C3AED", "#18181B", "#6B7280",
];

export function ThemeEditor({ theme, onUpdate, isLocked }: ThemeEditorProps) {
  const updateField = useCallback(
    <K extends keyof SurveyTheme>(key: K, value: SurveyTheme[K]) => {
      onUpdate({ ...theme, [key]: value });
    },
    [theme, onUpdate]
  );

  return (
    <div className="space-y-5">
      {/* Preset themes */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">
          Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(THEME_PRESETS).map(([name, preset]) => {
            const isActive =
              theme.primaryColor === preset.primaryColor &&
              theme.backgroundColor === preset.backgroundColor &&
              theme.textColor === preset.textColor;
            return (
              <button
                key={name}
                onClick={() => onUpdate(preset)}
                disabled={isLocked}
                className={`text-left rounded-lg border p-2 transition-colors ${
                  isActive
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {/* Mini preview */}
                <div
                  className="h-10 rounded-md mb-1.5 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: preset.backgroundColor }}
                >
                  <div
                    className="text-[8px] font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: preset.primaryColor,
                      color: preset.backgroundColor,
                    }}
                  >
                    Button
                  </div>
                </div>
                <span className="text-xs font-medium">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color pickers */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-2">
          Colors
        </label>
        <div className="space-y-3">
          {COLOR_FIELDS.map(({ key, label }) => (
            <ColorPicker
              key={key}
              label={label}
              value={theme[key] as string}
              onChange={(v) => updateField(key, v as SurveyTheme[typeof key])}
              disabled={isLocked}
            />
          ))}
        </div>
      </div>

      {/* Button style */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Button Style
        </label>
        <div className="flex gap-1">
          {BUTTON_STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => updateField("buttonStyle", s.value)}
              disabled={isLocked}
              className={`px-3 py-1.5 text-xs transition-colors ${
                theme.buttonStyle === s.value
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{
                borderRadius:
                  s.value === "pill" ? "9999px" : s.value === "square" ? "4px" : "6px",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar style */}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Progress Bar
        </label>
        <div className="flex gap-1">
          {PROGRESS_STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => updateField("progressBarStyle", s.value)}
              disabled={isLocked}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                theme.progressBarStyle === s.value
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reset button */}
      {!isLocked && (
        <button
          onClick={() => onUpdate(DEFAULT_THEME)}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Reset to Storyline defaults
        </button>
      )}

      {/* WCAG contrast warning */}
      <ContrastWarning
        bg={theme.backgroundColor}
        text={theme.textColor}
        primary={theme.primaryColor}
        onFix={(fixes) => onUpdate({ ...theme, ...fixes })}
        isLocked={isLocked}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color picker with palette + hex input
// ─────────────────────────────────────────────────────────────────────────────

function ColorPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [hexInput, setHexInput] = useState(value);

  const handleHexChange = (hex: string) => {
    setHexInput(hex);
    if (hexRegex.test(hex)) {
      onChange(hex);
    }
  };

  // Sync when value changes externally (preset selection)
  if (hexRegex.test(value) && value !== hexInput && hexRegex.test(hexInput)) {
    setHexInput(value);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-foreground w-20">{label}</span>
        {/* Native color picker */}
        <input
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHexInput(e.target.value);
          }}
          disabled={disabled}
          className="w-7 h-7 rounded border border-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed p-0"
        />
        {/* Hex input */}
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          disabled={disabled}
          maxLength={7}
          className={`w-20 rounded-md border bg-background px-2 py-1 text-xs font-mono ${
            hexRegex.test(hexInput) ? "border-input" : "border-destructive/50"
          } disabled:opacity-50`}
          placeholder="#000000"
        />
      </div>
      {/* Palette swatches */}
      <div className="flex gap-1 ml-[84px]">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => {
              onChange(color);
              setHexInput(color);
            }}
            disabled={disabled}
            className={`w-4 h-4 rounded-sm border transition-transform ${
              value === color ? "border-foreground scale-110" : "border-border"
            } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WCAG contrast checker
// ─────────────────────────────────────────────────────────────────────────────

function ContrastWarning({
  bg,
  text,
  primary,
  onFix,
  isLocked,
}: {
  bg: string;
  text: string;
  primary: string;
  onFix: (fixes: Partial<SurveyTheme>) => void;
  isLocked: boolean;
}) {
  const textRatio = contrastRatio(bg, text);
  const primaryRatio = contrastRatio(bg, primary);
  const issues: string[] = [];

  if (textRatio < 4.5) issues.push(`Text contrast ${textRatio.toFixed(1)}:1 (needs 4.5:1)`);
  if (primaryRatio < 3) issues.push(`Primary contrast ${primaryRatio.toFixed(1)}:1 (needs 3:1)`);

  if (issues.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
      <p className="text-xs font-medium text-amber-800 mb-1">Low contrast warning</p>
      {issues.map((issue) => (
        <p key={issue} className="text-[10px] text-amber-600">{issue}</p>
      ))}
      {!isLocked && (
        <button
          onClick={() => {
            const fixes: Partial<SurveyTheme> = {};
            if (textRatio < 4.5) {
              fixes.textColor = nudgeContrast(bg, text, 4.5);
            }
            if (primaryRatio < 3) {
              fixes.primaryColor = nudgeContrast(bg, primary, 3);
            }
            onFix(fixes);
          }}
          className="text-[10px] text-amber-700 font-medium hover:underline mt-1"
        >
          Auto-fix contrast
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color contrast utilities
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Nudge a foreground color to meet a target contrast ratio against a background */
function nudgeContrast(bg: string, fg: string, targetRatio: number): string {
  const bgLum = relativeLuminance(bg);
  const fgLum = relativeLuminance(fg);
  const isDarker = fgLum < bgLum;

  const [r, g, b] = hexToRgb(fg);

  // Nudge in steps toward black or white
  for (let i = 1; i <= 30; i++) {
    const factor = isDarker ? 1 - i * 0.03 : 1 + i * 0.03;
    const nr = Math.max(0, Math.min(255, r * factor));
    const ng = Math.max(0, Math.min(255, g * factor));
    const nb = Math.max(0, Math.min(255, b * factor));
    const candidate = rgbToHex(nr, ng, nb);
    if (contrastRatio(bg, candidate) >= targetRatio) {
      return candidate;
    }
  }

  // Fallback: use black or white
  return isDarker ? "#000000" : "#FFFFFF";
}
