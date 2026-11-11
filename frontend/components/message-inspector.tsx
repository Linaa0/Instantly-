"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Save,
  Mail,
  MessageSquare,
  Send,
  ExternalLink,
  CheckSquare,
  UserPlus,
  MessageSquarePlus,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { MessageItem } from "@/types";
import {
  PlatformBadge,
  ReviewRequiredBadge,
  UrgencyBadge,
} from "@/components/ui-badges";
import { Button, StreamingText } from "@/components/ui-primitives";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { useToast } from "@/components/providers";

interface MessageInspectorProps {
  message: MessageItem | null;
  onClose?: () => void;
}

const SLACK_PRESET_CHANNELS = [
  "#product-launch-ops",
  "#eng-platform-core",
  "#design-systems",
  "#general",
];

export function MessageInspectorModal({
  message,
  onClose,
}: {
  message: MessageItem | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!message) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [message, onClose]);

  if (!mounted || !message) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      data-testid="message-inspector-modal-backdrop"
    >
      <div
        className="w-full max-w-3xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageInspector message={message} onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}

export function MessageInspector({ message, onClose }: MessageInspectorProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    "intelligence" | "reply" | "collaborate"
  >("intelligence");
  const [replyChannel, setReplyChannel] = useState<"gmail" | "slack">("gmail");
  const [tone, setTone] = useState<
    "professional" | "friendly" | "concise" | "custom"
  >("professional");
  const [customInstructions, setCustomInstructions] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [slackTarget, setSlackTarget] = useState("#product-launch-ops");
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmGmailModal, setConfirmGmailModal] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [lastSentBanner, setLastSentBanner] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const [assigneeName, setAssigneeName] = useState("Sarah Chen");
  const [assigneeEmail, setAssigneeEmail] = useState(
    "sarah.chen@instantly.team"
  );
  const [assignNote, setAssignNote] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (message) {
      const initialDraft =
        message.suggested_replies?.[0]?.content ||
        message.ai_analysis?.suggested_reply ||
        `Hi ${message.sender_name.split(" ")[0]},\n\nThank you for your note regarding '${message.subject_or_channel}'. I am reviewing this now and will follow up shortly.\n\nBest,\nAlex`;
      setDraftText(initialDraft);
      setReplyChannel(message.source === "slack" ? "slack" : "gmail");
      setRecipientEmail(
        message.source === "gmail"
          ? message.sender_email_or_handle
          : `${message.sender_email_or_handle.replace(/^@/, "")}@company.com`
      );
      const rawSubj = message.subject_or_channel || "Follow-up";
      setReplySubject(
        rawSubj.toLowerCase().startsWith("re:") ? rawSubj : `Re: ${rawSubj}`
      );
      if (message.source === "slack") {
        setSlackTarget(
          message.subject_or_channel.startsWith("#")
            ? message.subject_or_channel
            : message.sender_email_or_handle
        );
      } else {
        setSlackTarget("#product-launch-ops");
      }
      setJustGenerated(false);
      setLastSentBanner(null);
      setTaskTitle(
        message.effective_action_description ||
          `Follow up with ${message.sender_name}`
      );
      setTaskDue(message.ai_analysis?.deadline || "Tomorrow, 5:00 PM");
    }
  }, [message]);

  const generateMutation = useMutation({
    mutationFn: (overrideTone?: "professional" | "friendly" | "concise" | "custom") => {
      if (!message) throw new Error("No message selected");
      const activeTone = overrideTone || (customInstructions.trim() ? "custom" : tone);
      return api.generateReply(
        message.id,
        activeTone,
        customInstructions,
        replyChannel
      );
    },
    onSuccess: (data) => {
      setDraftText(data.content);
      setJustGenerated(true);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify(
        "AI draft ready",
        replyChannel === "slack"
          ? "Formatted for Slack — edit anything before sending."
          : `Written in a ${tone} tone — edit anything before sending.`
      );
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: (createGmailDraft: boolean) => {
      if (!message) throw new Error("No message selected");
      return api.saveReply(message.id, tone, draftText, createGmailDraft);
    },
    onSuccess: (data, createGmailDraft) => {
      setConfirmGmailModal(false);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      if (createGmailDraft) {
        notify(
          data.gmail_draft_created ? "Saved to Gmail" : "Draft saved locally",
          data.gmail_draft_created
            ? "Ready in your Gmail drafts."
            : "Saved in Instantly. Use 'Open in Gmail' or 'Send reply' to deliver."
        );
      } else {
        notify("Draft saved", "Saved to this thread.");
      }
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: () => {
      if (!message) throw new Error("No message selected");
      const targetRecipient =
        replyChannel === "gmail" ? recipientEmail : slackTarget;
      return api.sendReply(message.id, {
        channel: replyChannel,
        recipient: targetRecipient,
        subject: replyChannel === "gmail" ? replySubject : undefined,
        content: draftText,
        tone,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      if (res.channel === "gmail" && !res.external_delivery && res.compose_url) {
        window.open(res.compose_url, "_blank", "noopener,noreferrer");
        setLastSentBanner(
          `Opened Gmail with your pre-filled reply to ${res.recipient} and marked thread as replied.`
        );
        notify(
          "Opened in Gmail",
          `Your reply to ${res.recipient} is pre-filled and ready to hit Send.`
        );
      } else {
        setLastSentBanner(res.message);
        notify(
          res.channel === "slack" ? "Sent to Slack" : "Email sent",
          res.message
        );
      }
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: () => {
      if (!message) throw new Error("No message selected");
      return api.createTask({
        title: taskTitle,
        description: `From ${message.sender_name} (${message.source}): "${message.subject_or_channel}"`,
        priority:
          message.effective_urgency === "IMMEDIATE" ? "CRITICAL" : "HIGH",
        due_date_text: taskDue,
        is_deadline_explicit: message.ai_analysis?.deadline_is_explicit ?? true,
        message_id: message.id,
        assigned_to_name: "Alex Morgan",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      notify("Task added", taskTitle);
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!message) throw new Error("No message selected");
      return api.assignMessage(
        message.id,
        assigneeName,
        assigneeEmail,
        assignNote
      );
    },
    onSuccess: () => {
      setAssignNote("");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      notify("Assigned", `Handed off to ${assigneeName}.`);
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => {
      if (!message) throw new Error("No message selected");
      return api.addComment(message.id, commentText);
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      notify("Note posted", "Visible to your team.");
    },
  });

  if (!message) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-8 text-center">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Select a message to read
        </p>
        <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">
          Summary, key dates and reply drafts appear here.
        </p>
      </div>
    );
  }

  const ai = message.ai_analysis;
  const confidencePct = ai ? Math.round(ai.confidence_score * 100) : 92;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      notify("Copied", "Reply copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Ready to copy", "Select text to copy.", "info");
    }
  };

  const handleOpenGmailCompose = () => {
    const cleanSubj = replySubject || `Re: ${message.subject_or_channel}`;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      recipientEmail
    )}&su=${encodeURIComponent(cleanSubj)}&body=${encodeURIComponent(
      draftText
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const renderReplyComposer = () => (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 p-5 space-y-4">
      {/* Top Bar: Reply Channel Selector (Gmail vs Slack) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div>
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            AI Reply & Message Composer
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Generate with AI, edit freely, and send via Gmail or Slack.
          </p>
        </div>

        <div className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => setReplyChannel("gmail")}
            data-testid="channel-option-gmail"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
              replyChannel === "gmail"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Email (Gmail)
          </button>
          <button
            type="button"
            onClick={() => setReplyChannel("slack")}
            data-testid="channel-option-slack"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
              replyChannel === "slack"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Slack message
          </button>
        </div>
      </div>

      {/* Recipient / Channel Fields */}
      {replyChannel === "gmail" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
              To (Email recipient)
            </label>
            <input
              type="text"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@company.com"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
              Subject
            </label>
            <input
              type="text"
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              placeholder="Re: Subject"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-[var(--text-muted)]">
              Slack destination (channel or @person)
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {SLACK_PRESET_CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSlackTarget(ch)}
                  className={`rounded px-2 py-0.5 text-[11px] transition ${
                    slackTarget === ch
                      ? "bg-[var(--accent-surface)] text-[var(--accent-soft)] font-medium"
                      : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {ch}
                </button>
              ))}
              {message.sender_email_or_handle.startsWith("@") && (
                <button
                  type="button"
                  onClick={() => setSlackTarget(message.sender_email_or_handle)}
                  className={`rounded px-2 py-0.5 text-[11px] transition ${
                    slackTarget === message.sender_email_or_handle
                      ? "bg-[var(--accent-surface)] text-[var(--accent-soft)] font-medium"
                      : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {message.sender_email_or_handle}
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={slackTarget}
            onChange={(e) => setSlackTarget(e.target.value)}
            placeholder="#channel or @username"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      )}

      {/* AI Tone & Prompt Bar */}
      <div className="space-y-2.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["professional", "friendly", "concise", "custom"] as const).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTone(t);
                    if (t !== "custom") {
                      generateMutation.mutate(t);
                    }
                  }}
                  data-testid={`tone-${t}`}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                    tone === t
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t}
                </button>
              )
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            loading={generateMutation.isPending}
            onClick={() => generateMutation.mutate(undefined)}
            data-testid="regenerate-reply-button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Write with AI
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setTone("custom");
                generateMutation.mutate("custom");
              }
            }}
            placeholder="Tell AI what to say or modify (e.g. 'Confirm I will join at 8 PM', 'Ask to move to Friday')..."
            className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      </div>

      {justGenerated && (
        <p className="text-xs text-[var(--text-muted)]">
          <StreamingText text="AI draft updated — feel free to edit below." active />
        </p>
      )}

      {/* Editable Message Body */}
      <textarea
        rows={6}
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        data-testid="reply-draft-textarea"
        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-primary)] leading-relaxed focus:border-[var(--accent)] focus:outline-none"
      />

      {lastSentBanner && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{lastSentBanner}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleCopy}
            data-testid="copy-reply-button"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[#3FB950]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>

          <Button
            variant="secondary"
            size="md"
            loading={saveDraftMutation.isPending}
            onClick={() => saveDraftMutation.mutate(false)}
            data-testid="save-draft-button"
          >
            <Save className="h-3.5 w-3.5" />
            Save draft
          </Button>

          {replyChannel === "gmail" && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleOpenGmailCompose}
              title="Open pre-filled email in Gmail web"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Gmail
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {replyChannel === "gmail" && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setConfirmGmailModal(true)}
            >
              <Mail className="h-3.5 w-3.5" />
              Save to Gmail
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            loading={sendReplyMutation.isPending}
            onClick={() => sendReplyMutation.mutate()}
            data-testid="send-reply-button"
          >
            <Send className="h-3.5 w-3.5" />
            {replyChannel === "slack" ? `Send to ${slackTarget}` : "Send reply"}
          </Button>
        </div>
      </div>

      {confirmGmailModal && (
        <div className="animate-modal-in rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            Create Gmail draft?
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            We&apos;ll save a draft to{" "}
            <span className="text-[var(--text-primary)] font-medium">
              {recipientEmail}
            </span>
            . You can review and send it from Gmail.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={saveDraftMutation.isPending}
              onClick={() => saveDraftMutation.mutate(true)}
            >
              Create draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmGmailModal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      data-testid="message-inspector"
      className="animate-modal-in flex flex-col rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge source={message.source} />
            <UrgencyBadge urgency={message.effective_urgency} />
            {ai?.review_required && <ReviewRequiredBadge />}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <h2 className="text-lg font-semibold text-[var(--text-primary)] leading-snug">
          {message.subject_or_channel}
        </h2>

        <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)]">
              {getInitials(message.sender_name)}
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {message.sender_name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {message.sender_email_or_handle}
              </p>
            </div>
          </div>
          <span className="text-[var(--text-muted)] tabular-nums">
            {formatRelativeTime(message.received_at)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 px-6">
        <button
          onClick={() => setActiveTab("intelligence")}
          className={`py-3 text-xs font-medium border-b-2 mr-6 transition-colors ${
            activeTab === "intelligence"
              ? "border-[var(--accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Read & reply
        </button>
        <button
          onClick={() => setActiveTab("reply")}
          data-testid="tab-reply-assistant"
          className={`py-3 text-xs font-medium border-b-2 mr-6 transition-colors ${
            activeTab === "reply"
              ? "border-[var(--accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Reply draft
        </button>
        <button
          onClick={() => setActiveTab("collaborate")}
          className={`py-3 text-xs font-medium border-b-2 transition-colors tabular-nums ${
            activeTab === "collaborate"
              ? "border-[var(--accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Tasks & notes ({message.comments.length + message.assignments.length})
        </button>
      </div>

      <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
        {activeTab === "intelligence" && (
          <>
            {/* Original Message First so reading is immediate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text-secondary)]">
                  Original message
                </span>
                <span className="tabular-nums">{message.external_id}</span>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70 p-5 whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed max-h-72 overflow-y-auto">
                {message.body || message.preview}
              </div>
            </div>

            {ai && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    AI Summary & Key Details
                  </span>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">
                    {confidencePct}% match
                  </span>
                </div>

                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    <StreamingText text={ai.one_sentence_summary} />
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                    {ai.detailed_summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-muted)]">
                      Why it&apos;s here
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {ai.classification_reason}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--text-muted)]">
                      Deadline
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-3.5 w-3.5 text-[#D99B26]" />
                      <span className="text-xs font-medium text-[var(--text-primary)] tabular-nums">
                        {ai.deadline || "None"}
                      </span>
                      {ai.deadline && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          ({ai.deadline_is_explicit ? "exact" : "estimated"})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {message.effective_action_description && (
                  <div className="flex items-center justify-between gap-4 rounded-lg bg-[var(--bg-surface)] px-4 py-3 border border-[var(--border-subtle)]">
                    <div>
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        Next step
                      </span>
                      <p className="text-xs font-medium text-[var(--text-primary)] mt-0.5">
                        {message.effective_action_description}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={createTaskMutation.isPending}
                      onClick={() => createTaskMutation.mutate()}
                      data-testid="extract-task-button"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Add task
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Inline AI Reply & Slack/Email Composer */}
            {renderReplyComposer()}
          </>
        )}

        {activeTab === "reply" && renderReplyComposer()}

        {activeTab === "collaborate" && (
          <div className="space-y-6">
            {/* Add Task */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Create follow-up task
              </p>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  placeholder="Due date"
                  className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
                />
                <Button
                  variant="primary"
                  size="md"
                  loading={createTaskMutation.isPending}
                  onClick={() => createTaskMutation.mutate()}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Add task
                </Button>
              </div>
            </div>

            {/* Assign */}
            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Assign to teammate
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={assigneeName}
                  onChange={(e) => {
                    setAssigneeName(e.target.value);
                    const map: Record<string, string> = {
                      "Sarah Chen": "sarah.chen@instantly.team",
                      "Marcus Okoye": "marcus.okoye@instantly.team",
                      "Priya Nair": "priya.nair@instantly.team",
                    };
                    setAssigneeEmail(
                      map[e.target.value] || "team@instantly.team"
                    );
                  }}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)]"
                >
                  <option value="Sarah Chen">Sarah Chen</option>
                  <option value="Marcus Okoye">Marcus Okoye</option>
                  <option value="Priya Nair">Priya Nair</option>
                </select>
                <input
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Add a note..."
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </Button>
            </div>

            {/* Comments & Sent Replies */}
            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Thread activity & team notes ({message.comments.length})
              </p>
              <div className="space-y-2">
                {message.comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-[var(--border-subtle)]"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text-primary)]">
                        {c.author_name}
                      </span>
                      <span className="text-[var(--text-muted)] tabular-nums">
                        {formatRelativeTime(c.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a note for your team..."
                  className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <Button
                  variant="secondary"
                  size="md"
                  loading={commentMutation.isPending}
                  onClick={() => {
                    if (commentText.trim()) commentMutation.mutate();
                  }}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
