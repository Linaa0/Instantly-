"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  Trash2,
  ExternalLink,
  Edit3,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { TaskItem } from "@/types";
import { PlatformBadge, SkeletonCard } from "@/components/ui-badges";
import { Button, EmptyState } from "@/components/ui-primitives";
import { useToast } from "@/components/providers";

export default function TasksPage() {
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "snoozed" | "completed"
  >("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">(
    "HIGH"
  );
  const [dueDateText, setDueDateText] = useState("Today, 5:00 PM");
  const [isExplicit, setIsExplicit] = useState(true);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", statusFilter],
    queryFn: () => api.getTasks(statusFilter),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTask({
        title,
        description,
        priority,
        due_date_text: dueDateText,
        is_deadline_explicit: isExplicit,
        assigned_to_name: "Alex Morgan",
      }),
    onSuccess: (created) => {
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      notify("Task added", created.title);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<TaskItem> & { snooze_hours?: number };
    }) => api.updateTask(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      notify("Task removed", undefined, "info");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="tasks-page">
      {/* Header */}
      <div className="stagger-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Tasks
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Action items pulled from your messages or added by you.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] p-1 border border-[var(--border-subtle)]">
          {(
            [
              { id: "all", label: "All" },
              { id: "pending", label: "To do" },
              { id: "snoozed", label: "Snoozed" },
              { id: "completed", label: "Done" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              data-testid={`task-filter-${tab.id}`}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                statusFilter === tab.id
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Add Form */}
      <form
        onSubmit={handleCreateSubmit}
        className="stagger-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a task..."
              data-testid="new-task-title-input"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <input
              type="text"
              value={dueDateText}
              onChange={(e) => setDueDateText(e.target.value)}
              placeholder="When is it due?"
              data-testid="new-task-due-input"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={priority}
              onChange={(e) =>
                setPriority(
                  e.target.value as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
                )
              }
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={createMutation.isPending}
              disabled={!title.trim()}
              data-testid="create-task-submit-button"
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional note..."
            className="flex-1 rounded-lg border border-transparent bg-[var(--bg-elevated)]/60 px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:border-[var(--border-subtle)] focus:outline-none"
          />
          <label className="inline-flex items-center gap-2 cursor-pointer text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={isExplicit}
              onChange={(e) => setIsExplicit(e.target.checked)}
              className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--accent)]"
            />
            <span>Exact due date</span>
          </label>
        </div>
      </form>

      {/* Task List */}
      <div className="stagger-3 space-y-2.5">
        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks in this view."
            actionLabel={statusFilter !== "all" ? "Show all tasks" : undefined}
            onAction={statusFilter !== "all" ? () => setStatusFilter("all") : undefined}
          />
        ) : (
          tasks.map((task) => {
            const isCompleted = task.status === "completed";
            const isEditing = editingTaskId === task.id;
            return (
              <div
                key={task.id}
                data-testid={`task-card-${task.id}`}
                className={`group interactive-lift rounded-xl border p-5 transition min-h-[60px] ${
                  isCompleted
                    ? "border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 opacity-70"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          task.priority === "CRITICAL"
                            ? "bg-red-500/10 text-red-300"
                            : task.priority === "HIGH"
                            ? "bg-amber-500/10 text-amber-300"
                            : "bg-white/[0.04] text-[var(--text-secondary)]"
                        }`}
                      >
                        {task.priority}
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] tabular-nums">
                        <CalendarClock className="h-3.5 w-3.5 text-[#D99B26]" />
                        {task.due_date_text || "No due date"}
                      </span>

                      <span className="text-[11px] text-[var(--text-muted)]">
                        ({task.is_deadline_explicit ? "Exact date" : "Estimated"})
                      </span>

                      {task.message_source && (
                        <PlatformBadge source={task.message_source} />
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 max-w-xl">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 rounded-lg border border-[var(--accent)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            updateMutation.mutate({
                              id: task.id,
                              payload: { title: editTitle },
                            });
                            setEditingTaskId(null);
                            notify("Updated", "Task title saved.");
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-base font-semibold transition-all ${
                            isCompleted
                              ? "line-through text-[var(--text-muted)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {task.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTaskId(task.id);
                            setEditTitle(task.title);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition"
                          aria-label="Edit task"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {task.description && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        {task.description}
                      </p>
                    )}

                    {task.message_id && (
                      <div className="pt-1">
                        <Link
                          href={`/inbox?messageId=${task.message_id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-soft)] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {task.message_subject || "View source message"}
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={task.priority}
                      onChange={(e) => {
                        updateMutation.mutate({
                          id: task.id,
                          payload: {
                            priority: e.target.value as
                              | "CRITICAL"
                              | "HIGH"
                              | "MEDIUM"
                              | "LOW",
                          },
                        });
                        notify("Priority updated", e.target.value);
                      }}
                      className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-secondary)]"
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>

                    {!isCompleted && task.status !== "snoozed" && (
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => {
                          updateMutation.mutate({
                            id: task.id,
                            payload: { status: "snoozed", snooze_hours: 24 },
                          });
                          notify("Snoozed", "Until tomorrow.", "info");
                        }}
                      >
                        Snooze
                      </Button>
                    )}

                    {isCompleted ? (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          updateMutation.mutate({
                            id: task.id,
                            payload: { status: "pending" },
                          });
                          notify("Reopened", task.title);
                        }}
                        data-testid={`reopen-task-${task.id}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => {
                          updateMutation.mutate({
                            id: task.id,
                            payload: { status: "completed" },
                          });
                          notify("Done", task.title);
                        }}
                        data-testid={`complete-task-${task.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Done
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(task.id)}
                      className="opacity-60 group-hover:opacity-100 rounded-lg p-2 text-[var(--text-muted)] hover:text-red-400 transition"
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
