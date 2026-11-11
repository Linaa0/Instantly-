"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  mono?: boolean;
}

/**
 * Minimal geometric "I" mark built from two shapes:
 * 1) A bold rounded vertical stroke tilted slightly forward to suggest speed ("instant")
 * 2) A crisp circular dot above it
 */
export function LogoMark({ className, mono = false }: LogoMarkProps) {
  const fill = mono ? "currentColor" : "var(--accent)";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
    >
      <circle cx="13.5" cy="5.25" r="2.25" fill={fill} />
      <rect
        x="9.25"
        y="9.25"
        width="4.2"
        height="10.25"
        rx="2.1"
        transform="rotate(-8 9.25 9.25)"
        fill={fill}
      />
    </svg>
  );
}

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

export function Logo({ collapsed = false, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
        <LogoMark className="h-4 w-4" />
      </span>
      {!collapsed && (
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Instantly
        </span>
      )}
    </span>
  );
}

