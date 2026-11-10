import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Maximize, Volume2, VolumeX } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useQueueSignal } from "@/hooks/use-queue-signal";
import { cn } from "@/lib/utils";

interface Board {
  last_called: { code: string; doctor_name: string; room: string; called_at: string } | null;
  doctors: {
    id: string;
    name: string;
    specialty: string;
    room: string;
    current_code: string | null;
    waiting_count: number;
    next_codes: string[];
  }[];
}

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "Now calling — ClinicQueue waiting room" },
      { name: "description", content: "Live waiting-room screen showing the number currently being called." },
      { property: "og:title", content: "Now calling — ClinicQueue" },
      { property: "og:description", content: "Live waiting-room queue display." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisplayPage,
});

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.45;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1);
    });
    window.setTimeout(() => ctx.close(), 2000);
  } catch {
    /* sound not available */
  }
}

function DisplayPage() {
  const board = useQuery({
    queryKey: ["queue-board"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_queue_board");
      if (error) throw error;
      return data as unknown as Board;
    },
  });
  useQueueSignal(() => board.refetch(), 15000);

  const now = useClock();
  const [sound, setSound] = useState(false);
  const last = board.data?.last_called ?? null;
  const callKey = last ? `${last.code}-${last.called_at}` : "none";

  const prevKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevKey.current !== null && prevKey.current !== callKey && last && sound) playChime();
    prevKey.current = callKey;
  }, [callKey, last, sound]);

  const doctors = board.data?.doctors ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-display bg-display-gradient text-display-foreground">
      <header className="flex items-center justify-between px-6 py-5 lg:px-12 lg:py-8">
        <div className="flex items-center gap-3">
          <BrandMark className="size-11 text-base" />
          <span className="font-display text-2xl font-semibold lg:text-3xl">ClinicQueue</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="display"
            size="sm"
            onClick={() => {
              setSound((s) => !s);
              if (!sound) playChime();
            }}
            aria-label={sound ? "Turn sound off" : "Turn sound on"}
          >
            {sound ? <Volume2 /> : <VolumeX />}
            <span className="hidden sm:inline">{sound ? "Sound on" : "Sound off"}</span>
          </Button>
          <Button
            variant="display"
            size="sm"
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Full screen"
          >
            <Maximize />
          </Button>
          <span className="ticket-number ml-2 text-3xl text-display-muted lg:text-5xl">
            {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 pb-8 lg:flex-row lg:gap-10 lg:px-12 lg:pb-12">
        <section className="flex flex-[1.4] flex-col items-center justify-center rounded-[2.5rem] border border-display-line bg-display-card/60 px-6 py-10 text-center">
          <p className="text-xl font-semibold uppercase tracking-[0.35em] text-display-muted lg:text-2xl">
            Now calling
          </p>
          {last ? (
            <>
              <p
                key={callKey}
                className="ticket-number text-display-glow mt-4 animate-pop-in text-[clamp(7rem,22vw,22rem)]"
              >
                {last.code}
              </p>
              <p className="mt-6 text-3xl font-semibold lg:text-5xl">
                {last.room ? `Room ${last.room}` : "Please proceed"}
              </p>
              <p className="mt-2 text-xl text-display-muted lg:text-3xl">{last.doctor_name}</p>
            </>
          ) : (
            <p className="ticket-number mt-6 text-[clamp(5rem,14vw,12rem)] text-display-line">— — —</p>
          )}
        </section>

        <section className="flex flex-1 flex-col gap-4">
          <p className="text-lg font-semibold uppercase tracking-[0.3em] text-display-muted">By doctor</p>
          {doctors.length === 0 && (
            <p className="rounded-3xl border border-display-line p-6 text-display-muted">
              No doctors on duty yet.
            </p>
          )}
          <div className={cn("grid gap-4", doctors.length > 3 && "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2")}>
            {doctors.map((d) => (
              <div key={d.id} className="rounded-3xl border border-display-line bg-display-card p-5 lg:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold lg:text-2xl">{d.name}</p>
                    <p className="truncate text-display-muted">
                      {[d.room && `Room ${d.room}`, d.specialty].filter(Boolean).join(" · ") || "General"}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "ticket-number text-5xl lg:text-6xl",
                      d.current_code ? "text-display-glow" : "text-display-line",
                    )}
                  >
                    {d.current_code ?? "—"}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-display-line pt-4 text-display-muted">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm uppercase tracking-widest">Next</span>
                    {d.next_codes.length ? (
                      d.next_codes.map((c) => (
                        <span key={c} className="ticket-number rounded-lg bg-display-line px-2 py-1 text-lg text-display-foreground">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-sm">{d.waiting_count} waiting</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
