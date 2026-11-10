import { cn } from "@/lib/utils";
import { statusLabel, type QueueStatus } from "@/lib/queue";

const styles: Record<QueueStatus, string> = {
  waiting: "bg-secondary text-secondary-foreground",
  called: "bg-signal-soft text-signal-foreground",
  done: "bg-success-soft text-success",
  skipped: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: QueueStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[status],
        className,
      )}
    >
      {statusLabel[status]}
    </span>
  );
}
