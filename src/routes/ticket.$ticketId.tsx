import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { BellRing, CheckCircle2, Clock, DoorOpen, Loader2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/public-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useQueueSignal } from "@/hooks/use-queue-signal";
import { clearTicket, type QueueStatus } from "@/lib/queue";
import { cn } from "@/lib/utils";

interface TicketInfo {
  code: string;
  status: QueueStatus;
  patient_name: string;
  doctor_name: string;
  doctor_specialty: string;
  room: string;
  ahead: number;
  now_serving: string | null;
  is_today: boolean;
}

export const Route = createFileRoute("/ticket/$ticketId")({
  validateSearch: (search: Record<string, unknown>): { t: string } => ({
    t: typeof search["t"] === "string" ? search["t"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Your queue number — ClinicQueue" },
      { name: "description", content: "Live status of your place in the clinic queue." },
      { property: "og:title", content: "Your queue number — ClinicQueue" },
      {
        property: "og:description",
        content: "See your number and how many people are ahead of you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { ticketId } = Route.useParams();
  const { t } = Route.useSearch();

  const ticket = useQuery({
    queryKey: ["ticket", ticketId, t],
    enabled: !!t,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ticket", { _ticket_id: ticketId, _token: t });
      if (error) throw error;
      return (data as unknown as TicketInfo | null) ?? null;
    },
  });

  useQueueSignal(() => ticket.refetch(), 20000);

  // Gentle buzz when it becomes the patient's turn
  const prevStatus = useRef<QueueStatus | null>(null);
  useEffect(() => {
    const s = ticket.data?.status ?? null;
    if (prevStatus.current && prevStatus.current !== "called" && s === "called") {
      navigator.vibrate?.([300, 150, 300]);
    }
    prevStatus.current = s;
  }, [ticket.data?.status]);

  const info = ticket.data;

  return (
    <div className="min-h-screen bg-hero">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-2">
        {ticket.isLoading ? (
          <div className="grid place-items-center py-24 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : !info ? (
          <div className="rounded-3xl border bg-card p-8 text-center shadow-soft">
            <h1 className="text-2xl font-bold">Ticket not found</h1>
            <p className="mt-2 text-muted-foreground">
              This link may be incomplete or out of date.
            </p>
            <Button asChild variant="hero" className="mt-6">
              <Link to="/">Get a new number</Link>
            </Button>
          </div>
        ) : (
          <TicketCard info={info} />
        )}
      </main>
    </div>
  );
}

function TicketCard({ info }: { info: TicketInfo }) {
  const isCalled = info.status === "called";
  const finished = info.status === "done" || info.status === "skipped";

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] border bg-card shadow-lift",
          isCalled && "border-signal animate-ring-pulse",
        )}
      >
        <div
          className={cn(
            "px-6 pb-8 pt-6 text-center",
            isCalled ? "bg-signal text-signal-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <div className="flex items-center justify-between gap-3 text-sm opacity-90">
            <span className="min-w-0 truncate">Hi, {info.patient_name.split(" ")[0]}</span>
            <span className="shrink-0">{info.is_today ? "Today" : "Previous day"}</span>
          </div>
          <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] opacity-80">
            Your number
          </p>
          <p
            key={info.status}
            className="ticket-number mt-2 animate-pop-in text-[6.5rem] sm:text-[7.5rem]"
          >
            {info.code}
          </p>
        </div>

        {/* perforation */}
        <div className="relative h-0 border-t-2 border-dashed border-border">
          <span className="absolute -left-4 -top-4 size-8 rounded-full bg-background" />
          <span className="absolute -right-4 -top-4 size-8 rounded-full bg-background" />
        </div>

        <div className="space-y-5 p-6">
          {!info.is_today ? (
            <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
              <Clock className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-bold">This number has expired</p>
                <p className="text-sm text-muted-foreground">
                  Queue numbers reset every day. Please get a new number on the home page.
                </p>
              </div>
            </div>
          ) : isCalled ? (
            <div className="flex items-start gap-3 rounded-2xl bg-signal-soft p-4 text-signal-foreground">
              <BellRing className="mt-0.5 size-6 shrink-0" />
              <div>
                <p className="text-lg font-bold">It's your turn!</p>
                <p className="text-sm">
                  Please go to {info.room ? `Room ${info.room}` : "the doctor's room"} —{" "}
                  {info.doctor_name}.
                </p>
              </div>
            </div>
          ) : finished ? (
            <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" />
              <div>
                <p className="font-bold">
                  {info.status === "done" ? "Visit completed" : "Your number was skipped"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {info.status === "done"
                    ? "Thank you for visiting. Get well soon!"
                    : "Please speak to the front desk if you're still here."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-secondary p-4">
                <Users className="size-5 text-primary" />
                <p className="ticket-number mt-3 text-5xl">{info.ahead}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {info.ahead === 1 ? "person ahead" : "people ahead"}
                </p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <Clock className="size-5 text-primary" />
                <p className="ticket-number mt-3 text-5xl">{info.now_serving ?? "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Now serving</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <DoorOpen className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{info.doctor_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[info.doctor_specialty, info.room && `Room ${info.room}`]
                    .filter(Boolean)
                    .join(" · ") || "General"}
                </p>
              </div>
            </div>
            {info.is_today ? (
              <StatusBadge status={info.status} />
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Expired
              </span>
            )}{" "}
          </div>
        </div>
      </div>

      {!finished && info.is_today && (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <span className="size-2 animate-glow-pulse rounded-full bg-success" />
          Updates automatically — keep this page open.
        </p>
      )}
      {finished && (
        <Button asChild variant="outline" className="w-full" onClick={() => clearTicket()}>
          <Link to="/">Register again</Link>
        </Button>
      )}
    </div>
  );
}
