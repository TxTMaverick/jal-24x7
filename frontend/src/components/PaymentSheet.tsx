"use client";

/**
 * Payment sheet.
 *
 * Mirrors the bottom sheet an Indian checkout shows: UPI apps detected on the
 * phone, any UPI ID, saved and new cards, net banking, and cash on delivery.
 *
 * Test mode. The backend validates the shape of what you enter (VPA format,
 * card checksum, known bank code) and signs a reference, but no bank is
 * contacted and no money moves.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { cx, money } from "@/lib/format";
import type { PayResult, PaymentMethods, PaymentOption } from "@/lib/types";
import { Check, Close, Shield } from "./icons";
import { Badge, Button, Spinner, inputClass } from "./ui";

type Group = "upi" | "cards" | "netbanking" | "other";

const GROUPS: { key: Group; label: string; hint: string }[] = [
  { key: "upi", label: "UPI", hint: "Instant, no charges" },
  { key: "cards", label: "Cards", hint: "Credit or debit" },
  { key: "netbanking", label: "Net Banking", hint: "All major banks" },
  { key: "other", label: "Other", hint: "Cash on delivery" },
];

export function PaymentSheet({
  open,
  orderCode,
  amount,
  onClose,
  onPaid,
}: {
  open: boolean;
  orderCode: string;
  amount: number;
  onClose: () => void;
  onPaid: (result: PayResult) => void;
}) {
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  const [group, setGroup] = useState<Group>("upi");
  const [selected, setSelected] = useState<string | null>(null);

  const [upiId, setUpiId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [stage, setStage] = useState<"choose" | "processing" | "done">("choose");
  const [error, setError] = useState<string | null>(null);
  const [processingLabel, setProcessingLabel] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api
      .paymentMethods()
      .then(setMethods)
      .catch(() => setError("Could not load payment methods."));
  }, [open]);

  // Reset each time the sheet is opened.
  useEffect(() => {
    if (open) {
      setStage("choose");
      setError(null);
      setSelected(null);
      setGroup("upi");
    }
  }, [open]);

  // Escape closes, and focus is trapped inside while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "processing") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, stage]);

  const optionsFor = useCallback(
    (g: Group): PaymentOption[] => {
      if (!methods) return [];
      if (g === "upi") return [...methods.upi_apps, ...methods.others.filter((o) => o.kind === "upi_id")];
      if (g === "cards") return methods.cards;
      if (g === "netbanking") return methods.netbanking;
      return methods.others.filter((o) => o.kind === "cod");
    },
    [methods],
  );

  const needsUpiId = selected === "upi_id";
  const needsCard = selected === "card_new";

  const canPay = useMemo(() => {
    if (!selected) return false;
    if (needsUpiId) return /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim());
    if (needsCard) {
      return (
        cardNumber.replace(/\D/g, "").length >= 12 &&
        cardHolder.trim().length > 1 &&
        /^\d{2}\/\d{2}$/.test(cardExpiry) &&
        cardCvv.length >= 3
      );
    }
    return true;
  }, [selected, needsUpiId, needsCard, upiId, cardNumber, cardHolder, cardExpiry, cardCvv]);

  const pay = async () => {
    if (!selected) return;
    setError(null);
    setStage("processing");

    const option = [
      ...(methods?.upi_apps ?? []),
      ...(methods?.netbanking ?? []),
      ...(methods?.cards ?? []),
      ...(methods?.others ?? []),
    ].find((o) => o.id === selected);
    setProcessingLabel(option?.label ?? "your bank");

    try {
      const result = await api.pay(orderCode, {
        method_id: selected,
        upi_id: needsUpiId ? upiId.trim() : undefined,
        card_number: needsCard ? cardNumber : undefined,
        card_holder: needsCard ? cardHolder : undefined,
      });
      setStage("done");
      // Brief success beat so the confirmation is actually readable.
      window.setTimeout(() => onPaid(result), 1100);
    } catch (e) {
      setStage("choose");
      setError(e instanceof Error ? e.message : "Payment could not be completed.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a payment method"
    >
      <div
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
        onClick={() => stage !== "processing" && onClose()}
        aria-hidden
      />

      <div
        ref={dialogRef}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-(--animate-fade-up) sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-5">
          <div>
            <p className="text-xs font-medium text-ink-400">Paying for order {orderCode}</p>
            <p className="mt-0.5 text-2xl font-bold text-ink-900">{money(amount, true)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={stage === "processing"}
            aria-label="Close payment sheet"
            className="grid size-9 place-items-center rounded-xl text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900 disabled:opacity-40"
          >
            <Close className="size-5" />
          </button>
        </div>

        {stage === "processing" ? (
          <ProcessingView label={processingLabel} />
        ) : stage === "done" ? (
          <SuccessView amount={amount} />
        ) : (
          <>
            {/* Group tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-ink-100 px-3 py-2">
              {GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    setGroup(g.key);
                    setSelected(null);
                  }}
                  aria-pressed={group === g.key}
                  className={cx(
                    "shrink-0 rounded-xl px-3.5 py-2 text-left transition-colors",
                    group === g.key ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50",
                  )}
                >
                  <span className="block text-sm font-semibold">{g.label}</span>
                  <span
                    className={cx(
                      "block text-[10px]",
                      group === g.key ? "text-white/75" : "text-ink-400",
                    )}
                  >
                    {g.hint}
                  </span>
                </button>
              ))}
            </div>

            {/* Options */}
            <div className="flex-1 overflow-y-auto p-4">
              {!methods ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-14 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {group === "upi" && (
                    <p className="mb-1 px-1 text-xs text-ink-400">
                      Apps detected on this device are shown first.
                    </p>
                  )}

                  {optionsFor(group).map((option) => {
                    const isSelected = selected === option.id;
                    return (
                      <div key={option.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(option.id)}
                          aria-pressed={isSelected}
                          className={cx(
                            "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                            isSelected
                              ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                              : "border-ink-200 hover:border-brand-300 hover:bg-ink-50/60",
                          )}
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-ink-100">
                            {option.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-ink-900">
                                {option.label}
                              </span>
                              {option.is_installed && <Badge tone="success">Installed</Badge>}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-ink-500">
                              {option.detail}
                            </span>
                          </span>
                          <span
                            className={cx(
                              "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                              isSelected ? "border-brand-600 bg-brand-600" : "border-ink-300",
                            )}
                          >
                            {isSelected && <Check className="size-3 text-white" strokeWidth={4} />}
                          </span>
                        </button>

                        {/* Inline forms */}
                        {isSelected && option.id === "upi_id" && (
                          <div className="mt-2 rounded-xl bg-ink-50 p-3">
                            <label className="block text-xs font-medium text-ink-600">
                              Enter your UPI ID
                            </label>
                            <input
                              value={upiId}
                              onChange={(e) => setUpiId(e.target.value)}
                              placeholder="yourname@okhdfcbank"
                              autoComplete="off"
                              className={cx(inputClass, "mt-1.5 bg-white")}
                            />
                            <p className="mt-1.5 text-[11px] text-ink-400">
                              A collect request would be sent to this ID in a live build.
                            </p>
                          </div>
                        )}

                        {isSelected && option.id === "card_new" && (
                          <div className="mt-2 space-y-2.5 rounded-xl bg-ink-50 p-3">
                            <div>
                              <label className="block text-xs font-medium text-ink-600">
                                Card number
                              </label>
                              <input
                                value={cardNumber}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
                                  setCardNumber(digits.replace(/(.{4})/g, "$1 ").trim());
                                }}
                                inputMode="numeric"
                                placeholder="4111 1111 1111 1111"
                                autoComplete="off"
                                className={cx(inputClass, "mt-1.5 bg-white font-mono")}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-ink-600">
                                Name on card
                              </label>
                              <input
                                value={cardHolder}
                                onChange={(e) => setCardHolder(e.target.value)}
                                placeholder="As printed on the card"
                                autoComplete="off"
                                className={cx(inputClass, "mt-1.5 bg-white")}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-xs font-medium text-ink-600">
                                  Expiry
                                </label>
                                <input
                                  value={cardExpiry}
                                  onChange={(e) => {
                                    const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                                    setCardExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                                  }}
                                  inputMode="numeric"
                                  placeholder="MM/YY"
                                  className={cx(inputClass, "mt-1.5 bg-white font-mono")}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-ink-600">CVV</label>
                                <input
                                  value={cardCvv}
                                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                  inputMode="numeric"
                                  type="password"
                                  placeholder="123"
                                  className={cx(inputClass, "mt-1.5 bg-white font-mono")}
                                />
                              </div>
                            </div>
                            <p className="text-[11px] text-ink-400">
                              Test mode. Use 4111 1111 1111 1111 with any future expiry and CVV.
                              Card details are never stored.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-xl bg-danger-50 p-3 text-sm text-danger-600">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-ink-100 p-4">
              <Button fullWidth size="lg" disabled={!canPay} onClick={pay}>
                Pay {money(amount)}
              </Button>
              <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-400">
                <Shield className="mt-px size-3.5 shrink-0 text-success-500" />
                {methods?.note ??
                  "Test mode. No money is transferred and no bank is contacted."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProcessingView({ label }: { label: string }) {
  const [step, setStep] = useState(0);
  const steps = [
    `Opening ${label}`,
    "Waiting for confirmation",
    "Verifying with the gateway",
  ];

  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((s) => Math.min(steps.length - 1, s + 1)),
      900,
    );
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center gap-5 px-6 py-14 text-center">
      <Spinner className="size-10 text-brand-600" />
      <div>
        <p className="font-semibold text-ink-900">{steps[step]}</p>
        <p className="mt-1 text-sm text-ink-500">Please do not close this window.</p>
      </div>
      <ul className="w-full max-w-xs space-y-1.5">
        {steps.map((s, i) => (
          <li
            key={s}
            className={cx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
              i < step
                ? "bg-success-50 text-success-600"
                : i === step
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-300",
            )}
          >
            {i < step ? (
              <Check className="size-3.5" strokeWidth={3} />
            ) : (
              <span className="size-3.5 rounded-full border-2 border-current" />
            )}
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuccessView({ amount }: { amount: number }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-success-500 text-white animate-(--animate-drop)">
        <Check className="size-8" strokeWidth={3} />
      </span>
      <div>
        <p className="text-lg font-bold text-ink-900">Payment successful</p>
        <p className="mt-1 text-sm text-ink-500">
          {money(amount, true)} paid. Taking you to live tracking.
        </p>
      </div>
    </div>
  );
}
