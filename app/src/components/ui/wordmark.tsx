import { cn } from "@/lib/utils";

type WordmarkSize = "sm" | "md" | "lg" | "xl";

const sizeStyles: Record<WordmarkSize, { mark: string; name: string; product: string; gap: string }> = {
  sm: { mark: "text-base leading-none", name: "text-base leading-none", product: "text-base leading-none", gap: "gap-[0.35em]" },
  md: { mark: "text-lg leading-none", name: "text-lg leading-none", product: "text-lg leading-none", gap: "gap-[0.35em]" },
  lg: { mark: "text-2xl leading-none", name: "text-2xl leading-none", product: "text-2xl leading-none", gap: "gap-[0.35em]" },
  xl: { mark: "text-4xl leading-none", name: "text-4xl leading-none", product: "text-4xl leading-none", gap: "gap-[0.4em]" },
};

export function Wordmark({
  size = "md",
  product = "Studio",
  className,
}: {
  size?: WordmarkSize;
  product?: string;
  className?: string;
}) {
  const s = sizeStyles[size];

  return (
    <span
      className={cn(
        "inline-flex items-baseline font-display tracking-tight",
        s.gap,
        className
      )}
    >
      {/* Therefore mark — slightly smaller, optically aligned */}
      <span
        className={cn(s.mark, "font-light select-none")}
        style={{ transform: "translateY(-0.04em)" }}
        aria-hidden="true"
      >
        ∴
      </span>
      {/* Brand name */}
      <span className={cn(s.name, "font-light")}>Storyline</span>
      {/* Product name — Items Medium for sub-brand distinction */}
      {product && (
        <span className={cn(s.product, "font-medium")}>{product}</span>
      )}
    </span>
  );
}
