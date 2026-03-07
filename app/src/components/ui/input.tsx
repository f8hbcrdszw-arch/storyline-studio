import { cn } from "@/lib/utils"
import { forwardRef } from "react"

const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-lg border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground/60",
        "hover:border-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error
          ? "border-destructive focus-visible:ring-destructive/20"
          : "border-input",
        className
      )}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
