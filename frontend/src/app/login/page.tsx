"use client";

/**
 * Screen 7 (part 1). Name + mobile → OTP → verified session.
 *
 * Demo mode: the backend returns the generated OTP in its response and we show
 * it in a toast plus an on-screen hint, so the flow is demonstrable without an
 * SMS gateway. Production swaps in MSG91/Twilio and `demo_otp` comes back null.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { Check, Phone, Shield, WaterDrop } from "@/components/icons";
import { Badge, Button, Field, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { useToast } from "@/store/toast";

const DEMO_ACCOUNTS = [
  { phone: "9876543210", role: "Customer", name: "Tejas Tripathi" },
  { phone: "9822001133", role: "Vendor", name: "Indore Aqua Care" },
  { phone: "9999900000", role: "Admin", name: "JAL Admin" },
];

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") ?? "/";

  const { user, signIn } = useAuth();
  const { success, error: toastError, toast } = useToast();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Already signed in? Nothing to do here.
  useEffect(() => {
    if (user) router.replace(redirectTo);
  }, [user, router, redirectTo]);

  // Resend countdown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const sendOtp = useCallback(
    async (silent = false) => {
      setBusy(true);
      try {
        const response = await api.requestOtp(phone, name || undefined);
        setDemoOtp(response.demo_otp);
        setStep("otp");
        setSecondsLeft(30);
        setCode("");
        if (response.demo_otp) {
          toast(
            `Demo mode, your OTP is ${response.demo_otp}`,
            "info",
            "OTP generated",
          );
        } else if (!silent) {
          success(response.message);
        }
        window.setTimeout(() => otpInputRef.current?.focus(), 80);
      } catch (e) {
        toastError(e instanceof Error ? e.message : "Could not send the OTP.");
      } finally {
        setBusy(false);
      }
    },
    [phone, name, toast, success, toastError],
  );

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.verifyOtp(phone, code, name || undefined);
      signIn(response);
      success(
        response.is_new_user
          ? `Welcome to JAL 24×7, ${response.user.name.split(" ")[0]}!`
          : `Welcome back, ${response.user.name.split(" ")[0]}!`,
      );
      router.replace(redirectTo);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not verify the OTP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:gap-14 lg:py-16">
      {/* Left: pitch */}
      <div className="hidden flex-1 lg:block">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white">
          <WaterDrop filled className="size-6" />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink-900">
          One account for every
          <br />
          water need.
        </h1>
        <p className="mt-3 max-w-md text-ink-600">
          Sign in with your mobile number to book cans, campers and tankers, track deliveries live,
          and manage recurring plans.
        </p>

        <ul className="mt-8 space-y-3">
          {[
            { icon: Shield, text: "Password-free OTP login, nothing to remember" },
            { icon: Check, text: "Your saved addresses and order history in one place" },
            { icon: Phone, text: "Delivery updates sent to the number you verify" },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-ink-100">
                <item.icon className="size-4.5" />
              </span>
              <span className="pt-1.5 text-sm text-ink-600">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: the form */}
      <div className="w-full lg:max-w-md">
        <div className="card p-6 sm:p-7">
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-600 text-white lg:hidden">
              <WaterDrop filled className="size-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-ink-900 lg:mt-0">
              {step === "phone" ? "Welcome to JAL 24×7" : "Verify your number"}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {step === "phone"
                ? "Enter your details to continue"
                : `We sent a 6-digit code to +91 ${phone}`}
            </p>
          </div>

          {step === "phone" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendOtp();
              }}
              className="mt-6 space-y-4"
            >
              <Field label="Your name" hint="So your delivery partner knows who to ask for">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Mobile number"
                required
                hint={
                  phone.length === 0
                    ? "10 digits, no country code"
                    : phone.length < 10
                      ? `${10 - phone.length} more digit${10 - phone.length === 1 ? "" : "s"}`
                      : undefined
                }
              >
                <div className="flex">
                  <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-l-xl border border-r-0 border-ink-200 bg-ink-50 px-3 text-sm font-medium text-ink-600">
                    <Phone className="size-4" />
                    +91
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    required
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="9876543210"
                    className={cx(inputClass, "rounded-l-none")}
                  />
                </div>
              </Field>

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={busy}
                disabled={phone.length !== 10}
              >
                Get OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-6 space-y-4">
              {demoOtp && (
                <div className="rounded-xl border border-dashed border-accent-500/40 bg-accent-400/10 p-3 text-center">
                  <Badge tone="warn">Demo mode</Badge>
                  <p className="mt-2 text-xs text-ink-600">
                    SMS is not sent in this build. Your code is
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-ink-900">
                    {demoOtp}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCode(demoOtp)}
                    className="mt-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Fill it in for me
                  </button>
                </div>
              )}

              <Field label="6-digit OTP" required>
                <input
                  ref={otpInputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  className={cx(
                    inputClass,
                    "text-center font-mono text-lg tracking-[0.4em] placeholder:tracking-[0.4em]",
                  )}
                />
              </Field>

              <Button type="submit" size="lg" fullWidth loading={busy} disabled={code.length < 4}>
                Verify & continue
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                    setDemoOtp(null);
                  }}
                  className="font-medium text-ink-500 hover:text-ink-900"
                >
                  ← Change number
                </button>
                <button
                  type="button"
                  disabled={secondsLeft > 0 || busy}
                  onClick={() => void sendOtp(true)}
                  className="font-semibold text-brand-600 hover:text-brand-700 disabled:text-ink-300"
                >
                  {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-5 border-t border-ink-100 pt-4 text-center text-[11px] leading-relaxed text-ink-400">
            By continuing you agree to receive delivery updates on this number. This is a student
            project, no real SMS is sent and no payment is taken.
          </p>
        </div>

        {/* Demo account shortcuts, invaluable during a viva. */}
        <div className="card mt-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Demo accounts
          </p>
          <div className="mt-2.5 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.phone}
                type="button"
                onClick={() => {
                  setPhone(account.phone);
                  setName(account.name);
                  setStep("phone");
                }}
                className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-left transition-colors hover:bg-brand-50"
              >
                <span>
                  <span className="block text-sm font-medium text-ink-900">{account.name}</span>
                  <span className="text-xs text-ink-400">+91 {account.phone}</span>
                </span>
                <Badge tone="neutral">{account.role}</Badge>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-ink-500">
          Just want to track an order?{" "}
          <Link href="/orders" className="font-semibold text-brand-600 hover:text-brand-700">
            Go to My Orders
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16">
          <div className="skeleton h-96 rounded-2xl" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
