/** Small formatting helpers shared across screens. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number, exact = false): string {
  return exact ? inrPaise.format(value) : inr.format(value);
}

export function litres(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}kL`;
  }
  return `${value % 1 === 0 ? value : value.toFixed(1)}L`;
}

export function eta(minutes: number): string {
  if (minutes <= 0) return "Arrived";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSeconds = Math.round((Date.now() - then) / 1000);

  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hr ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending payment",
  confirmed: "Confirmed",
  vendor_assigned: "Vendor assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

const SPEED_LABELS: Record<string, string> = {
  instant: "Under 1 hr",
  same_day: "Same day",
  scheduled: "Scheduled",
};

export function speedLabel(speed: string): string {
  return SPEED_LABELS[speed] ?? speed;
}

export function discountPercent(price: number, mrp: number | null): number | null {
  if (!mrp || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** Tailwind classes for a status pill. */
export function statusTone(status: string): string {
  switch (status) {
    case "delivered":
      return "bg-success-50 text-success-600 ring-success-500/20";
    case "cancelled":
      return "bg-danger-50 text-danger-600 ring-danger-500/20";
    case "out_for_delivery":
      return "bg-accent-400/15 text-accent-600 ring-accent-500/25";
    case "pending":
      return "bg-ink-100 text-ink-600 ring-ink-300/30";
    default:
      return "bg-brand-100 text-brand-700 ring-brand-500/20";
  }
}

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
