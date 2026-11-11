"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { SkeletonCard } from "@/components/ui-badges";
import { Button, Card, Stat } from "@/components/ui-primitives";
import { useToast } from "@/components/providers";

export default function AnalyticsPage() {
  const { notify } = useToast();
  const [rangeDays, setRangeDays] = useState<number>(7);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", rangeDays],
    queryFn: () => api.getAnalytics(rangeDays),
  });

  const exportReportMutation = useMutation({
    mutationFn: api.exportReport,
    onSuccess: (res) => {
      const blob = new Blob([res.content], {
        type: "text/markdown;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify("Exported", `Saved ${res.filename}`);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-12" data-testid="analytics-page">
      {/* Header */}
      <div className="stagger-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Communications Intelligence Analytics
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Message volume, response times and completed tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] p-1 border border-[var(--border-subtle)]">
            {[
              { days: 7, label: "7d" },
              { days: 30, label: "30d" },
              { days: 90, label: "90d" },
            ].map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setRangeDays(opt.days)}
                data-testid={`analytics-range-${opt.days}`}
                className={`rounded-md px-3 py-1 text-xs font-medium tabular-nums transition ${
                  rangeDays === opt.days
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="md"
            loading={exportReportMutation.isPending}
            onClick={() => exportReportMutation.mutate()}
            data-testid="export-report-button"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="stagger-2 grid grid-cols-2 lg:grid-cols-4 gap-8">
        <Stat
          label="Messages"
          value={data.total_messages}
          hint={`${data.messages_requiring_response} need reply`}
        />
        <Stat
          label="Drafts ready"
          value={Math.round(data.response_rate_ready_pct)}
          suffix="%"
          hint="Prepared replies"
        />
        <Stat
          label="Tasks done"
          value={data.completed_tasks}
          tone="success"
          hint={`${data.pending_tasks} open`}
        />
        <Stat
          label="Confidence"
          value={Math.round(data.avg_ai_confidence)}
          suffix="%"
          hint={`${data.review_required_count} need review`}
        />
      </div>

      {/* Main Charts */}
      <div className="stagger-3 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 p-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Daily activity
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-6">
            Messages received over the last {rangeDays} days.
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_activity}>
                <defs>
                  <linearGradient id="anaGmail" x1="0" y1="0" x2="0" y2="1">
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
                <Legend />
                <Area
                  type="monotone"
                  dataKey="gmail"
                  name="Gmail"
                  stroke="#7C66DC"
                  strokeWidth={2}
                  fill="url(#anaGmail)"
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

        <Card className="lg:col-span-4 p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              By source
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Share of messages by app.
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.platform_breakdown}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                >
                  {data.platform_breakdown.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={idx === 0 ? "#7C66DC" : "#4B5563"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16181D",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
            {data.platform_breakdown.map((p, idx) => (
              <div
                key={p.name}
                className="flex items-center justify-between text-xs tabular-nums"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: idx === 0 ? "#7C66DC" : "#4B5563",
                    }}
                  />
                  <span className="text-[var(--text-primary)] font-medium">
                    {p.name}
                  </span>
                </div>
                <span className="text-[var(--text-secondary)]">{p.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Second Row */}
      <div className="stagger-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            By priority
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-6">
            Messages grouped by urgency.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.urgency_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="category" stroke="#6C707D" fontSize={11} />
                <YAxis stroke="#6C707D" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16181D",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" name="Messages" fill="#7C66DC" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Weekly pace
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-6">
            Messages sorted vs tasks completed.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly_comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#6C707D" fontSize={12} />
                <YAxis stroke="#6C707D" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16181D",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="triaged"
                  name="Messages"
                  fill="#7C66DC"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="actions_completed"
                  name="Tasks done"
                  fill="#4B5563"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
