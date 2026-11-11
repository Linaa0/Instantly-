"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Unplug,
} from "lucide-react";
import { api } from "@/lib/api";
import { SkeletonCard } from "@/components/ui-badges";
import { Button, Card } from "@/components/ui-primitives";
import { formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/providers";

export default function IntegrationsPage() {
  const router = useRouter();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const handledOAuthParamsRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || handledOAuthParamsRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;

    handledOAuthParamsRef.current = true;
    window.history.replaceState({}, "", "/integrations");
    router.replace("/integrations");

    if (connected === "gmail") {
      notify("Gmail connected");
    } else if (connected === "slack") {
      notify("Slack connected");
    } else if (error) {
      notify("Couldn't connect Gmail. Try again.", undefined, "warning");
    }

    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["messages"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, [notify, queryClient, router]);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.getIntegrations,
  });

  const connectMutation = useMutation({
    mutationFn: (platform: "gmail" | "slack") => api.connectIntegration(platform),
    onSuccess: (res, platform) => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      if (res.connected) {
        setFeedbackMap((prev) => ({ ...prev, [platform]: "" }));
        notify(`${platform === "slack" ? "Slack" : "Gmail"} connected`, res.message);
      } else if (res.authorization_url) {
        window.location.href = res.authorization_url;
      } else if (res.message) {
        setFeedbackMap((prev) => ({ ...prev, [platform]: res.message || "" }));
        notify("Credentials needed", res.message, "warning");
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (platform: "gmail" | "slack") =>
      api.disconnectIntegration(platform),
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify("Disconnected", `${platform} disconnected.`, "info");
    },
  });

  const restoreDemoMutation = useMutation({
    mutationFn: (platform: "gmail" | "slack") =>
      api.restoreDemoIntegration(platform),
    onSuccess: (_, platform) => {
      setFeedbackMap((prev) => ({ ...prev, [platform]: "" }));
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify("Demo feed enabled", `Using sample data for ${platform}.`);
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: (res) => {
      queryClient.invalidateQueries();
      notify("Synced", `${res.messages_fetched} messages checked.`);
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-12" data-testid="integrations-page">
      {/* Header */}
      <div className="stagger-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Integrations
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Connect Gmail and Slack to pull in your messages.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          loading={syncMutation.isPending}
          onClick={() => syncMutation.mutate()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sync all
        </Button>
      </div>

      {/* Cards */}
      <div className="stagger-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {integrations.map((integ) => {
          const isGmail = integ.platform === "gmail";
          const feedback = feedbackMap[integ.platform] || integ.error_message;
          return (
            <Card
              key={integ.id}
              data-testid={`integration-card-${integ.platform}`}
              className="p-8 flex flex-col justify-between space-y-8"
            >
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                      {isGmail ? (
                        <Mail className="h-5 w-5" />
                      ) : (
                        <MessageSquare className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        {isGmail ? "Gmail" : "Slack"}
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        {integ.account_identifier || "Not connected"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      integ.status === "connected"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : integ.status === "needs_reconnect" || integ.status === "error"
                        ? "bg-amber-500/10 text-amber-300"
                        : integ.status === "demo"
                        ? "bg-white/[0.04] text-[var(--text-secondary)]"
                        : "bg-white/[0.02] text-[var(--text-muted)]"
                    }`}
                  >
                    {integ.status === "demo"
                      ? "Sample feed"
                      : integ.status === "needs_reconnect"
                      ? "Needs reconnect"
                      : integ.status}
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)] text-xs">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[var(--text-muted)]">Last synced</span>
                    <span className="text-[var(--text-primary)] tabular-nums">
                      {formatRelativeTime(integ.last_synced_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[var(--text-muted)]">OAuth keys</span>
                    <span className="text-[var(--text-secondary)]">
                      {integ.credentials_configured ? "Ready" : "Not set in .env"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    Permissions used
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {integ.scopes.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                      >
                        {s.replace("https://www.googleapis.com/auth/", "")}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {integ.configuration_instructions}
                </p>

                {feedback && (
                  <div
                    data-testid={`integration-feedback-${integ.platform}`}
                    className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-2.5"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{feedback}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[var(--border-subtle)]">
                <Button
                  variant="primary"
                  size="md"
                  loading={connectMutation.isPending}
                  onClick={() => connectMutation.mutate(integ.platform)}
                  data-testid={`connect-${integ.platform}-button`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect {isGmail ? "Gmail" : "Slack"}
                </Button>

                {integ.status === "disconnected" ? (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => restoreDemoMutation.mutate(integ.platform)}
                  >
                    Use sample data
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => disconnectMutation.mutate(integ.platform)}
                    data-testid={`disconnect-${integ.platform}-button`}
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
