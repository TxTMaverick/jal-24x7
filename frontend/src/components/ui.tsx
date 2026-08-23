"use client";

/** Small shared primitives so every screen looks like the same product. */

import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/lib/format";
import { Check, Minus, Plus, Star } from "./icons";

// --------------------------------------------------------------------------
// Button
// --------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm disabled:bg-brand-300",
  secondary:
    "bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-600 shadow-sm disabled:bg-accent-400/60",
  danger:
    "bg-white text-danger-600 ring-1 ring-danger-500/30 hover:bg-danger-50 disabled:text-danger-500/40",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// --------------------------------------------------------------------------
// Badge / pills
// --------------------------------------------------------------------------

export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "success" | "warn" | "neutral" | "danger";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-100 text-brand-700 ring-brand-500/20",
    success: "bg-success-50 text-success-600 ring-success-500/20",
    warn: "bg-accent-400/15 text-accent-600 ring-accent-500/25",
    neutral: "bg-ink-100 text-ink-600 ring-ink-300/30",
    danger: "bg-danger-50 text-danger-600 ring-danger-500/20",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Badge tone="success" className={className}>
      <Check className="size-3" strokeWidth={3} />
      Verified
    </Badge>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink-600">
      <Star filled className="size-3.5 text-accent-500" />
      <span className="font-semibold text-ink-900">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-ink-400">({count})</span>}
    </span>
  );
}

// --------------------------------------------------------------------------
// Form controls
// --------------------------------------------------------------------------

export const inputClass =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 " +
  "placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:outline-none " +
  "focus:ring-4 focus:ring-brand-500/12 disabled:bg-ink-50 disabled:text-ink-400";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-danger-500">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const buttonSize = size === "sm" ? "size-7" : "size-9";
  return (
    <div
      className={cx(
        "inline-flex items-center rounded-xl bg-brand-50 ring-1 ring-brand-200",
        size === "sm" ? "gap-0.5 p-0.5" : "gap-1 p-1",
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className={cx(
          buttonSize,
          "grid place-items-center rounded-lg text-brand-700 transition-colors",
          "hover:bg-white disabled:text-brand-300 disabled:hover:bg-transparent",
        )}
      >
        <Minus className="size-3.5" strokeWidth={2.5} />
      </button>
      <span
        className={cx(
          "min-w-6 text-center font-semibold tabular-nums text-ink-900",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className={cx(
          buttonSize,
          "grid place-items-center rounded-lg text-brand-700 transition-colors",
          "hover:bg-white disabled:text-brand-300 disabled:hover:bg-transparent",
        )}
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Layout helpers
// --------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && (
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-danger-500/25 bg-danger-50/60 px-5 py-6 text-center">
      <p className="text-sm font-medium text-danger-600">{message}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs text-ink-500">
        Make sure the FastAPI backend is running:{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink-700">
          uvicorn app.main:app --reload
        </code>
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-2xl", className)} />;
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
    >
      {children}
    </Link>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "success" | "accent" | "neutral";
}) {
  const tones = {
    brand: "text-brand-700",
    success: "text-success-600",
    accent: "text-accent-600",
    neutral: "text-ink-900",
  };
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={cx("mt-1.5 text-2xl font-bold tabular-nums", tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
