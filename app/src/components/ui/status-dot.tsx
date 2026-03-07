import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  ACTIVE:    { dot: "status-dot-active",   label: "Active" },
  DRAFT:     { dot: "status-dot-draft",    label: "Draft" },
  PAUSED:    { dot: "status-dot-paused",   label: "Paused" },
  CLOSED:    { dot: "status-dot-closed",   label: "Closed" },
  ARCHIVED:  { dot: "status-dot-archived", label: "Archived" },
  COMPLETED: { dot: "status-dot-archived", label: "Completed" },
};

export function StatusDot({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] || { dot: "status-dot-archived", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      <span className={cn("status-dot", config.dot)} />
      {config.label}
    </span>
  );
}
