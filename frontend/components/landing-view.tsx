"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Flame,
  MessageSquareReply,
  CheckSquare,
  Search,
  Users,
  Mail,
  MessageSquare,
  CheckCircle2,
  Clock,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui-primitives";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Observe once when an element enters the viewport for calm fade-up reveals.
 */
function useInViewOnce(threshold = 0.15) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

const FEATURES = [
  {
    icon: FileText,
    title: "Daily brief",
    description: "One calm summary of deadlines, blockers and updates every morning.",
  },
  {
    icon: Flame,
    title: "Priority queue",
    description: "Messages sorted by what actually needs your reply or decision.",
  },
  {
    icon: MessageSquareReply,
    title: "Reply drafts",
    description: "Ready-to-edit responses written in your tone, never sent without you.",
  },
  {
    icon: CheckSquare,
    title: "Follow-ups",
    description: "Tasks and due dates pulled straight from conversations into your list.",
  },
  {
    icon: Search,
    title: "Search",
    description: "Find any person, thread or deadline across Gmail and Slack at once.",
  },
  {
    icon: Users,
    title: "Team workspace",
    description: "Assign threads, leave internal notes and share context with your team.",
  },
];

export function LandingView() {
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const stepsSection = useInViewOnce(0.25);
  const featuresSection = useInViewOnce(0.15);
  const showcaseSection = useInViewOnce(0.2);
  const ctaSection = useInViewOnce(0.25);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLoggedIn(Boolean(window.localStorage.getItem("instantly_token")));
    }
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 16);
      setScrollY(Math.min(y, 500));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const parallaxOffset = Math.round(scrollY * -0.035);

  return (
    <div
      data-testid="landing-page"
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col"
    >
      {/* 1. Sticky Top Navigation */}
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-200",
          scrolled
            ? "border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/85 backdrop-blur-md shadow-card"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="Instantly home">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--text-secondary)]">
              <a
                href="#how-it-works"
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                How it works
              </a>
              <a
                href="#features"
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                Features
              </a>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {isLoggedIn ? (
              <Link href="/overview" data-testid="nav-open-workspace">
                <Button variant="primary" size="md">
                  Open workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  data-testid="landing-login-link"
                  className="inline-flex h-9 items-center px-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Log in
                </Link>
                <Link href="/register" data-testid="landing-get-started-link">
                  <Button variant="primary" size="md" shimmer>
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4 space-y-3">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-sm text-[var(--text-secondary)]"
            >
              How it works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-sm text-[var(--text-secondary)]"
            >
              Features
            </a>
            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-3">
              <ThemeToggle />
              {isLoggedIn ? (
                <Link href="/overview" className="w-full">
                  <Button variant="primary" size="md" className="w-full">
                    Open workspace
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="flex-1">
                    <Button variant="secondary" size="md" className="w-full">
                      Log in
                    </Button>
                  </Link>
                  <Link href="/register" className="flex-1">
                    <Button variant="primary" size="md" className="w-full">
                      Get started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1120px] px-6">
        {/* 2. Hero Section */}
        <section className="pt-20 pb-24 text-center">
          <div className="stagger-1 mx-auto max-w-2xl space-y-6">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-[var(--text-primary)]">
              Your inbox, sorted for you.
            </h1>
            <p className="text-base text-[var(--text-secondary)] max-w-xl mx-auto">
              Instantly reads Gmail and Slack, then shows what needs you today.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={isLoggedIn ? "/overview" : "/register"}
                data-testid="hero-get-started-button"
              >
                <Button variant="primary" size="lg" shimmer>
                  {isLoggedIn ? "Open workspace" : "Get started"}
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="secondary" size="lg">
                  See how it works
                </Button>
              </a>
            </div>
          </div>

          {/* Coded Mini Overview Product Preview with subtle parallax */}
          <div
            style={{ transform: `translateY(${parallaxOffset}px)` }}
            className="stagger-2 mt-16 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2 sm:p-3 shadow-card text-left transition-transform duration-200 ease-out"
          >
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] overflow-hidden">
              {/* Window Top Bar */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    Instantly — Overview
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  Synced 2m ago
                </span>
              </div>

              {/* Mini Workspace Content */}
              <div className="p-6 sm:p-8 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Today
                    </p>
                    <p className="text-xl font-semibold text-[var(--text-primary)] mt-1">
                      Your day, in focus.
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 tabular-nums">
                      2 deadlines. 3 decisions waiting.
                    </p>
                  </div>
                  <div className="flex items-center gap-6 tabular-nums">
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Unread</p>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">5</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Urgent</p>
                      <p className="text-lg font-semibold text-[#E5534B]">2</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Needs reply</p>
                      <p className="text-lg font-semibold text-[#D99B26]">3</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Done</p>
                      <p className="text-lg font-semibold text-[#3FB950]">4</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        Daily brief
                      </span>
                      <span className="text-xs text-[var(--text-muted)] tabular-nums">
                        8:00 AM
                      </span>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#E5534B] shrink-0" />
                        <p className="text-[var(--text-primary)]">
                          <strong>Elena Rostova</strong> needs final Q4 ARR numbers before 2:00 PM today.
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#E5534B] shrink-0" />
                        <p className="text-[var(--text-primary)]">
                          <strong>Jordan Vance</strong> requested the signed SOC2 letter by tomorrow 10:00 AM.
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#D99B26] shrink-0" />
                        <p className="text-[var(--text-secondary)]">
                          <strong>Marcus Okoye</strong> is waiting on SSO contract approval in #product-launch-ops.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        Next tasks
                      </span>
                      <span className="text-xs font-medium text-[var(--accent-soft)] tabular-nums">
                        92% focus
                      </span>
                    </div>
                    <div className="divide-y divide-[var(--border-subtle)] text-xs">
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-[var(--text-primary)]">Send Q4 ARR sign-off</span>
                        <span className="text-[#D99B26] tabular-nums">2:00 PM</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-[var(--text-primary)]">Approve Acme SSO terms</span>
                        <span className="text-[var(--text-muted)] tabular-nums">Fri</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-[var(--text-secondary)] line-through">Review v2.8 release notes</span>
                        <span className="text-[#3FB950]">Done</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. How It Works (3 numbered steps + self-drawing connecting line) */}
        <section
          id="how-it-works"
          ref={stepsSection.ref}
          className={cn(
            "py-24 border-t border-[var(--border-subtle)] transition-all duration-500",
            stepsSection.inView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3"
          )}
        >
          <div className="max-w-xl mb-16">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
              Three calm steps.
            </h2>
          </div>

          <div className="relative">
            {/* Thin self-drawing horizontal line on desktop */}
            <svg
              aria-hidden="true"
              className="hidden md:block absolute top-6 left-[12%] right-[12%] h-0.5 w-[76%] pointer-events-none"
              viewBox="0 0 800 2"
              fill="none"
            >
              <line
                x1="0"
                y1="1"
                x2="800"
                y2="1"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="1"
                x2="800"
                y2="1"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="800"
                strokeDashoffset={stepsSection.inView ? "0" : "800"}
                style={{
                  transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </svg>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
              {/* Step 1 */}
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Connect
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Link Gmail and Slack.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] border border-[var(--border-subtle)]">
                    <Mail className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    Gmail
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] border border-[var(--border-subtle)]">
                    <MessageSquare className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    Slack
                  </span>
                  <span className="ml-auto text-xs text-[#3FB950]">Connected</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Read
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Instantly sorts every message by urgency.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-primary)]">Board deck sign-off</span>
                    <span className="rounded px-1.5 py-0.5 bg-red-500/15 text-red-300">
                      Immediate
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">SSO contract terms</span>
                    <span className="rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-300">
                      Needs reply
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Act
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Get a daily brief, replies and tasks.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 text-[var(--text-primary)]">
                    <CheckCircle2 className="h-4 w-4 text-[#3FB950]" />
                    Reply draft ready
                  </span>
                  <span className="text-[var(--accent-soft)] font-medium">Review</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Features Grid (6 items, spacious, no heavy borders) */}
        <section
          id="features"
          ref={featuresSection.ref}
          className={cn(
            "py-24 border-t border-[var(--border-subtle)] transition-all duration-500",
            featuresSection.inView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3"
          )}
        >
          <div className="max-w-xl mb-16">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Features
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
              Built for focus.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="group space-y-3 rounded-xl p-2 -m-2 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-soft)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Product Showcase (Priority Queue & Reply Preview) */}
        <section
          ref={showcaseSection.ref}
          className={cn(
            "py-24 border-t border-[var(--border-subtle)] transition-all duration-500",
            showcaseSection.inView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3"
          )}
        >
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Priority queue
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Every request paired with its deadline and a ready-to-edit draft.
                </p>
              </div>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                3 open items
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  source: "Gmail",
                  sender: "Elena Rostova",
                  action: "Submit Q4 ARR bridge & SLA sign-off",
                  deadline: "Today, 2:00 PM",
                  urgency: "Immediate",
                  urgencyClass: "bg-red-500/15 text-red-300",
                },
                {
                  source: "Slack",
                  sender: "Marcus Okoye",
                  action: "Approve Enterprise SSO security addendum (Sec 4.2)",
                  deadline: "Friday, 5:00 PM",
                  urgency: "Needs reply",
                  urgencyClass: "bg-amber-500/15 text-amber-300",
                },
                {
                  source: "Gmail",
                  sender: "Sarah Chen",
                  action: "Confirm Thursday 2:00 PM Mobile Launch sync",
                  deadline: "Thursday, 2:00 PM",
                  urgency: "Needs reply",
                  urgencyClass: "bg-amber-500/15 text-amber-300",
                },
              ].map((row) => (
                <div
                  key={row.action}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-white/[0.04] px-2 py-0.5 text-[var(--text-secondary)]">
                        {row.source}
                      </span>
                      <span className={cn("rounded px-2 py-0.5 font-medium", row.urgencyClass)}>
                        {row.urgency}
                      </span>
                      <span className="text-[var(--text-muted)]">from {row.sender}</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {row.action}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs text-[#D99B26] tabular-nums">
                      <Clock className="h-3.5 w-3.5" />
                      {row.deadline}
                    </span>
                    <span className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white">
                      Done
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[var(--text-muted)] text-center pt-2">
              Mark items done, snooze them, or open the original message to reply.
            </p>
          </div>
        </section>

        {/* 6. Final Call to Action */}
        <section
          ref={ctaSection.ref}
          className={cn(
            "py-24 border-t border-[var(--border-subtle)] text-center transition-all duration-500",
            ctaSection.inView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3"
          )}
        >
          <div className="mx-auto max-w-md space-y-6">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
              Start your day clear.
            </h2>
            <div>
              <Link
                href={isLoggedIn ? "/overview" : "/register"}
                data-testid="cta-get-started-button"
              >
                <Button variant="primary" size="lg" shimmer>
                  {isLoggedIn ? "Open workspace" : "Get started"}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Minimal Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-10">
        <div className="mx-auto flex flex-col sm:flex-row max-w-[1120px] items-center justify-between gap-4 px-6 text-xs text-[var(--text-muted)]">
          <Logo />
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-[var(--text-secondary)]">
              How it works
            </a>
            <a href="#features" className="hover:text-[var(--text-secondary)]">
              Features
            </a>
            <Link href="/login" className="hover:text-[var(--text-secondary)]">
              Log in
            </Link>
            <Link href="/register" className="hover:text-[var(--text-secondary)]">
              Get started
            </Link>
          </div>
          <p className="tabular-nums">© {new Date().getFullYear()} Instantly</p>
        </div>
      </footer>
    </div>
  );
}

