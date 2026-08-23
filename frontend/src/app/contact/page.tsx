"use client";

/** Screen 10. Contact form + Govt. zone-wise water department directory. */

import { useCallback, useEffect, useState } from "react";

import { Building, Check, MapPin, Phone, Search } from "@/components/icons";
import { Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import type { WaterDepartment } from "@/lib/types";
import { useToast } from "@/store/toast";

const SUBJECTS = [
  "General enquiry",
  "Bulk / event booking",
  "Become a supplier",
  "Delivery issue",
  "Billing question",
];

export default function ContactPage() {
  const { success, error: toastError, toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [departments, setDepartments] = useState<WaterDepartment[]>([]);
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api
      .waterDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const detectZone = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toastError("Your browser does not support location access.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const nearest = await api.nearestDepartment(
            position.coords.latitude,
            position.coords.longitude,
          );
          if (nearest) {
            setDetectedZone(nearest.zone);
            toast(`You are closest to ${nearest.zone}, ${nearest.city}.`, "success", "Zone detected");
          }
        } catch {
          toastError("Could not detect your zone.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toastError("Location permission denied. Pick your zone from the list instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [toast, toastError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const response = await api.submitContact({ name, email, subject, message });
      success(response.message, "Message sent");
      setSent(true);
      setMessage("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  };

  const filtered = departments.filter((d) =>
    query
      ? `${d.zone} ${d.city} ${d.office_name} ${d.address}`.toLowerCase().includes(query.toLowerCase())
      : true,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Support"
        title="Contact & Water Helplines"
        subtitle="Reach our team for bookings and supplier enquiries, or go straight to your municipal water department using the official zone-wise directory."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        {/* ---------------- Contact form ---------------- */}
        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold text-ink-900">Send us a message</h2>
          <p className="mt-1 text-sm text-ink-500">
            We typically reply within 24 hours on working days.
          </p>

          {sent ? (
            <div className="mt-5 rounded-xl bg-success-50 p-5 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-500 text-white">
                <Check className="size-6" strokeWidth={3} />
              </span>
              <p className="mt-3 font-semibold text-success-600">Message received</p>
              <p className="mt-1 text-sm text-ink-600">
                Thanks {name.split(" ")[0] || "there"}, our team will get back to you at {email}.
              </p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setSent(false)}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <Field label="Your name" required>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Full name"
                  className={inputClass}
                />
              </Field>

              <Field label="Email address" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </Field>

              <Field label="Subject" required>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputClass}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Message" required hint="At least 10 characters">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder="Tell us what you need, quantity, location, date…"
                  className={cx(inputClass, "h-auto py-2.5")}
                />
              </Field>

              <Button type="submit" size="lg" fullWidth loading={sending}>
                Send message
              </Button>
            </form>
          )}

          <div className="mt-6 space-y-2 border-t border-ink-100 pt-4">
            <ContactLine icon={Phone} label="Support" value="+91 731 000 2470" href="tel:+917310002470" />
            <ContactLine icon={Building} label="Office" value="Rajwada, Indore, MP 452002" />
            <ContactLine icon={MapPin} label="Service area" value="Indore & surrounding areas" />
          </div>
        </section>

        {/* ---------------- Govt directory ---------------- */}
        <section id="directory" className="scroll-mt-20">
          <div className="card bg-ink-900 p-5 text-white ring-0 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge tone="warn">Public service</Badge>
                <h2 className="mt-3 text-lg font-bold">Govt. Zone-wise Water Directory</h2>
                <p className="mt-1 max-w-md text-sm text-ink-200">
                  Official Jal Sansthan / Municipal Corporation contacts for tanker requests,
                  complaints and billing, always available alongside private booking.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search zone or area…"
                  aria-label="Search water departments"
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-ink-300 focus:border-white/30 focus:outline-none"
                />
              </div>
              <Button type="button" variant="accent" onClick={detectZone} loading={locating}>
                <MapPin className="size-4" />
                Detect my zone
              </Button>
            </div>

            {detectedZone && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-400/20 px-3 py-1.5 text-xs font-semibold text-accent-400">
                <MapPin className="size-3.5" />
                Your zone: {detectedZone}
              </p>
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            {departments.length === 0 ? (
              [0, 1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)
            ) : filtered.length === 0 ? (
              <div className="card p-6 text-center text-sm text-ink-500">
                No zone matches “{query}”.
              </div>
            ) : (
              filtered.map((dept) => {
                const highlighted = detectedZone === dept.zone;
                return (
                  <article
                    key={dept.id}
                    className={cx(
                      "card p-4 transition-all",
                      highlighted && "ring-2 ring-accent-500 ring-offset-1",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-ink-900">{dept.zone}</h3>
                          {highlighted && <Badge tone="warn">Your zone</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">{dept.office_name}</p>
                        {dept.address && (
                          <p className="mt-0.5 text-xs text-ink-400">{dept.address}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-3">
                      <HelplineLink label="Zone office" number={dept.helpline} />
                      <HelplineLink label="Tanker request" number={dept.tanker_request_line} urgent />
                      {dept.billing_line && (
                        <HelplineLink label="Billing / complaints" number={dept.billing_line} />
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ContactLine({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-ink-400">{label}</span>
        <span className="block truncate text-sm font-medium text-ink-900">{value}</span>
      </span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-ink-50">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-3 p-1">{content}</div>
  );
}

function HelplineLink({
  label,
  number,
  urgent,
}: {
  label: string;
  number: string;
  urgent?: boolean;
}) {
  return (
    <a
      href={`tel:${number.replace(/[^\d+]/g, "")}`}
      className={cx(
        "flex items-center gap-2 rounded-xl p-2.5 transition-colors",
        urgent ? "bg-accent-400/10 hover:bg-accent-400/20" : "bg-ink-50 hover:bg-brand-50",
      )}
    >
      <Phone className={cx("size-4 shrink-0", urgent ? "text-accent-600" : "text-brand-600")} />
      <span className="min-w-0">
        <span className="block text-[11px] text-ink-400">{label}</span>
        <span className="block truncate text-sm font-bold text-ink-900">{number}</span>
      </span>
    </a>
  );
}
