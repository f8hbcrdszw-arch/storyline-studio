import type { SurveyTheme } from "@/lib/types/json-fields";

/**
 * Server Component that injects CSS custom property overrides for survey theming.
 * Zero JS runtime cost — renders a <style> tag with validated hex colors.
 *
 * The survey components already use Tailwind semantic tokens (bg-background,
 * text-foreground, bg-primary, etc.) which map to CSS variables. This component
 * overrides those variables on a scoped wrapper to apply per-study branding.
 */
export function SurveyThemeProvider({
  theme,
  children,
}: {
  theme?: SurveyTheme | null;
  children: React.ReactNode;
}) {
  if (!theme) {
    return <>{children}</>;
  }

  // Validate hex colors before injecting (XSS prevention)
  const hexRegex = /^#[0-9a-fA-F]{6}$/;
  const safeColor = (color: string, fallback: string) =>
    hexRegex.test(color) ? color : fallback;

  const primary = safeColor(theme.primaryColor, "#121C8A");
  const bg = safeColor(theme.backgroundColor, "#F4F3EF");
  const text = safeColor(theme.textColor, "#100C21");
  const accent = safeColor(theme.accentColor, "#121C8A");

  // Derive muted/border colors from the background
  // Slightly darken bg for muted, more for border
  const mutedBg = mixColor(bg, text, 0.04);
  const borderColor = mixColor(bg, text, 0.08);
  const mutedFg = mixColor(bg, text, 0.45);

  // Button border-radius based on style
  const buttonRadius =
    theme.buttonStyle === "pill"
      ? "9999px"
      : theme.buttonStyle === "square"
        ? "4px"
        : ""; // "rounded" uses the default

  const css = `
    .survey-themed {
      --background: ${bg};
      --foreground: ${text};
      --primary: ${primary};
      --primary-foreground: ${contrastForeground(primary)};
      --muted: ${mutedBg};
      --muted-foreground: ${mutedFg};
      --border: ${borderColor};
      --input: ${borderColor};
      --ring: ${accent};
      --accent: ${mutedBg};
      --accent-foreground: ${text};
      --card: ${bg};
      --card-foreground: ${text};
      --popover: ${bg};
      --popover-foreground: ${text};
      --secondary: ${mutedBg};
      --secondary-foreground: ${text};
      ${buttonRadius ? `--radius: ${buttonRadius};` : ""}
    }
  `;

  return (
    <div className="survey-themed" data-theme-active="">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color utilities (pure functions, no dependencies)
// ─────────────────────────────────────────────────────────────────────────────

/** Parse hex to RGB */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** RGB to hex */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Mix two hex colors by a ratio (0 = color1, 1 = color2) */
function mixColor(hex1: string, hex2: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(
    Math.round(r1 + (r2 - r1) * ratio),
    Math.round(g1 + (g2 - g1) * ratio),
    Math.round(b1 + (b2 - b1) * ratio)
  );
}

/** Get a contrasting foreground (white or dark) for a given background */
function contrastForeground(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  // Relative luminance (simplified)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? "#100C21" : "#F4F3EF";
}
