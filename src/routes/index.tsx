import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowRight, Check, Loader2, Stethoscope, Ticket } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { clinicDate, loadTodayTicket, saveTicket, type SavedTicket } from "@/lib/queue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Get your queue number — ClinicQueue" },
      {
        name: "description",
        content: "Register with your name and phone, choose your doctor and get a queue number in seconds.",
      },
      { property: "og:title", content: "Get your queue number — ClinicQueue" },
      {
        property: "og:description",
        content: "Register, get a number and see how many people are ahead of you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100, "Name is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+() -]{6,20}$/, "Please enter a valid phone number"),
  doctorId: z.string().uuid("Please choose a doctor"),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<SavedTicket | null>(null);

  useEffect(() => setExisting(loadTodayTicket()), []);

  const doctors = useQuery({
    queryKey: ["public-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialty, room")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, phone, doctorId });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { data, error } = await supabase.rpc("register_patient", {
      _name: parsed.data.name,
      _phone: parsed.data.phone,
      _doctor_id: parsed.data.doctorId,
    });
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not register. Please try again.");
      return;
    }
    const t = data as { ticket_id: string; access_token: string; code: string };
    saveTicket({ id: t.ticket_id, token: t.access_token, code: t.code, date: clinicDate() });
    navigate({ to: "/ticket/$ticketId", params: { ticketId: t.ticket_id }, search: { t: t.access_token } });
  }

  return (
    <div className="min-h-screen bg-hero">
      <PublicHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-4 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-16 lg:pt-12">
        <section className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-soft">
            <span className="size-1.5 animate-glow-pulse rounded-full bg-success" /> Open today
          </span>
          <h1 className="mt-5 text-5xl font-bold leading-[0.95] sm:text-6xl lg:text-7xl">
            Take a number.
            <br />
            <span className="text-primary">Skip the line.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Register in a few seconds, then relax. Your phone shows your number and how many people
            are ahead of you.
          </p>
          <ol className="mt-8 hidden gap-4 text-sm sm:grid sm:grid-cols-3 lg:max-w-lg">
            {["Fill in your details", "Get your number", "Wait to be called"].map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card font-display font-bold text-primary shadow-soft">
                  {i + 1}
                </span>
                <span className="font-medium">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          {existing && (
            <Link
              to="/ticket/$ticketId"
              params={{ ticketId: existing.id }}
              search={{ t: existing.token }}
              className="flex items-center gap-4 rounded-2xl border border-signal/40 bg-signal-soft p-4 shadow-soft transition hover:shadow-lift"
            >
              <Ticket className="size-6 text-signal-foreground" />
              <div className="flex-1">
                <p className="text-sm text-signal-foreground/80">You already have a number today</p>
                <p className="ticket-number text-2xl text-signal-foreground">{existing.code}</p>
              </div>
              <ArrowRight className="size-5 text-signal-foreground" />
            </Link>
          )}

          <form
            onSubmit={onSubmit}
            className="rounded-3xl border bg-card p-6 shadow-lift sm:p-8"
            noValidate
          >
            <h2 className="text-2xl font-bold">Register for a visit</h2>
            <p className="mt-1 text-sm text-muted-foreground">Numbers reset every morning.</p>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl text-base"
                  placeholder="e.g. Somchai Jaidee"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl text-base"
                  placeholder="e.g. 081 234 5678"
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Doctor</legend>
                {doctors.isLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading doctors…
                  </div>
                ) : doctors.data && doctors.data.length > 0 ? (
                  <div className="grid gap-2">
                    {doctors.data.map((d) => {
                      const selected = doctorId === d.id;
                      return (
                        <button
                          type="button"
                          key={d.id}
                          onClick={() => setDoctorId(d.id)}
                          aria-pressed={selected}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                            selected
                              ? "border-primary bg-primary-soft ring-1 ring-primary"
                              : "hover:border-ring/50 hover:bg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-lg",
                              selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                            )}
                          >
                            {selected ? <Check className="size-5" /> : <Stethoscope className="size-5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{d.name}</span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {[d.specialty, d.room && `Room ${d.room}`].filter(Boolean).join(" · ") ||
                                "General"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                    No doctors are available right now. Please ask at the front desk.
                  </p>
                )}
                {errors.doctorId && <p className="text-sm text-destructive">{errors.doctorId}</p>}
              </fieldset>
            </div>

            <Button type="submit" variant="hero" size="xl" className="mt-7 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Ticket />}
              Get my queue number
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Your phone number is only used by clinic staff to reach you.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
