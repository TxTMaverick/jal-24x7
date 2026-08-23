/**
 * Carries a chosen delivery slot from the Tankers screen to Checkout.
 *
 * The cart itself deliberately stores only ids and quantities, so a scheduling
 * preference has nowhere to live there. Rather than bloat the cart model, the
 * slot is parked in localStorage and consumed once at checkout.
 */

const KEY = "jal24x7_schedule";

export interface DeliverySchedule {
  date: string; // yyyy-mm-dd
  window: string; // "08:00-10:00"
}

export function saveSchedule(schedule: DeliverySchedule): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(schedule));
  } catch {
    /* storage unavailable, checkout just falls back to its defaults */
  }
}

export function readSchedule(): DeliverySchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeliverySchedule>;
    if (!parsed?.date || !parsed?.window) return null;
    return { date: parsed.date, window: parsed.window };
  } catch {
    return null;
  }
}

export function clearSchedule(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Human label used on the order, e.g. "Tue, 24 Aug · 08:00-10:00". */
export function scheduleLabel(schedule: DeliverySchedule): string {
  const date = new Date(`${schedule.date}T00:00:00`);
  const pretty = Number.isNaN(date.getTime())
    ? schedule.date
    : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${pretty} · ${schedule.window}`;
}

/** ISO datetime for the start of the chosen window, for `scheduled_for`. */
export function scheduleToISO(schedule: DeliverySchedule): string | null {
  const startTime = schedule.window.split("-")[0]?.trim() ?? schedule.window.split("-")[0]?.trim();
  if (!startTime) return null;
  const composed = new Date(`${schedule.date}T${startTime}:00`);
  return Number.isNaN(composed.getTime()) ? null : composed.toISOString();
}
