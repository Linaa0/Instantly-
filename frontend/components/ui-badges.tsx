"use client";

import React from "react";
import { Mail, MessageSquare, AlertCircle } from "lucide-react";
import { cn, getUrgencyMeta } from "@/lib/utils";
import { UrgencyCategory } from "@/types";

export function UrgencyBadge({ urgency }: { urgency: UrgencyCategory }) {
  const meta = getUrgencyMeta(urgency);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        meta.badgeClass
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.shortLabel}
    </span>
  );
}

export function PlatformBadge({ source }: { source: "gmail" | "slack" | string }) {
  const isGmail = source.toLowerCase() === "gmail";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
      {isGmail ? (
        <Mail className="h-3 w-3 text-[var(--text-muted)]" />
      ) : (
        <MessageSquare className="h-3 w-3 text-[var(--text-muted)]" />
      )}
      {isGmail ? "Gmail" : "Slack"}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]",
        className
      )}
      title="Exploring sample data"
    >
      Demo Data
    </span>
  );
}

export function ReviewRequiredBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      <AlertCircle className="h-3 w-3 text-amber-400" />
      Needs Human Review
    </span>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        style={{ animation: "subtleShimmer 2.2s infinite ease-in-out" }}
      />
      <div className="h-3.5 w-1/4 rounded bg-white/[0.06] mb-3" />
      <div className="h-6 w-1/2 rounded bg-white/[0.06] mb-2" />
      <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
    </div>
  );
}
