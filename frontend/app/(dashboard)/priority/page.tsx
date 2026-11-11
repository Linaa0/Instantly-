"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  Edit3,
  UserPlus,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { MessageItem, UrgencyCategory } from "@/types";
import {
  PlatformBadge,
  SkeletonCard,
  UrgencyBadge,
} from "@/components/ui-badges";
import { Button, EmptyState } from "@/components/ui-primitives";
import { MessageInspectorModal } from "@/components/message-inspector";
import { useToast } from "@/components/providers";

export default function PriorityQueuePage() {
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"active" | "snoozed" | "completed">("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editActionText, setEditActionText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(
    null
  );

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.getMessages({ sort_by: "priority" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        priority_status?: "pending" | "completed" | "snoozed" | "ignored";
        snooze_hours?: number;
        custom_action_override?: string;
        manual_priority_override?: UrgencyCategory;
      };
    }) => api.updateMessage(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignee }: { id: string; assignee: string }) =>
      api.assignMessage(
        id,
        assignee,
        `${assignee.toLowerCase().replace(" ", ".")}@instantly.team`,
        "Assigned from Priority"
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      notify("Assigned", `Assigned to ${vars.assignee}.`);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const actionableMessages = messages.filter(
    (m) =>
      m.effective_urgency in { IMMEDIATE: 1, NEEDS_RESPONSE: 1, IMPORTANT: 1 } ||
      m.ai_analysis?.requires_action
  );

  const filtered = actionableMessages.filter((m) => {
    if (tab === "completed") return m.priority_status === "completed";
    if (tab === "snoozed") return m.priority_status === "snoozed";
    return m.priority_status === "pending";
  });

  const activeSelectedMessage = selectedMessage
    ? messages.find((m) => m.id === selectedMessage.id) || selectedMessage
    : null;

  return (
    <div className="space-y-8" data-testid="priority-page">
      {/* Header */}
      <div className="stagger-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Priority queue
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Messages waiting on your reply or decision.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] p-1 border border-[var(--border-subtle)]">
          {(
            [
              { id: "active", label: "Open" },
              { id: "snoozed", label: "Snoozed" },
              { id: "completed", label: "Done" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                tab === t.id
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <MessageInspectorModal
        message={activeSelectedMessage}
        onClose={() => setSelectedMessage(null)}
      />

      {/* Queue Rows */}
      <div className="stagger-2 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            title={`No ${tab} items right now.`}
            actionLabel={tab !== "active" ? "View open items" : undefined}
            onAction={tab !== "active" ? () => setTab("active") : undefined}
          />
        ) : (
          filtered.map((msg) => {
            const isEditing = editingId === msg.id;
            const actionText =
              msg.custom_action_override ||
              msg.effective_action_description ||
              `Reply to ${msg.sender_name}`;
            return (
              <div
                key={msg.id}
                data-testid={`priority-item-${msg.external_id}`}
                className="group interactive-lift rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformBadge source={msg.source} />
                      <UrgencyBadge urgency={msg.effective_urgency} />
                      {msg.ai_analysis?.deadline && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#D99B26] tabular-nums">
                          <Clock className="h-3 w-3" />
                          {msg.ai_analysis.deadline}
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        from <strong className="text-[var(--text-secondary)] font-medium">{msg.sender_name}</strong>
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 max-w-xl">
                        <input
                          type="text"
                          value={editActionText}
                          onChange={(e) => setEditActionText(e.target.value)}
                          className="flex-1 rounded-lg border border-[var(--accent)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            updateMutation.mutate({
                              id: msg.id,
                              payload: {
                                custom_action_override: editActionText,
                              },
                            });
                            setEditingId(null);
                            notify("Updated", "Action step saved.");
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                          {actionText}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(msg.id);
                            setEditActionText(actionText);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition"
                          title="Edit action"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {msg.subject_or_channel} — {msg.ai_analysis?.one_sentence_summary}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={msg.effective_urgency}
                      onChange={(e) => {
                        updateMutation.mutate({
                          id: msg.id,
                          payload: {
                            manual_priority_override: e.target
                              .value as UrgencyCategory,
                          },
                        });
                        notify("Priority changed", `Set to ${e.target.value}.`);
                      }}
                      aria-label="Change priority"
                      className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <option value="IMMEDIATE">Immediate</option>
                      <option value="NEEDS_RESPONSE">Needs reply</option>
                      <option value="IMPORTANT">Important</option>
                      <option value="FYI_ONLY">FYI</option>
                    </select>

                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() =>
                        assignMutation.mutate({
                          id: msg.id,
                          assignee: "Sarah Chen",
                        })
                      }
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {msg.assignments[0]?.assignee_name || "Assign"}
                    </Button>

                    {msg.priority_status !== "snoozed" && (
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => {
                          updateMutation.mutate({
                            id: msg.id,
                            payload: {
                              priority_status: "snoozed",
                              snooze_hours: 4,
                            },
                          });
                          notify("Snoozed", "Hidden for 4 hours.", "info");
                        }}
                      >
                        Snooze
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setSelectedMessage(msg)}
                    >
                      Open
                    </Button>

                    {msg.priority_status === "completed" ? (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          updateMutation.mutate({
                            id: msg.id,
                            payload: { priority_status: "pending" },
                          });
                          notify("Reopened", "Back in open queue.");
                        }}
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
                            id: msg.id,
                            payload: { priority_status: "completed" },
                          });
                          notify("Done", actionText);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Done
                      </Button>
                    )}
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
