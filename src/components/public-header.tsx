import { Link } from "@tanstack/react-router";
import { Monitor, LogIn } from "lucide-react";
import { Brand } from "@/components/brand";

export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
      <Brand />
      <nav className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <Link
          to="/display"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-secondary hover:text-foreground"
        >
          <Monitor className="size-4" /> <span className="hidden sm:inline">Waiting room screen</span>
          <span className="sm:hidden">Screen</span>
        </Link>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-secondary hover:text-foreground"
        >
          <LogIn className="size-4" /> Staff
        </Link>
      </nav>
    </header>
  );
}
