"use client";

/** Minimal toast system. used for OTP codes, add-to-cart and errors. */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cx } from "@/lib/format";

type ToastTone = "info" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  title?: string;
}

interface ToastValue {
  toast: (message: string, tone?: ToastTone, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  info: "border-brand-200 bg-white text-ink-900",
  success: "border-success-500/30 bg-success-50 text-success-600",
  error: "border-danger-500/30 bg-danger-50 text-danger-600",
};

const TONE_ICONS: Record<ToastTone, string> = {
  info: "ℹ",
  success: "✓",
  error: "⚠",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info", title?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone, title }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 6000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(
    () => ({
      toast,
      success: (message, title) => toast(message, "success", title),
      error: (message, title) => toast(message, "error", title),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={cx(
              "pointer-events-auto w-full max-w-sm animate-(--animate-fade-up) rounded-xl border px-4 py-3 text-left shadow-(--shadow-lift)",
              TONE_STYLES[t.tone],
            )}
          >
            <span className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 text-sm">
                {TONE_ICONS[t.tone]}
              </span>
              <span className="flex-1 text-sm">
                {t.title && <span className="block font-semibold">{t.title}</span>}
                <span className={cx(t.title && "text-ink-600")}>{t.message}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
