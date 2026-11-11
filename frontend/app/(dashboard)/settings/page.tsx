"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { SkeletonCard } from "@/components/ui-badges";
import { Button, Card } from "@/components/ui-primitives";
import { useToast } from "@/components/providers";

export default function SettingsPage() {
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: api.getPreferences,
  });

  const [fullName, setFullName] = useState("Alex Morgan");
  const [jobTitle, setJobTitle] = useState("VP of Product");
  const [defaultTone, setDefaultTone] = useState("professional");
  const [aiProvider, setAiProvider] = useState("heuristic");
  const [aiModelName, setAiModelName] = useState("gpt-4o-mini");
  const [morningTime, setMorningTime] = useState("08:00");
  const [autoExtract, setAutoExtract] = useState(true);
  const [highPriNotifs, setHighPriNotifs] = useState(true);
  const [demoMode, setDemoMode] = useState(true);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setJobTitle(user.job_title || "Product Lead");
    }
  }, [user]);

  useEffect(() => {
    if (prefs) {
      setDefaultTone(prefs.default_reply_tone);
      setAiProvider(prefs.ai_provider);
      setAiModelName(prefs.ai_model_name);
      setMorningTime(prefs.morning_brief_time);
      setAutoExtract(prefs.auto_extract_tasks);
      setHighPriNotifs(prefs.high_priority_notifications);
      setDemoMode(prefs.demo_mode_enabled);
    }
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updatePreferences({
        full_name: fullName,
        job_title: jobTitle,
        default_reply_tone: defaultTone,
        ai_provider: aiProvider,
        ai_model_name: aiModelName,
        morning_brief_time: morningTime,
        auto_extract_tasks: autoExtract,
        high_priority_notifications: highPriNotifs,
        demo_mode_enabled: demoMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify("Saved", "Your settings were updated.");
    },
  });

  const resetDemoMutation = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: () => {
      queryClient.invalidateQueries();
      notify("Demo reset", "Sample messages restored.", "info");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-12" data-testid="settings-page">
      <div className="stagger-1 pb-6 border-b border-[var(--border-subtle)]">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Profile, reply tone and notification preferences.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        className="space-y-8"
      >
        {/* Profile */}
        <Card className="stagger-2 p-8 space-y-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="settings-fullname-input"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Role
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="stagger-3 p-8 space-y-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Model provider
              </label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                data-testid="settings-ai-provider-select"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="heuristic">Built-in (local)</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Model name
              </label>
              <input
                type="text"
                value={aiModelName}
                onChange={(e) => setAiModelName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                Default reply tone
              </label>
              <select
                value={defaultTone}
                onChange={(e) => setDefaultTone(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="professional">Professional</option>
                <option value="concise">Concise</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] pt-2">
            <label className="flex items-center justify-between py-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Auto-create tasks
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Add clear requests and deadlines to your task list.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoExtract}
                onChange={(e) => setAutoExtract(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--accent)]"
              />
            </label>

            <label className="flex items-center justify-between py-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Urgent alerts
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Notify when same-day deadlines arrive.
                </p>
              </div>
              <input
                type="checkbox"
                checked={highPriNotifs}
                onChange={(e) => setHighPriNotifs(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--accent)]"
              />
            </label>
          </div>
        </Card>

        {/* Actions */}
        <div className="stagger-4 flex flex-wrap items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            loading={resetDemoMutation.isPending}
            onClick={() => resetDemoMutation.mutate()}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset sample data
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={saveMutation.isPending}
            data-testid="save-settings-button"
          >
            <Save className="h-3.5 w-3.5" />
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
