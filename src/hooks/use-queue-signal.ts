import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calls `onChange` whenever anything in the queue changes (live), plus a slow
 * safety poll so screens stay correct after network hiccups or a new day.
 */
export function useQueueSignal(onChange: () => void, pollMs = 30000) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const channel = supabase
      .channel(`queue-signal-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_signal" }, () =>
        cb.current(),
      )
      .subscribe();
    const timer = window.setInterval(() => cb.current(), pollMs);
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [pollMs]);
}
