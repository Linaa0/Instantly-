import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { UrgencyCategory } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "Just now";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.round(diffHr / 24);
  return `${diffDays}d ago`;
}

export function getUrgencyMeta(urgency: UrgencyCategory) {
  switch (urgency) {
    case "IMMEDIATE":
      return {
        label: "Immediate Attention",
        shortLabel: "Immediate",
        badgeClass:
          "bg-red-500/15 text-red-300 border border-red-500/30",
        dotClass: "bg-red-400",
      };
    case "NEEDS_RESPONSE":
      return {
        label: "Needs Response",
        shortLabel: "Needs Reply",
        badgeClass:
          "bg-amber-500/15 text-amber-300 border border-amber-500/30",
        dotClass: "bg-amber-400",
      };
    case "IMPORTANT":
      return {
        label: "Important Info",
        shortLabel: "Important",
        badgeClass:
          "bg-violet-500/15 text-violet-300 border border-violet-500/30",
        dotClass: "bg-violet-400",
      };
    case "FYI_ONLY":
      return {
        label: "FYI Only",
        shortLabel: "FYI Only",
        badgeClass:
          "bg-blue-500/15 text-blue-300 border border-blue-500/30",
        dotClass: "bg-blue-400",
      };
    case "NO_ACTION":
    default:
      return {
        label: "No Action Required",
        shortLabel: "No Action",
        badgeClass:
          "bg-slate-500/15 text-slate-300 border border-slate-500/30",
        dotClass: "bg-slate-400",
      };
  }
}

export function getInitials(name: string): string {
  if (!name) return "IN";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

