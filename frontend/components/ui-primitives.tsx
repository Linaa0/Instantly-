"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated 3-dot indicator replacing generic spinning wheels.
 */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-label="Loading"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={{ animation: "pulseDot 1.1s infinite ease-in-out 0ms" }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={{ animation: "pulseDot 1.1s infinite ease-in-out 160ms" }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={{ animation: "pulseDot 1.1s infinite ease-in-out 320ms" }}
      />
    </span>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  shimmer?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  shimmer = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border border-transparent",
    secondary:
      "bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]",
    ghost:
      "bg-transparent hover:bg-white/[0.04] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent",
    danger:
      "bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
    md: "h-9 px-4 text-xs rounded-lg gap-2",
    lg: "h-11 px-5 text-sm rounded-xl gap-2",
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "relative overflow-hidden inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {shimmer && variant === "primary" && !loading && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
          style={{ animation: "subtleShimmer 4.5s infinite ease-in-out" }}
        />
      )}
      {loading ? <LoadingDots /> : children}
    </button>
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "subtle";
  interactive?: boolean;
}

export function Card({
  variant = "default",
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  const styles = {
    default: "bg-[var(--bg-surface)] border border-[var(--border-subtle)]",
    elevated: "bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-card",
    subtle: "bg-[var(--bg-elevated)]/60 border border-transparent",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-6",
        styles[variant],
        interactive && "interactive-lift cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Tabular stat number that smoothly counts up on first view.
 */
export function CountUpNumber({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || value === 0) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const totalFrames = 16;
    const timer = setInterval(() => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      setDisplay(Math.round(value * progress));
      if (frame >= totalFrames) {
        setDisplay(value);
        clearInterval(timer);
      }
    }, 18);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="tabular-nums">
      {display}
      {suffix}
    </span>
  );
}

interface StatProps {
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  tone?: "default" | "urgent" | "warning" | "success";
}

export function Stat({
  label,
  value,
  suffix = "",
  hint,
  tone = "default",
}: StatProps) {
  const toneColor = {
    default: "text-[var(--text-primary)]",
    urgent: "text-[#E5534B]",
    warning: "text-[#D99B26]",
    success: "text-[#3FB950]",
  }[tone];

  return (
    <div className="py-2">
      <p className="text-xs font-medium text-[var(--text-secondary)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums",
          toneColor
        )}
      >
        <CountUpNumber value={value} suffix={suffix} />
      </p>
      {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      {actionLabel && onAction && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAction}
          className="mt-4"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function StreamingText({
  text,
  active = false,
  className,
}: {
  text: string;
  active?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (!active) {
      setShown(text);
      return;
    }
    let idx = 0;
    setShown("");
    const interval = setInterval(() => {
      idx += 4;
      setShown(text.slice(0, idx));
      if (idx >= text.length) {
        setShown(text);
        clearInterval(interval);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [text, active]);

  return <span className={className}>{shown}</span>;
}

