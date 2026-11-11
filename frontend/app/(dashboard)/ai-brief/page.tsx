"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { api } from "@/lib/api";
import { MessageItem, UrgencyCategory } from "@/types";
import {
  PlatformBadge,
  ReviewRequiredBadge,
  SkeletonCard,
  UrgencyBadge,
} from "@/components/ui-badges";
import { Button } from "@/components/ui-primitives";
import { MessageInspectorModal } from "@/components/message-inspector";

const SECTIONS: {
  key: UrgencyCategory;
  title: string;
  subtitle: string;
}[] = [
  {
    key: "IMMEDIATE",
    title: "Immediate",
    subtitle: "Same-day deadlines and urgent blockers.",
  },
  {
    key: "NEEDS_RESPONSE",
    title: "Needs reply",
    subtitle: "Questions, approvals and meeting requests waiting on you.",
  },
  {
    key: "IMPORTANT",
    title: "Important",
    subtitle: "Team and product updates worth reading.",
  },
  {
    key: "FYI_ONLY",
    title: "FYI",
    subtitle: "Routine digests and background notes.",
  },
  {
    key: "NO_ACTION",
    title: "No action",
    subtitle: "Promotions and newsletters you can skip.",
  },
];

export default function AIBriefPage() {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: () => api.getMessages(),
  });

  const [inspectedMessage, setInspectedMessage] = useState<MessageItem | null>(
    null
  );

  const activeInspectedMessage = inspectedMessage
    ? messages.find((m) => m.id === inspectedMessage.id) || inspectedMessage
    : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-12" data-testid="ai-brief-page">
      {/* Header */}
      <div className="stagger-1 pb-6 border-b border-[var(--border-subtle)]">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Daily brief
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Every message sorted by what needs your attention first.
        </p>
      </div>

      {/* Portaled Modal Inspector */}
      <MessageInspectorModal
        message={activeInspectedMessage}
        onClose={() => setInspectedMessage(null)}
      />

      {/* Five Categorized Sections */}
      <div className="stagger-2 space-y-12">
        {SECTIONS.map((sec) => {
          const items = messages.filter((m) => m.effective_urgency === sec.key);
          return (
            <section key={sec.key} className="space-y-4">
              <div className="flex items-baseline justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {sec.title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {sec.subtitle}
                  </p>
                </div>
                <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4">
                  Nothing in this group right now.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {items.map((msg) => {
                    const ai = msg.ai_analysis;
                    const confPct = ai
                      ? Math.round(ai.confidence_score * 100)
                      : 92;
                    return (
                      <div
                        key={msg.id}
                        className="interactive-lift rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 flex flex-col justify-between space-y-5"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <PlatformBadge source={msg.source} />
                              <UrgencyBadge urgency={msg.effective_urgency} />
                              {ai?.review_required && <ReviewRequiredBadge />}
                            </div>
                            <span className="text-xs text-[var(--text-muted)] tabular-nums">
                              {confPct}% match
                            </span>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-[var(--text-secondary)]">
                              {msg.sender_name}
                            </p>
                            <h3 className="text-base font-semibold text-[var(--text-primary)] mt-0.5 leading-snug">
                              {msg.subject_or_channel}
                            </h3>
                          </div>

                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {ai?.one_sentence_summary || msg.preview}
                          </p>

                          <p className="text-xs text-[var(--text-muted)]">
                            {ai?.classification_reason}
                          </p>

                          {(msg.effective_action_description || ai?.deadline) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)] text-xs">
                              <span className="text-[var(--text-primary)] font-medium">
                                {msg.effective_action_description || "Review message"}
                              </span>
                              {ai?.deadline && (
                                <span className="inline-flex items-center gap-1 text-[#D99B26] tabular-nums">
                                  <Clock className="h-3 w-3" />
                                  {ai.deadline}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end pt-3 border-t border-[var(--border-subtle)]">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setInspectedMessage(msg)}
                            data-testid={`inspect-original-${msg.external_id}`}
                          >
                            Read & reply
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
