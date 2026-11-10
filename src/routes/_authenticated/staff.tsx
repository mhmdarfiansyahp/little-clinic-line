import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Check,
  ChevronDown,
  Loader2,
  Megaphone,
  Phone,
  RotateCcw,
  SkipForward,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useQueueSignal } from "@/hooks/use-queue-signal";
import { clinicDate, minutesSince, type QueueStatus } from "@/lib/queue";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Queue console — ClinicQueue" },
      { name: "description", content: "Call, finish and skip patients in today's queue." },
      { property: "og:title", content: "Queue console — ClinicQueue" },
      { property: "og:description", content: "Manage today's patient queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffConsole,
});

const DOCTOR_KEY = "clinicqueue.staff.doctor";

interface Entry {
  id: string;
  code: string;
  number: number;
  patient_name: string;
  phone: string;
  doctor_id: string;
  status: QueueStatus;
  created_at: string;
  called_at: string | null;
  finished_at: string | null;
}

function StaffConsole() {
  const { isAdmin } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [, setTick] = useState(0);

  const doctors = useQuery({
    queryKey: ["staff-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialty, room, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const entries = useQuery({
    queryKey: ["staff-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queue_entries")
        .select("id, code, number, patient_name, phone, doctor_id, status, created_at, called_at, finished_at")
        .eq("queue_date", clinicDate())
        .order("number");
      if (error) throw error;
      return data as Entry[];
    },
  });

  useQueueSignal(() => {
    qc.invalidateQueries({ queryKey: ["staff-entries"] });
    qc.invalidateQueries({ queryKey: ["staff-doctors"] });
  });

  // refresh "waited X min" labels
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60000);
    return () => window.clearInterval(t);
  }, []);

  // remember the selected doctor on this device
  useEffect(() => {
    const list = doctors.data;
    if (!list?.length) return;
    const saved = window.localStorage.getItem(DOCTOR_KEY);
    setDoctorId((cur) => {
      if (cur && list.some((d) => d.id === cur)) return cur;
      if (saved && list.some((d) => d.id === saved)) return saved;
      return list[0]!.id;
    });
  }, [doctors.data]);

  function selectDoctor(id: string) {
    setDoctorId(id);
    window.localStorage.setItem(DOCTOR_KEY, id);
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff-entries"] });

  const callNext = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("call_next", { _doctor_id: id });
      if (error) throw error;
      return data as { code: string; patient_name: string } | null;
    },
    onSuccess: (res) => {
      if (res) toast.success(`Calling ${res.code} — ${res.patient_name}`);
      else toast("No one is waiting for this doctor.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QueueStatus }) => {
      const { error } = await supabase.rpc("set_entry_status", { _entry_id: id, _status: status });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const all = entries.data ?? [];
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all) if (e.status === "waiting") m.set(e.doctor_id, (m.get(e.doctor_id) ?? 0) + 1);
    return m;
  }, [all]);

  const mine = all.filter((e) => e.doctor_id === doctorId);
  const current = mine
    .filter((e) => e.status === "called")
    .sort((a, b) => (b.called_at ?? "").localeCompare(a.called_at ?? ""))[0];
  const waiting = mine.filter((e) => e.status === "waiting");
  const finished = mine
    .filter((e) => e.status === "done" || e.status === "skipped")
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
  const doctor = doctors.data?.find((d) => d.id === doctorId);
  const busy = callNext.isPending || setStatus.isPending;

  if (doctors.isLoading || entries.isLoading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!doctors.data?.length) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center shadow-soft">
        <h1 className="text-2xl font-bold">No doctors yet</h1>
        <p className="mt-2 text-muted-foreground">
          {isAdmin ? "Add a doctor so patients can start registering." : "Ask your admin to add doctors."}
        </p>
        {isAdmin && (
          <Button asChild variant="hero" className="mt-6">
            <Link to="/admin/doctors">Add doctors</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Today's queue</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} registered · {all.filter((e) => e.status === "waiting").length} waiting
          </p>
        </div>
      </div>

      {/* doctor picker */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {doctors.data.map((d) => (
          <button
            key={d.id}
            onClick={() => selectDoctor(d.id)}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition",
              d.id === doctorId ? "border-primary bg-primary text-primary-foreground shadow-soft" : "bg-card hover:bg-muted",
            )}
          >
            <span>
              <span className="block text-sm font-semibold">{d.name}</span>
              <span className={cn("block text-xs", d.id === doctorId ? "opacity-80" : "text-muted-foreground")}>
                {d.room ? `Room ${d.room}` : d.specialty || "General"}
              </span>
            </span>
            <span
              className={cn(
                "grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs font-bold",
                d.id === doctorId ? "bg-primary-foreground/20" : "bg-secondary text-secondary-foreground",
              )}
            >
              {counts.get(d.id) ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* now serving */}
        <section className="space-y-4">
          <div className="overflow-hidden rounded-3xl border bg-card shadow-lift">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-sm font-semibold text-muted-foreground">Now serving · {doctor?.name}</p>
              {current && <StatusBadge status="called" />}
            </div>
            {current ? (
              <div className="p-5">
                <p key={current.id} className="ticket-number animate-pop-in text-7xl text-primary">
                  {current.code}
                </p>
                <p className="mt-3 text-xl font-semibold">{current.patient_name}</p>
                <a href={`tel:${current.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <Phone className="size-3.5" /> {current.phone}
                </a>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Button variant="success" disabled={busy} onClick={() => setStatus.mutate({ id: current.id, status: "done" })}>
                    <Check /> Done
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => setStatus.mutate({ id: current.id, status: "skipped" })}>
                    <UserRoundX /> Skip
                  </Button>
                  <Button variant="soft" disabled={busy} onClick={() => setStatus.mutate({ id: current.id, status: "called" })}>
                    <Megaphone /> Recall
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <p className="ticket-number text-7xl text-border">—</p>
                <p className="mt-3 text-muted-foreground">No patient is being served.</p>
              </div>
            )}
          </div>

          <Button
            variant="signal"
            size="xl"
            className="h-16 w-full text-lg"
            disabled={busy || waiting.length === 0 || !doctorId}
            onClick={() => doctorId && callNext.mutate(doctorId)}
          >
            {callNext.isPending ? <Loader2 className="animate-spin" /> : <BellRing />}
            {waiting.length === 0 ? "No one waiting" : `Call next · ${waiting[0]?.code ?? ""}`}
          </Button>
          {current && waiting.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Calling next marks {current.code} as done.
            </p>
          )}
        </section>

        {/* waiting list */}
        <section className="space-y-4">
          <div className="rounded-3xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="font-display text-lg font-semibold">Waiting</h2>
              <span className="text-sm text-muted-foreground">{waiting.length}</span>
            </div>
            {waiting.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">The waiting list is empty.</p>
            ) : (
              <ul className="divide-y">
                {waiting.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={cn("ticket-number w-16 text-2xl", i === 0 ? "text-primary" : "text-foreground")}>
                      {e.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.patient_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.phone} · waiting {minutesSince(e.created_at)} min
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="soft" disabled={busy} onClick={() => setStatus.mutate({ id: e.id, status: "called" })}>
                        <BellRing /> <span className="hidden sm:inline">Call</span>
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus.mutate({ id: e.id, status: "skipped" })} aria-label={`Skip ${e.code}`}>
                        <SkipForward />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border bg-card shadow-soft">
            <button
              className="flex w-full items-center justify-between px-5 py-3"
              onClick={() => setShowFinished((s) => !s)}
            >
              <h2 className="font-display text-lg font-semibold">Finished & skipped</h2>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {finished.length}
                <ChevronDown className={cn("size-4 transition", showFinished && "rotate-180")} />
              </span>
            </button>
            {showFinished && finished.length > 0 && (
              <ul className="divide-y border-t">
                {finished.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="ticket-number w-16 text-xl text-muted-foreground">{e.code}</span>
                    <p className="min-w-0 flex-1 truncate text-sm">{e.patient_name}</p>
                    <StatusBadge status={e.status} />
                    {e.status === "skipped" && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus.mutate({ id: e.id, status: "waiting" })}>
                        <RotateCcw /> <span className="hidden sm:inline">Back to queue</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
