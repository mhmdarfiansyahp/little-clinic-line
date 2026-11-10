import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in — ClinicQueue" },
      { name: "description", content: "Clinic staff sign in to manage the patient queue." },
      { property: "og:title", content: "Staff sign in — ClinicQueue" },
      { property: "og:description", content: "Sign in to manage today's patient queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/staff", replace: true });
    });
  }, [navigate]);

  const adminExists = useQuery({
    queryKey: ["admin-exists"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_exists");
      if (error) throw error;
      return data;
    },
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      return;
    }
    navigate({ to: "/staff", replace: true });
  }

  return (
    <div className="min-h-screen bg-hero">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-6 sm:pt-12">
        <form onSubmit={onSubmit} className="rounded-3xl border bg-card p-6 shadow-lift sm:p-8">
          <h1 className="text-3xl font-bold">Staff sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the account your clinic admin gave you.</p>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
          </div>
          <Button type="submit" variant="hero" size="xl" className="mt-6 w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Forgot your password? Ask your clinic admin to reset it.
          </p>
        </form>

        {adminExists.data === false && (
          <div className="mt-4 rounded-2xl border border-dashed border-primary/40 bg-primary-soft p-4 text-sm">
            <p className="font-semibold">First time here?</p>
            <p className="text-muted-foreground">No admin account exists yet.</p>
            <Link to="/setup" className="mt-2 inline-block font-semibold text-primary underline-offset-4 hover:underline">
              Set up your clinic →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
