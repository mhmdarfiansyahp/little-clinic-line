import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ListOrdered, LogOut, Stethoscope, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRows ?? []).map((r) => r.role);
    return { user, roles, isAdmin: roles.includes("admin") };
  },
  component: StaffLayout,
});

function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

const navItem =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground";
const navActive = "bg-primary-soft text-accent-foreground";

function StaffLayout() {
  const { user, roles, isAdmin } = useRouteContext({ from: "/_authenticated" });
  const signOut = useSignOut();

  if (roles.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero px-5">
        <div className="max-w-sm rounded-3xl border bg-card p-8 text-center shadow-soft">
          <h1 className="text-2xl font-bold">No access yet</h1>
          <p className="mt-2 text-muted-foreground">
            {user.email} isn't a clinic staff account. Ask your admin to add you.
          </p>
          <Button variant="outline" className="mt-6" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Brand to="/staff" />
          <div className="flex items-center gap-2">
            <span className="hidden text-right text-xs leading-tight text-muted-foreground sm:block">
              <span className="block font-medium text-foreground">{user.email}</span>
              {isAdmin ? "Admin" : "Staff"}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut />
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          <Link to="/staff" className={navItem} activeProps={{ className: cn(navItem, navActive) }}>
            <ListOrdered className="size-4" /> Queue
          </Link>
          {isAdmin && (
            <>
              <Link to="/admin/doctors" className={navItem} activeProps={{ className: cn(navItem, navActive) }}>
                <Stethoscope className="size-4" /> Doctors
              </Link>
              <Link to="/admin/staff" className={navItem} activeProps={{ className: cn(navItem, navActive) }}>
                <Users className="size-4" /> Staff accounts
              </Link>
            </>
          )}
          <a href="/display" target="_blank" rel="noreferrer" className={navItem}>
            <ExternalLink className="size-4" /> Waiting room screen
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
