import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createFirstAdmin } from "@/lib/setup.functions";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Set up your clinic — ClinicQueue" },
      { name: "description", content: "Create the first admin account for ClinicQueue." },
      { property: "og:title", content: "Set up your clinic — ClinicQueue" },
      { property: "og:description", content: "Create the first admin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const createAdmin = useServerFn(createFirstAdmin);
  const [fullName, setFullName] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      await createAdmin({ data: { setupCode, fullName, email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success("Clinic set up! Add your doctors next.");
      navigate({ to: "/admin/doctors", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Setup failed.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-6 sm:pt-12">
        {adminExists.isLoading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : adminExists.data ? (
          <div className="rounded-3xl border bg-card p-8 text-center shadow-soft">
            <h1 className="text-2xl font-bold">Already set up</h1>
            <p className="mt-2 text-muted-foreground">This clinic already has an admin.</p>
            <Button asChild variant="hero" className="mt-6">
              <Link to="/auth">Go to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-3xl border bg-card p-6 shadow-lift sm:p-8">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <ShieldCheck className="size-6" />
            </span>
            <h1 className="mt-4 text-3xl font-bold">Set up your clinic</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the first admin account. You can add doctors and staff afterwards.
            </p>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setupCode">Setup code</Label>
                <Input
                  id="setupCode"
                  type="password"
                  required
                  autoComplete="off"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Given to you by whoever deployed ClinicQueue.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Your name</Label>
                <Input
                  id="fullName"
                  required
                  maxLength={100}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
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
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
            </div>
            {formError && (
              <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </p>
            )}
            <Button
              type="submit"
              variant="hero"
              size="xl"
              className="mt-6 w-full"
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin" />} Create admin account
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
