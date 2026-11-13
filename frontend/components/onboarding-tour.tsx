"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Mail,
  MessageSquare,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  Send,
  CheckSquare,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { useTour } from "@/components/providers";
import { Button } from "@/components/ui-primitives";

const TOUR_STEPS = [
  {
    step: 1,
    category: "Step 1 of 3 • Ingestion",
    title: "Connect your Gmail & Slack",
    subtitle:
      "Instantly connects to your real communications feeds. Stop tab-switching and let AI consolidate your inboxes.",
    icon: Mail,
    accentColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    bullets: [
      {
        icon: Mail,
        title: "Gmail Read-Only Sync",
        desc: "Pulls your latest emails securely without changing your inbox layout.",
      },
      {
        icon: MessageSquare,
        title: "Per-User Slack Channels & DMs",
        desc: "Each member connects their own Slack workspace and sees their own messages.",
      },
      {
        icon: ShieldCheck,
        title: "Private & Encrypted",
        desc: "OAuth tokens are encrypted at rest with Fernet. Zero credentials ever exposed.",
      },
    ],
  },
  {
    step: 2,
    category: "Step 2 of 3 • Triage",
    title: "Automatic urgency & deadline sorting",
    subtitle:
      "Every message is analyzed to cut noise. You see only what needs you today, sorted by priority.",
    icon: Flame,
    accentColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    bullets: [
      {
        icon: Flame,
        title: "Urgency Classification",
        desc: "Instant breakdown into Immediate (due today), Needs Reply, Important, and FYI.",
      },
      {
        icon: Clock,
        title: "Explicit & Inferred Deadlines",
        desc: "AI identifies time cutoffs ('by 2:00 PM EST', 'before Monday') automatically.",
      },
      {
        icon: Sparkles,
        title: "Daily Morning Briefing",
        desc: "A calm 30-second executive summary synthesized from all your channels.",
      },
    ],
  },
  {
    step: 3,
    category: "Step 3 of 3 • Action",
    title: "One-click AI replies & tracked tasks",
    subtitle:
      "Turn incoming requests into action items and ready-to-send replies with a single click.",
    icon: CheckSquare,
    accentColor: "text-[var(--accent)] bg-[var(--accent-surface)] border-[var(--accent)]/30",
    bullets: [
      {
        icon: Send,
        title: "Context-Aware Replies",
        desc: "Draft concise or professional email replies and Slack messages instantly.",
      },
      {
        icon: CheckSquare,
        title: "Auto-Extracted Action Items",
        desc: "Tasks and follow-ups are extracted directly into your personal task checklist.",
      },
      {
        icon: CheckCircle2,
        title: "Real Live Sending",
        desc: "Click Send to dispatch real Slack messages or open ready drafts in Gmail.",
      },
    ],
  },
];

export function OnboardingTour() {
  const { isTourOpen, openTour, closeTour } = useTour();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-prompt tour on first visit for new users
  useEffect(() => {
    if (typeof window === "undefined") return;
    const completed = window.localStorage.getItem("instantly_tour_completed");
    const token = window.localStorage.getItem("instantly_token");
    if (!completed && token) {
      const timer = setTimeout(() => {
        openTour();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [openTour]);

  if (!isTourOpen) return null;

  const activeData = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      closeTour();
      router.push("/integrations");
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-modal-in"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 sm:p-8 shadow-2xl overflow-hidden text-[var(--text-primary)]">
        {/* Subtle decorative top glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-72 rounded-full bg-[var(--accent)]/15 blur-3xl" />

        {/* Header with Close */}
        <div className="relative flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-surface)] text-[var(--accent)]">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {activeData.category}
            </span>
          </div>

          <button
            onClick={closeTour}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="relative py-6 space-y-6">
          <div>
            <h2
              id="tour-modal-title"
              className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
            >
              {activeData.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              {activeData.subtitle}
            </p>
          </div>

          {/* Bullet cards */}
          <div className="space-y-3">
            {activeData.bullets.map((b, idx) => {
              const BulletIcon = b.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 transition"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-surface)] text-[var(--accent)] mt-0.5">
                    <BulletIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      {b.title}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      {b.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with Step Dots and Actions */}
        <div className="relative flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === currentStep
                    ? "w-6 bg-[var(--accent)]"
                    : "w-2 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={closeTour}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              Skip
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              shimmer={isLast}
            >
              {isLast ? "Connect Channels" : "Next"}
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

