---
title: Implement Wordmark component with brand-compliant Items font family
date: 2026-03-07
category: ui-bugs
tags: [branding, wordmark, typography, fonts, components, brand-identity]
module: Brand/UI Components
severity: medium
symptoms:
  - Plain-text "Storyline Studio" displayed across admin layout, home page, login page, and survey footer
  - Missing therefore mark (∴) symbol required by brand guide
  - Incorrect font weights for sub-brand distinction (Studio should be Items Medium)
  - No reusable wordmark component for consistent brand application
root_cause: Brand guide specifications (∴ symbol, Items font family, Medium weight for product names) were not implemented; wordmark rendered as plain text
status: completed
---

# Wordmark Component & Branding System

## Problem

The Storyline Studio app displayed "Storyline Studio" as plain text across 4 locations (admin layout header, home page hero, login page, survey footer). The brand guide specifies:

- A **∴ (therefore mark)** as the logo symbol
- **Items Light** for the "Storyline" brand name
- **Items Medium** for product names like "Studio" to create visual sub-brand distinction
- Consistent optical alignment of the ∴ mark relative to text baseline

None of this was implemented — just plain `<h1>` and `<h2>` tags with no brand differentiation.

## Root Cause

1. **No Wordmark component existed** — each page hardcoded the brand name as inline HTML
2. **Items Medium font weight not loaded** — `fonts.ts` only had Light (300) and Regular (400), missing Medium (500)
3. **No centralized brand presentation logic** — inconsistent styling across pages

## Solution

### Step 1: Load Items Medium Font

Copied `Items-Medium.woff2` from source fonts to `public/fonts/` and added weight 500 to `fonts.ts`:

```typescript
// src/app/fonts.ts
export const items = localFont({
  src: [
    { path: "../../public/fonts/Items-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/Items-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Items-Medium.woff2", weight: "500", style: "normal" },  // NEW
  ],
  variable: "--font-items",
  display: "optional",
});
```

### Step 2: Create Wordmark Component

```typescript
// src/components/ui/wordmark.tsx
import { cn } from "@/lib/utils";

type WordmarkSize = "sm" | "md" | "lg" | "xl";

const sizeStyles: Record<WordmarkSize, { mark: string; name: string; product: string; gap: string }> = {
  sm: { mark: "text-base leading-none", name: "text-base leading-none", product: "text-base leading-none", gap: "gap-[0.35em]" },
  md: { mark: "text-lg leading-none", name: "text-lg leading-none", product: "text-lg leading-none", gap: "gap-[0.35em]" },
  lg: { mark: "text-2xl leading-none", name: "text-2xl leading-none", product: "text-2xl leading-none", gap: "gap-[0.35em]" },
  xl: { mark: "text-4xl leading-none", name: "text-4xl leading-none", product: "text-4xl leading-none", gap: "gap-[0.4em]" },
};

export function Wordmark({ size = "md", product = "Studio", className }: {
  size?: WordmarkSize;
  product?: string;
  className?: string;
}) {
  const s = sizeStyles[size];
  return (
    <span className={cn("inline-flex items-baseline font-display tracking-tight", s.gap, className)}>
      <span className={cn(s.mark, "font-light select-none")}
        style={{ transform: "translateY(-0.04em)" }} aria-hidden="true">∴</span>
      <span className={cn(s.name, "font-light")}>Storyline</span>
      {product && <span className={cn(s.product, "font-medium")}>{product}</span>}
    </span>
  );
}
```

Key design decisions:
- `items-baseline` alignment keeps ∴ and text on the same baseline
- `translateY(-0.04em)` optically aligns the ∴ mark (three dots sit slightly high at baseline)
- `font-light` for "Storyline", `font-medium` for product name creates visual hierarchy
- `product` prop defaults to "Studio" but supports future sub-brands (e.g., `<Wordmark product="Insights" />`)
- `aria-hidden="true"` on ∴ since it's decorative

### Step 3: Replace All Instances

| Location | Size | Before | After |
|----------|------|--------|-------|
| Admin layout header | `md` | `<h2>Storyline Studio</h2>` | `<Wordmark size="md" />` |
| Home page hero | `xl` | `<h1>Storyline Studio</h1>` | `<Wordmark size="xl" />` |
| Login page | `lg` | `<h1>Storyline Studio</h1>` | `<Wordmark size="lg" />` |
| Survey footer | inline | `<p>Powered by Storyline</p>` | `Powered by ∴ Storyline` (inline Items font) |

## Files Changed

| File | Action | Details |
|------|--------|---------|
| `public/fonts/Items-Medium.woff2` | Added | Items Medium font file |
| `src/app/fonts.ts` | Modified | Added Items Medium (500) weight |
| `src/components/ui/wordmark.tsx` | Created | Reusable Wordmark component |
| `src/app/(admin)/admin/layout.tsx` | Modified | Replaced plain text with Wordmark |
| `src/app/page.tsx` | Modified | Replaced plain text with Wordmark |
| `src/app/login/page.tsx` | Modified | Replaced plain text with Wordmark |
| `src/app/(survey)/survey/[id]/components/SurveyShell.tsx` | Modified | Updated footer with ∴ mark |

## Prevention

- All new pages/components should use `<Wordmark />` instead of hardcoding brand text
- Future sub-brands use the `product` prop: `<Wordmark product="Insights" />`
- The `font-display` CSS class maps to Items font — use it for any display/headline text
- Brand colors defined in CSS: `--color-storyline-blue: oklch(0.303 0.19 270)`

## Related Documentation

- Brand guide: `Storyline_Graphic Standards_p1.pdf` (FODA Studio, Dec 2025)
- Font source files: `Web Fonts/items-v20-woff/` (full Items family)
- MEMORY.md: Brand identity section with colors, fonts, usage rules
- [Survey Preview System](../integration-issues/survey-preview-system.md) — related UI component work
