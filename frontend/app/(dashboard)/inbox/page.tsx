"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Star,
  MailOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { MessageItem } from "@/types";
import {
  PlatformBadge,
  ReviewRequiredBadge,
  SkeletonCard,
  UrgencyBadge,
} from "@/components/ui-badges";
import { EmptyState } from "@/components/ui-primitives";
import { MessageInspector } from "@/components/message-inspector";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialSearch = searchParams.get("search") || "";
  const initialMsgId = searchParams.get("messageId") || null;

  const [search, setSearch] = useState(initialSearch);
  const [searchField, setSearchField] = useState<"all" | "sender" | "subject" | "content">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "gmail" | "slack">("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "priority">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(initialMsgId);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: [
      "messages",
      search,
      searchField,
      sourceFilter,
      urgencyFilter,
      unreadOnly,
      sortBy,
    ],
    queryFn: () =>
      api.getMessages({
        search,
        search_field: searchField,
        source: sourceFilter,
        urgency: urgencyFilter,
        unread_only: unreadOnly,
        sort_by: sortBy,
      }),
  });

  useEffect(() => {
    if (!selectedId && messages.length > 0) {
      setSelectedId(messages[0].id);
    } else if (
      selectedId &&
      messages.length > 0 &&
      !messages.some((m) => m.id === selectedId)
    ) {
      setSelectedId(messages[0].id);
    }
  }, [messages, selectedId]);

  const toggleStarMutation = useMutation({
    mutationFn: (m: MessageItem) =>
      api.updateMessage(m.id, { is_starred: !m.is_starred }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: (m: MessageItem) =>
      api.updateMessage(m.id, { is_unread: !m.is_unread }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const selectedMessage =
    messages.find((m) => m.id === selectedId) || messages[0] || null;

  return (
    <div className="space-y-8" data-testid="inbox-page">
      {/* Header */}
      <div className="stagger-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Unified Inbox
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            All your Gmail and Slack messages in one place.
          </p>
        </div>

        <span className="text-xs text-[var(--text-muted)] tabular-nums">
          {messages.length} {messages.length === 1 ? "message" : "messages"}
        </span>
      </div>

      {/* Clean Filter Bar */}
      <div className="stagger-2 flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sender, subject or message..."
              data-testid="inbox-search-input"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-9 pr-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={searchField}
              onChange={(e) =>
                setSearchField(
                  e.target.value as "all" | "sender" | "subject" | "content"
                )
              }
              aria-label="Search scope"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="all">All fields</option>
              <option value="sender">Sender</option>
              <option value="subject">Subject</option>
              <option value="content">Content</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              data-testid="inbox-urgency-filter"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="ALL">All priorities</option>
              <option value="IMMEDIATE">Immediate</option>
              <option value="NEEDS_RESPONSE">Needs reply</option>
              <option value="IMPORTANT">Important</option>
              <option value="FYI_ONLY">FYI</option>
              <option value="NO_ACTION">No action</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "newest" | "oldest" | "priority")
              }
              aria-label="Sort messages"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="newest">Newest</option>
              <option value="priority">Priority</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "gmail", label: "Gmail" },
                { id: "slack", label: "Slack" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                data-testid={`source-filter-${tab.id}`}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  sourceFilter === tab.id
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              unreadOnly
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
            )}
          >
            <MailOpen className="h-3.5 w-3.5" />
            Unread only
          </button>
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="stagger-3 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-2">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : messages.length === 0 ? (
            <EmptyState
              title={
                search || urgencyFilter !== "ALL" || sourceFilter !== "all" || unreadOnly
                  ? "No messages match your filters."
                  : "No messages yet. Link Gmail or Slack to start seeing your feed."
              }
              actionLabel={
                search || urgencyFilter !== "ALL" || sourceFilter !== "all" || unreadOnly
                  ? "Clear filters"
                  : "Go to Integrations"
              }
              onAction={() => {
                if (search || urgencyFilter !== "ALL" || sourceFilter !== "all" || unreadOnly) {
                  setSearch("");
                  setUrgencyFilter("ALL");
                  setSourceFilter("all");
                  setUnreadOnly(false);
                } else {
                  router.push("/integrations");
                }
              }}
            />
          ) : (
            messages.map((msg) => {
              const selected = selectedMessage?.id === msg.id;
              return (
                <div
                  key={msg.id}
                  onClick={() => setSelectedId(msg.id)}
                  data-testid={`inbox-message-card-${msg.external_id}`}
                  className={cn(
                    "group interactive-lift cursor-pointer rounded-xl border p-5 transition-all min-h-[64px]",
                    selected
                      ? "border-[var(--accent)] bg-[var(--bg-surface)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)]">
                        {getInitials(msg.sender_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs",
                              msg.is_unread
                                ? "font-semibold text-[var(--text-primary)]"
                                : "font-medium text-[var(--text-secondary)]"
                            )}
                          >
                            {msg.sender_name}
                          </span>
                          {msg.is_unread && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {msg.sender_email_or_handle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-[var(--text-muted)] tabular-nums">
                        {formatRelativeTime(msg.received_at)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStarMutation.mutate(msg);
                        }}
                        className="opacity-60 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[#D99B26] transition"
                        aria-label="Star message"
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            msg.is_starred && "fill-[#D99B26] text-[#D99B26] opacity-100"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)] leading-snug">
                    {msg.subject_or_channel}
                  </h3>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                    {msg.ai_analysis?.one_sentence_summary || msg.preview}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PlatformBadge source={msg.source} />
                      <UrgencyBadge urgency={msg.effective_urgency} />
                      {msg.ai_analysis?.review_required && <ReviewRequiredBadge />}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReadMutation.mutate(msg);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                    >
                      {msg.is_unread ? "Mark read" : "Mark unread"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Pane */}
        <div className="lg:col-span-7 lg:sticky lg:top-20">
          <MessageInspector message={selectedMessage} />
        </div>
      </div>
    </div>
  );
}

export default function UnifiedInboxPage() {
  return (
    <Suspense fallback={<SkeletonCard className="h-96" />}>
      <InboxContent />
    </Suspense>
  );
}
