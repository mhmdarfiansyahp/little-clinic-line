// Shared queue helpers. Queue numbers reset at midnight in the clinic's time zone,
// which must match public.clinic_today() in the database.
export const CLINIC_TIME_ZONE = "Asia/Bangkok";

export type QueueStatus = "waiting" | "called" | "done" | "skipped";

/** Calendar date (YYYY-MM-DD) in the clinic's time zone. */
export function clinicDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Mirrors public.format_queue_code(): A001 … A999, then A1000. */
export function formatQueueCode(n: number): string {
  return "A" + (n < 1000 ? String(n).padStart(3, "0") : String(n));
}

export const statusLabel: Record<QueueStatus, string> = {
  waiting: "Waiting",
  called: "Now serving",
  done: "Done",
  skipped: "Skipped",
};

// ---- Patient's saved ticket (on their own device) ----
export interface SavedTicket {
  id: string;
  token: string;
  code: string;
  date: string;
}

const TICKET_KEY = "clinicqueue.ticket";

export function saveTicket(ticket: SavedTicket) {
  window.localStorage.setItem(TICKET_KEY, JSON.stringify(ticket));
}

/** Returns today's saved ticket, or null if none / it's from a previous day. */
export function loadTodayTicket(): SavedTicket | null {
  try {
    const raw = window.localStorage.getItem(TICKET_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as SavedTicket;
    return t.date === clinicDate() ? t : null;
  } catch {
    return null;
  }
}

export function clearTicket() {
  window.localStorage.removeItem(TICKET_KEY);
}

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}
