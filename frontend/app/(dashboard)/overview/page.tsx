"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  CalendarClock,
  Mail,
  MessageSquare,
  Compass,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import {
  PlatformBadge,
  SkeletonCard,
  UrgencyBadge,
} from "@/components/ui-badges";
import {
  Button,
  Card,
  CountUpNumber,
  Stat,
  StreamingText,
} from "@/components/ui-primitives";
import { useToast, useTour } from "@/components/providers";

export default function OverviewPage() {
  const { notify } = useToast();
  const { openTour } = useTour();
  const queryClient = useQueryClient();
  const [streamingBrief, setStreamingBrief] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: (res) => {
      setStreamingBrief(true);
      queryClient.invalidateQueries();
      notify("Brief updated", `${res.messages_analyzed} messages reviewed.`);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard className="h-72" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Couldn&apos;t load your overview
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Make sure the backend server is running on port 8000.
        </p>
      </Card>
    );
  }

  if (data.total_messages === 0) {
    return (
      <div className="space-y-12" data-testid="overview-page">
        <section className="stagger-1 pb-8 border-b border-[var(--border-subtle)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-2">
            Welcome to Instantly
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Your real inbox, sorted for you.
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-xl">
            You are in a clean, isolated workspace with zero simulated data. Connect your Gmail or Slack account to start receiving your daily executive briefing and prioritized tasks.
          </p>
        </section>

        {/* Quick onboarding action cards */}
        <section className="stagger-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-8 space-y-4 border-[var(--border-strong)] bg-[var(--bg-elevated)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Connect Gmail
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Sync unread threads with read-only access. Instantly detects urgencies, extracts deadlines, and drafts context-aware replies.
              </p>
            </div>
            <Link href="/integrations" className="inline-block pt-2">
              <Button variant="primary" size="sm">
                Connect Gmail
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </Card>

          <Card className="p-8 space-y-4 border-[var(--border-strong)] bg-[var(--bg-elevated)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-surface)] text-[var(--accent)]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Connect Slack
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Connect your team channels and direct messages. Everyone in your workspace gets their own personal Slack connection.
              </p>
            </div>
            <Link href="/integrations" className="inline-block pt-2">
              <Button variant="secondary" size="sm">
                Connect Slack
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </Card>
        </section>

        <section className="stagger-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-surface)] text-[var(--accent)]">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Want a quick walkthrough?
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Take our 3-step feature tour to see how priority triage and AI drafts work.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={openTour} className="shrink-0">
            Launch tour
          </Button>
        </section>
      </div>
    );
  }

  const brief = data.morning_brief;
  const pendingCount = Math.max(0, data.messages_requiring_response - data.urgent_messages);

  return (
    <div className="space-y-12" data-testid="overview-page">
      {/* Page Header */}
      <section className="stagger-1 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-[var(--border-subtle)]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Today
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Your day, in focus.
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] tabular-nums">
            <StreamingText
              text={`${data.urgent_messages} deadlines. ${pendingCount} decisions waiting.`}
              active={streamingBrief}
            />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="md"
            shimmer
            loading={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            data-testid="run-morning-brief-button"
          >
            Morning brief
          </Button>

          <Button
            variant="secondary"
            size="md"
            loading={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            data-testid="refresh-intelligence-button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Link
            href="/inbox"
            data-testid="view-all-messages-link"
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition"
          >
            All messages
          </Link>

          <Link
            href="/priority"
            data-testid="view-priority-queue-link"
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition"
          >
            Priority queue
          </Link>
        </div>
      </section>

      {/* Clean Tabular Stat Strip (no heavy boxes) */}
      <section className="stagger-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 py-2">
        <Stat label="Unread" value={data.total_unread} hint={`${data.total_messages} total`} />
        <Stat label="Urgent" value={data.urgent_messages} tone="urgent" hint="Due today" />
        <Stat label="Needs reply" value={data.messages_requiring_response} tone="warning" hint="Drafts ready" />
        <Stat label="FYI" value={data.important_informational} hint="Updates" />
        <Stat label="To do" value={data.pending_actions} hint="Open tasks" />
        <Stat label="Done" value={data.completed_actions} tone="success" hint="Completed" />
      </section>

      {/* Daily Brief + Focus */}
      <section className="stagger-3 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <Card variant="elevated" className="lg:col-span-8 p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                AI Executive Daily Briefing
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Key priorities and deadlines across Gmail and Slack.
              </p>
            </div>
            <Link
              href="/ai-brief"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-soft)] hover:underline"
            >
              Full brief
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <p className="text-xs font-medium text-[#E5534B]">
                Urgent today
              </p>
              <ul className="space-y-2.5 text-sm text-[var(--text-primary)]">
                {brief.critical_priorities.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#E5534B] shrink-0" />
                    <span className="leading-relaxed">
                      <StreamingText text={item} active={streamingBrief} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-[#D99B26]">
                Upcoming deadlines
              </p>
              <ul className="space-y-2.5 text-sm text-[var(--text-primary)]">
                {brief.upcoming_deadlines.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CalendarClock className="h-4 w-4 text-[#D99B26] shrink-0 mt-1" />
                    <span className="leading-relaxed tabular-nums">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Worth knowing
              </p>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                {brief.important_developments.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--text-muted)] shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Suggested next steps
              </p>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                {brief.recommended_next_steps.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--accent)] shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* Focus Column */}
        <Card className="lg:col-span-4 p-8 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Focus
              </h3>
              <span className="text-2xl font-semibold text-[var(--accent-soft)] tabular-nums">
                <CountUpNumber value={brief.focus_score} suffix="%" />
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Next tasks to clear your queue.
            </p>

            <div className="divide-y divide-[var(--border-subtle)]">
              {brief.recommended_next_steps.slice(0, 3).map((step, i) => (
                <Link
                  key={i}
                  href="/tasks"
                  className="flex items-center gap-3 py-3.5 text-xs text-[var(--text-primary)] hover:text-[var(--accent-soft)] transition"
                >
                  <CheckCircle2 className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                  <span className="leading-snug">{step}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Connected</span>
            <span className="text-[var(--text-secondary)]">
              Gmail, Slack
            </span>
          </div>
        </Card>
      </section>

      {/* Bottom Row: Activity + Priority Queue */}
      <section className="stagger-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <Card className="lg:col-span-7 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Volume
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Messages received over the last 7 days.
              </p>
            </div>
            <Link
              href="/analytics"
              className="text-xs font-medium text-[var(--accent-soft)] hover:underline"
            >
              Analytics →
            </Link>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.activity_series}>
                <defs>
                  <linearGradient id="gmailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C66DC" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7C66DC" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="#6C707D" fontSize={12} />
                <YAxis stroke="#6C707D" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16181D",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="gmail"
                  name="Gmail"
                  stroke="#7C66DC"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gmailGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="slack"
                  name="Slack"
                  stroke="#A0A4B0"
                  strokeWidth={1.5}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Priority List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Needs attention
            </h3>
            <Link
              href="/priority"
              className="text-xs font-medium text-[var(--accent-soft)] hover:underline"
            >
              See all
            </Link>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {data.top_priority_messages.map((m) => (
              <Link
                key={m.id}
                href={`/inbox?messageId=${m.id}`}
                className="block p-4 hover:bg-[var(--bg-hover)] transition"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {m.sender_name}
                  </span>
                  <UrgencyBadge urgency={m.effective_urgency} />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {m.subject_or_channel}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)] tabular-nums">
                  <PlatformBadge source={m.source} />
                  <span>{m.ai_analysis?.deadline || "Needs reply"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
