import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      A1
    </span>
  );
}

export function Brand({ to = "/" }: { to?: "/" | "/staff" }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-lg font-semibold tracking-tight">ClinicQueue</span>
    </Link>
  );
}
